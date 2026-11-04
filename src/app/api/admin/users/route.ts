import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { User, AdminActivity } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { badRequest, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

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

  const { verifiedUser } = { verifiedUser: { uid: adminResult.adminUid } };

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const search = searchParams.get('search');

  const query: Record<string, unknown> = {};
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { displayName: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);

  await new AdminActivity({
    adminFirebaseUid: verifiedUser.uid,
    action: 'vault_accessed',
    details: { page, limit, search, total },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  }).save();

  return NextResponse.json({
    success: true,
    users: users.map((u) => ({
      id: u._id,
      firebaseUid: u.firebaseUid,
      email: u.email,
      displayName: u.displayName,
      provider: u.provider,
      emailVerified: u.emailVerified,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function PUT(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const { verifiedUser } = { verifiedUser: { uid: adminResult.adminUid } };

  let body: { firebaseUid?: string; role?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const { firebaseUid, role, isActive } = body;

  if (!firebaseUid) {
    return badRequest('firebaseUid is required.');
  }

  const target = await User.findOne({ firebaseUid });
  if (!target) {
    return notFound('Target user not found.');
  }

  if (role !== undefined) {
    if (!['user', 'companyAdmin', 'admin'].includes(role)) {
      return badRequest('role must be "user", "companyAdmin", or "admin".');
    }
    target.role = role;
  }
  if (typeof isActive === 'boolean') target.isActive = isActive;

  await target.save();

  await new AdminActivity({
    adminFirebaseUid: verifiedUser.uid,
    action: 'user_updated',
    targetFirebaseUid: target.firebaseUid,
    details: { role, isActive },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  }).save();

  return NextResponse.json({
    success: true,
    user: { firebaseUid: target.firebaseUid, role: target.role, isActive: target.isActive },
  });
}
