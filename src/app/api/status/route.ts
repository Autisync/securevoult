import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { readdir, stat } from 'node:fs/promises';
import connectDB from '@/lib/db-connect';
import { SecurityEvent, SystemState, User, Vault, VaultFile } from '@/lib/models';
import { EVENT_INFO } from '@/lib/security-events';
import { mailConfigured } from '@/lib/mailer';
import type { VulnScan } from '@/lib/vuln-scan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKUP_DIR = process.env.BACKUP_DIR ?? '/backups';

function allowed(request: NextRequest): boolean {
  const want = (process.env.STATUS_API_TOKEN ?? '').trim();
  const got = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

/**
 * For the Autisync CRM's SecureVoult tab (server to server, STATUS_API_TOKEN).
 * Counts and health only: no vault data, no email addresses beyond the
 * account named in a recent critical alert.
 */
export async function GET(request: NextRequest) {
  if (!allowed(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  let db = 'connected';
  try { await connectDB(); await mongoose.connection.db?.admin().ping(); } catch { db = 'error'; }

  let backups: { latestAt: string | null; count: number; latestBytes: number } = { latestAt: null, count: 0, latestBytes: 0 };
  try {
    const names = (await readdir(/* turbopackIgnore: true */ BACKUP_DIR)).filter((n) => /^securevoult-.*\.archive\.gz$/.test(n));
    const files = await Promise.all(names.map(async (n) => stat(/* turbopackIgnore: true */ `${BACKUP_DIR}/${n}`)));
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    backups = { latestAt: files[0] ? new Date(files[0].mtimeMs).toISOString() : null, count: files.length, latestBytes: files[0]?.size ?? 0 };
  } catch { /* not mounted */ }

  const day = new Date(Date.now() - 24 * 3600e3), week = new Date(Date.now() - 7 * 864e5), month = new Date(Date.now() - 30 * 864e5);
  const safe = <T,>(p: Promise<T>, d: T) => (db === 'connected' ? p.catch(() => d) : Promise.resolve(d));
  const [users, usersWeek, usersMonth, vaults, files, critical24h, warning24h, latestCritical, scan, signIns24h] = await Promise.all([
    safe(User.countDocuments({}), 0),
    safe(User.countDocuments({ createdAt: { $gte: week } }), 0),
    safe(User.countDocuments({ createdAt: { $gte: month } }), 0),
    safe(Vault.countDocuments({ encryptedVault: { $ne: '' } }), 0),
    safe(VaultFile.aggregate([{ $group: { _id: null, n: { $sum: 1 }, b: { $sum: '$size' } } }]).then((r) => ({ count: r[0]?.n ?? 0, bytes: r[0]?.b ?? 0 })), { count: 0, bytes: 0 }),
    safe(SecurityEvent.countDocuments({ severity: 'critical', at: { $gte: day } }), 0),
    safe(SecurityEvent.countDocuments({ severity: 'warning', at: { $gte: day } }), 0),
    safe(SecurityEvent.find({ severity: 'critical' }).sort({ at: -1 }).limit(5).lean() as Promise<unknown>, []),
    safe(SystemState.findOne({ key: 'vuln-scan' }).lean().then((d) => (d as { value?: VulnScan } | null)?.value ?? null), null),
    safe(SecurityEvent.countDocuments({ type: { $in: ['sign_in', 'new_device_sign_in'] }, at: { $gte: day } }), 0),
  ]);

  const backupAgeH = backups.latestAt ? (Date.now() - new Date(backups.latestAt).getTime()) / 3600e3 : null;
  const seriousVulns = (scan?.findings ?? []).filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL').length;
  const status = db !== 'connected' ? 'down' : (backupAgeH !== null && backupAgeH > 26) || critical24h > 0 || seriousVulns > 0 ? 'attention' : 'ok';

  return NextResponse.json({
    status,
    checkedAt: new Date().toISOString(),
    app: { url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://vault.autisync.com', version: '1.0.0', commit: process.env.BUILD_SHA ?? 'dev', uptimeSeconds: Math.round(process.uptime()) },
    database: db,
    email: mailConfigured(),
    backups: { ...backups, ageHours: backupAgeH === null ? null : Math.round(backupAgeH * 10) / 10 },
    usage: { users, newUsers7d: usersWeek, newUsers30d: usersMonth, vaults, files, signIns24h },
    security: {
      critical24h, warning24h,
      latestCritical: (latestCritical as { at: Date; type: string; summary?: string; email?: string; ip?: string }[]).map((e) => ({
        at: e.at, label: EVENT_INFO[e.type]?.label ?? e.type, summary: e.summary, account: e.email ?? null, ip: e.ip ?? null,
      })),
      packages: scan ? { checkedAt: scan.checkedAt, total: scan.packages, issues: scan.findings.length, serious: seriousVulns, error: scan.error ?? null } : null,
    },
  });
}
