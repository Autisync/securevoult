import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/api-error';
import { VaultFile, SystemState, SecurityEvent } from '@/lib/models';
import { mailConfigured } from '@/lib/mailer';
import type { VulnScan } from '@/lib/vuln-scan';
import { readdir, stat, statfs } from 'node:fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR ?? '/backups';

/** The nightly dumps written by the backup container (mounted read-only). */
async function backupInfo() {
  try {
    const names = (await readdir(/* turbopackIgnore: true */ BACKUP_DIR)).filter((n) => /^securevoult-.*\.archive\.gz$/.test(n));
    const files = await Promise.all(names.map(async (n) => ({ name: n, ...(await stat(/* turbopackIgnore: true */ `${BACKUP_DIR}/${n}`)) })));
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const latest = files[0];
    return {
      visible: true,
      count: files.length,
      latestAt: latest ? new Date(latest.mtimeMs).toISOString() : null,
      latestBytes: latest?.size ?? 0,
      totalBytes: files.reduce((a, f) => a + f.size, 0),
    };
  } catch {
    return { visible: false, count: 0, latestAt: null, latestBytes: 0, totalBytes: 0 };
  }
}

async function diskInfo() {
  try {
    const s = await statfs(/* turbopackIgnore: true */ BACKUP_DIR).catch(() => statfs('/'));
    return { freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize };
  } catch {
    return null;
  }
}

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.admin);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  // Database
  let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  let dbPingMs: number | null = null;
  try {
    const t0 = Date.now();
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    dbPingMs = Date.now() - t0;
    dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'error';
  }

  // Firebase Admin
  const firebaseConfigured =
    !!process.env.FIREBASE_ADMIN_PROJECT_ID &&
    !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    !!process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // Rate limits: Redis when Upstash is configured, otherwise this server's memory.
  const rateLimitMode = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? 'redis' : 'in-memory';

  // Bump with each release you want to name; the commit below is always exact.
  const appVersion = '1.0.0';

  const [vulnScan, critical24h] = dbStatus === 'connected'
    ? await Promise.all([
        SystemState.findOne({ key: 'vuln-scan' }).lean().then((d) => ((d as { value?: VulnScan } | null)?.value ?? null)).catch(() => null),
        SecurityEvent.countDocuments({ severity: 'critical', at: { $gte: new Date(Date.now() - 24 * 3600e3) } }).catch(() => 0),
      ])
    : [null, 0];

  const [backups, disk, files] = await Promise.all([
    backupInfo(),
    diskInfo(),
    dbStatus === 'connected'
      ? VaultFile.aggregate([{ $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$size' } } }]).then((r) => ({ count: Number(r[0]?.count ?? 0), bytes: Number(r[0]?.bytes ?? 0) })).catch(() => null)
      : Promise.resolve(null),
  ]);

  // MongoDB URI presence (safe — never expose the actual value)
  const mongoConfigured = !!process.env.MONGODB_URI;

  const healthy = dbStatus === 'connected' && firebaseConfigured && mongoConfigured;

  return NextResponse.json({
    success: true,
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbStatus,
        pingMs: dbPingMs,
        configured: mongoConfigured,
      },
      firebaseAdmin: {
        status: firebaseConfigured ? 'configured' : 'missing_env',
      },
      rateLimiting: {
        mode: rateLimitMode,
      },
      backups,
      disk,
      files,
      email: { configured: mailConfigured() },
      securityEvents: { critical24h },
      dependencies: vulnScan,
    },
    build: {
      version: appVersion,
      commit: process.env.BUILD_SHA ?? 'dev',
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
}

/** POST: run the security-update check now instead of waiting for the next 6-hourly run. */
export async function POST(request: NextRequest) {
  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;
  try { await connectDB(); } catch { return NextResponse.json({ success: false, message: 'Database unavailable' }, { status: 503 }); }
  const { checkDependencies } = await import('@/lib/jobs');
  const scan = await checkDependencies(true);
  return NextResponse.json({ success: !scan.error, scan, message: scan.error });
}
