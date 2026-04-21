import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';

export async function GET(_request: NextRequest) {
  // Database readiness
  let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  try {
    await connectDB();
    dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    dbStatus = 'error';
  }

  // Firebase Admin config readiness (env vars present)
  const firebaseConfigured =
    !!process.env.FIREBASE_ADMIN_PROJECT_ID &&
    !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    !!process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  const healthy = dbStatus === 'connected' && firebaseConfigured;

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        firebaseAdmin: firebaseConfigured ? 'configured' : 'missing_env',
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
