/**
 * PUT    /api/companies/[id]/members/[uid]  — update a member's role
 * DELETE /api/companies/[id]/members/[uid]  — remove a member from the company
 *
 * Access: company admin (own company) or global admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { User, Company } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements } from '@/lib/entitlements';
import { badRequest, forbidden, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string; uid: string }> };

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

/** Resolve and authorise the caller for a specific company. */
async function authorise(request: NextRequest, companyId: string) {
  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return { error: authResult.error };
  const { user } = authResult;

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin =
    entitlements.scope === 'company_admin' && entitlements.companyId === companyId;

  if (!isGlobalAdmin && !isCompanyAdmin) {
    return { error: forbidden('Forbidden.') };
  }

  return { callerUid: user.uid, isGlobalAdmin };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: companyId, uid: targetUid } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const auth = await authorise(request, companyId);
  if ('error' in auth) return auth.error;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return badRequest('Invalid company ID.');
  }

  const company = await Company.findById(companyId).select('ownerFirebaseUid').lean<{ ownerFirebaseUid: string }>();
  if (!company) return notFound('Company not found.');

  // Company owner's role cannot be changed via this endpoint
  if (targetUid === company.ownerFirebaseUid) {
    return badRequest('Company owner role cannot be changed here.');
  }

  let body: { role?: string };
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON body.');
  }

  const { role } = body;
  if (!role || !['user', 'companyAdmin'].includes(role)) {
    return badRequest('role must be "user" or "companyAdmin".');
  }

  const result = await User.updateOne(
    { firebaseUid: targetUid, companyId: new mongoose.Types.ObjectId(companyId) },
    { $set: { role } }
  );

  if (result.matchedCount === 0) {
    return notFound('User not found in this company.');
  }

  return NextResponse.json({ success: true, firebaseUid: targetUid, newRole: role });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: companyId, uid: targetUid } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const auth = await authorise(request, companyId);
  if ('error' in auth) return auth.error;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return badRequest('Invalid company ID.');
  }

  // Prevent removing the company owner
  const company = await Company.findById(companyId).select('ownerFirebaseUid').lean<{ ownerFirebaseUid: string }>();
  if (!company) return notFound('Company not found.');
  if (targetUid === company.ownerFirebaseUid) {
    return badRequest('Company owner cannot be removed. Transfer ownership first.');
  }

  // Prevent self-removal (edge case: admin removing themselves)
  if (targetUid === auth.callerUid && !auth.isGlobalAdmin) {
    return badRequest('You cannot remove yourself. Contact another admin.');
  }

  const result = await User.updateOne(
    { firebaseUid: targetUid, companyId: new mongoose.Types.ObjectId(companyId) },
    { $set: { companyId: null, role: 'user' } }
  );

  if (result.matchedCount === 0) {
    return notFound('User not found in this company.');
  }

  return NextResponse.json({ success: true, firebaseUid: targetUid, removed: true });
}
