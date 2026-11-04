import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/api-error';

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

  // Rate limit mode
  const rateLimitMode = 'in-memory'; // upgrade to 'redis' when REDIS_URL is set

  // App version from package.json env (Next.js exposes this at build time)
  const appVersion = process.env.npm_package_version ?? 'unknown';

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
    },
    build: {
      version: appVersion,
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
    },
  });
}
