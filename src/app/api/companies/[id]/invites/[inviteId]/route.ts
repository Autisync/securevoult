/**
 * DELETE /api/companies/[id]/invites/[inviteId]  — cancel a pending invite
 *
 * Access: company admin (own company) or global admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { CompanyInvite } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements } from '@/lib/entitlements';

type RouteParams = { params: Promise<{ id: string; inviteId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: companyId, inviteId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId) || !mongoose.isValidObjectId(inviteId)) {
    return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin' && entitlements.companyId === companyId;
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const result = await CompanyInvite.updateOne(
    { _id: inviteId, companyId, status: 'pending' },
    { $set: { status: 'canceled' } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Invite not found or already actioned.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, inviteId, status: 'canceled' });
}
