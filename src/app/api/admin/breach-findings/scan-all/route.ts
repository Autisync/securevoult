/**
 * POST /api/admin/breach-findings/scan-all
 *
 * Marks all active (non-resolved, non-dismissed) breach findings as stale so
 * the next client-side vault scan will re-verify them.  This is the safe,
 * privacy-preserving alternative to a server-side re-check: since plaintext
 * passwords never reach the server, the actual HIBP k-anonymity check must
 * happen on each user's client.
 *
 * What this endpoint does:
 *  1. Resets `lastCheckedAt` to epoch (1970) on all 'new' and 'investigating'
 *     findings so they appear stale in the Breach Center.
 *  2. Sets a `rescanRequestedAt` timestamp on every matching User document so
 *     the client vault can detect "a rescan has been requested" and prompt the
 *     user to run their Security Center check.
 *  3. Returns counts of findings and users affected.
 *
 * Scope: global admin only.
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { BreachFinding, User } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function POST(request: NextRequest) {
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

  const staleDate = new Date(0); // epoch — forces stale appearance in the UI

  // Reset lastCheckedAt on all active findings
  const findingUpdate = await BreachFinding.updateMany(
    { status: { $in: ['new', 'investigating'] } },
    { $set: { lastCheckedAt: staleDate } }
  );

  // Collect the distinct uids that have active findings
  const affectedUids = await BreachFinding.distinct('firebaseUid', {
    status: { $in: ['new', 'investigating'] },
  });

  // Stamp each affected user so their client knows a rescan is requested
  const userUpdate = await User.updateMany(
    { firebaseUid: { $in: affectedUids } },
    { $set: { rescanRequestedAt: new Date() } }
  );

  return NextResponse.json({
    success: true,
    findingsMarkedStale: findingUpdate.modifiedCount,
    usersNotified: userUpdate.modifiedCount,
    message: `${findingUpdate.modifiedCount} findings marked stale. ${userUpdate.modifiedCount} users will be prompted to re-scan their vault.`,
  });
}
