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
import { badRequest, conflict, forbidden, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return badRequest('Invalid company ID.');
  }

  const entitlements = await resolveEntitlements(user.uid);

  // Must be global admin or a company admin of this specific company
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin =
    (entitlements.scope === 'company_admin') &&
    entitlements.companyId === companyId;

  if (!isGlobalAdmin && !isCompanyAdmin) {
    return forbidden('Forbidden.');
  }

  const company = await Company.findById(companyId)
    .select('name plan status maxSeats ownerFirebaseUid')
    .lean<{ name: string; plan: string; status?: string; maxSeats: number; ownerFirebaseUid: string }>();
  if (!company) return notFound('Company not found.');

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
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return badRequest('Invalid company ID.');
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin =
    (entitlements.scope === 'company_admin') && entitlements.companyId === companyId;

  if (!isGlobalAdmin && !isCompanyAdmin) {
    return forbidden('Forbidden.');
  }

  let body: { targetEmail?: string; role?: string };
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON body.');
  }

  const { targetEmail, role = 'user' } = body;
  if (!targetEmail || typeof targetEmail !== 'string') {
    return badRequest('targetEmail is required.');
  }
  if (!['user', 'companyAdmin'].includes(role)) {
    return badRequest('role must be "user" or "companyAdmin".');
  }

  const company = await Company.findById(companyId)
    .select('name plan status maxSeats')
    .lean<{ name: string; plan: string; status?: string; maxSeats: number }>();
  if (!company) return notFound('Company not found.');

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
    return notFound('User not found. They must have a SecureVoult account.');
  }
  if (targetUser.companyId?.toString() === companyId) {
    return conflict('User is already a member of this company.');
  }
  if (targetUser.companyId) {
    return conflict('User already belongs to another company.');
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
