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

type RouteParams = { params: Promise<{ id: string; uid: string }> };

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
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  }

  return { callerUid: user.uid, isGlobalAdmin };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: companyId, uid: targetUid } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const auth = await authorise(request, companyId);
  if ('error' in auth) return auth.error;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return NextResponse.json({ error: 'Invalid company ID.' }, { status: 400 });
  }

  const company = await Company.findById(companyId).select('ownerFirebaseUid').lean<{ ownerFirebaseUid: string }>();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  // Company owner's role cannot be changed via this endpoint
  if (targetUid === company.ownerFirebaseUid) {
    return NextResponse.json({ error: 'Company owner role cannot be changed here.' }, { status: 400 });
  }

  let body: { role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { role } = body;
  if (!role || !['user', 'companyAdmin'].includes(role)) {
    return NextResponse.json({ error: 'role must be "user" or "companyAdmin".' }, { status: 400 });
  }

  const result = await User.updateOne(
    { firebaseUid: targetUid, companyId: new mongoose.Types.ObjectId(companyId) },
    { $set: { role } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'User not found in this company.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, firebaseUid: targetUid, newRole: role });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: companyId, uid: targetUid } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const auth = await authorise(request, companyId);
  if ('error' in auth) return auth.error;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return NextResponse.json({ error: 'Invalid company ID.' }, { status: 400 });
  }

  // Prevent removing the company owner
  const company = await Company.findById(companyId).select('ownerFirebaseUid').lean<{ ownerFirebaseUid: string }>();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  if (targetUid === company.ownerFirebaseUid) {
    return NextResponse.json({ error: 'Company owner cannot be removed. Transfer ownership first.' }, { status: 400 });
  }

  // Prevent self-removal (edge case: admin removing themselves)
  if (targetUid === auth.callerUid && !auth.isGlobalAdmin) {
    return NextResponse.json({ error: 'You cannot remove yourself. Contact another admin.' }, { status: 400 });
  }

  const result = await User.updateOne(
    { firebaseUid: targetUid, companyId: new mongoose.Types.ObjectId(companyId) },
    { $set: { companyId: null, role: 'user' } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'User not found in this company.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, firebaseUid: targetUid, removed: true });
}
