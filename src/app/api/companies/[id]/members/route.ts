/**
 * GET  /api/companies/[id]/members  — list all members of a company
 * POST /api/companies/[id]/members  — add an existing user to a company
 *
 * Access: company admin (scoped to own company) or global admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { User, Company } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { logLimitEvent } from '@/lib/limit-logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return NextResponse.json({ error: 'Invalid company ID.' }, { status: 400 });
  }

  const entitlements = await resolveEntitlements(user.uid);

  // Must be global admin or a company admin of this specific company
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin =
    (entitlements.scope === 'company_admin') &&
    entitlements.companyId === companyId;

  if (!isGlobalAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const company = await Company.findById(companyId)
    .select('name plan status maxSeats ownerFirebaseUid')
    .lean<{ name: string; plan: string; status?: string; maxSeats: number; ownerFirebaseUid: string }>();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const members = await User.find({ companyId })
    .select('firebaseUid email displayName role isActive plan createdAt')
    .lean<{
      firebaseUid: string;
      email: string;
      displayName: string;
      role: string;
      isActive: boolean;
      plan: string;
      createdAt: Date;
    }[]>();

  return NextResponse.json({
    success: true,
    companyId,
    companyName: company.name,
    plan: company.plan,
    status: company.status ?? 'active',
    maxSeats: company.maxSeats,
    currentSeats: members.length,
    members: members.map((m) => ({
      firebaseUid: m.firebaseUid,
      email: m.email,
      displayName: m.displayName,
      role: m.role,
      isActive: m.isActive,
      isOwner: m.firebaseUid === company.ownerFirebaseUid,
      joinedAt: m.createdAt,
    })),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return NextResponse.json({ error: 'Invalid company ID.' }, { status: 400 });
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin =
    (entitlements.scope === 'company_admin') && entitlements.companyId === companyId;

  if (!isGlobalAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: { targetEmail?: string; role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { targetEmail, role = 'user' } = body;
  if (!targetEmail || typeof targetEmail !== 'string') {
    return NextResponse.json({ error: 'targetEmail is required.' }, { status: 400 });
  }
  if (!['user', 'companyAdmin'].includes(role)) {
    return NextResponse.json({ error: 'role must be "user" or "companyAdmin".' }, { status: 400 });
  }

  const company = await Company.findById(companyId)
    .select('name plan status maxSeats')
    .lean<{ name: string; plan: string; status?: string; maxSeats: number }>();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  // Seat limit enforcement
  const currentSeats = await User.countDocuments({ companyId });
  const maxSeats = company.maxSeats;
  if (maxSeats !== -1 && currentSeats >= maxSeats) {
    logLimitEvent({
      firebaseUid: user.uid,
      companyId,
      event: 'seat_limit_reached',
      feature: 'company_seats',
      plan: company.plan,
      currentUsage: currentSeats,
      allowedLimit: maxSeats,
      ipAddress: ip,
    });
    return NextResponse.json(
      planLimitPayload({
        feature: 'company_seats',
        currentPlan: company.plan as 'free' | 'pro' | 'company' | 'enterprise',
        currentUsage: currentSeats,
        allowedLimit: maxSeats,
        upgradeTo: 'enterprise',
        message: `This company has reached its seat limit of ${maxSeats}. Contact support to increase seats.`,
      }),
      { status: 422 }
    );
  }

  const targetUser = await User.findOne({ email: targetEmail.toLowerCase().trim() });
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found. They must have a SecureVoult account.' }, { status: 404 });
  }
  if (targetUser.companyId?.toString() === companyId) {
    return NextResponse.json({ error: 'User is already a member of this company.' }, { status: 409 });
  }
  if (targetUser.companyId) {
    return NextResponse.json({ error: 'User already belongs to another company.' }, { status: 409 });
  }

  await User.updateOne(
    { _id: targetUser._id },
    { $set: { companyId: new mongoose.Types.ObjectId(companyId), role } }
  );

  return NextResponse.json({
    success: true,
    message: `${targetEmail} added to company.`,
    firebaseUid: targetUser.firebaseUid,
    role,
  });
}
