import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { User, AdminActivity } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.admin);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
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
    ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
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
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const { verifiedUser } = { verifiedUser: { uid: adminResult.adminUid } };

  let body: { firebaseUid?: string; role?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { firebaseUid, role, isActive } = body;

  if (!firebaseUid) {
    return NextResponse.json({ error: 'firebaseUid is required.' }, { status: 400 });
  }

  const target = await User.findOne({ firebaseUid });
  if (!target) {
    return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
  }

  if (role !== undefined) {
    if (!['user', 'companyAdmin', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'role must be "user", "companyAdmin", or "admin".' }, { status: 400 });
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
    ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  }).save();

  return NextResponse.json({
    success: true,
    user: { firebaseUid: target.firebaseUid, role: target.role, isActive: target.isActive },
  });
}
