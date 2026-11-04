import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { AdminActivity } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';

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

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const action = searchParams.get('action');
  const adminUid = searchParams.get('adminUid');

  const query: Record<string, unknown> = {};
  if (action) query.action = action;
  if (adminUid) query.adminFirebaseUid = adminUid;

  const [activities, total] = await Promise.all([
    AdminActivity.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AdminActivity.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    activities: activities.map((a) => ({
      id: a._id,
      adminFirebaseUid: a.adminFirebaseUid,
      action: a.action,
      targetFirebaseUid: a.targetFirebaseUid,
      details: a.details,
      ipAddress: a.ipAddress,
      userAgent: a.userAgent,
      timestamp: a.timestamp,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
