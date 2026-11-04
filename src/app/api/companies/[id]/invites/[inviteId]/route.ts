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
import { badRequest, forbidden, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string; inviteId: string }> };

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: companyId, inviteId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId) || !mongoose.isValidObjectId(inviteId)) {
    return badRequest('Invalid ID.');
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin' && entitlements.companyId === companyId;
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return forbidden('Forbidden.');
  }

  const result = await CompanyInvite.updateOne(
    { _id: inviteId, companyId, status: 'pending' },
    { $set: { status: 'canceled' } }
  );

  if (result.matchedCount === 0) {
    return notFound('Invite not found or already actioned.');
  }

  return NextResponse.json({ success: true, inviteId, status: 'canceled' });
}
