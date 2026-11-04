/**
 * POST /api/security/scan
 *
 * Trigger a server-side breach scan for the authenticated user.
 *
 * This endpoint:
 *   1. Resolves plan entitlements
 *   2. Enforces `maxBreachScansPerDay` (throttle gate)
 *   3. Records a scan event in LimitEvent
 *   4. Returns the scan allowance so the client can display remaining scans
 *
 * Actual HIBP API calls are made from the client using k-anonymity (pwned passwords
 * API) to avoid sending full hashes to the server. This endpoint only tracks
 * and authorises the scan — it does NOT proxy HIBP.
 *
 * To trigger a full server-side scan (e.g. email breach check), callers must
 * first hit this endpoint to obtain a one-time scan token, then pass it to
 * POST /api/security/scan/report (future route).
 */
import { NextRequest, NextResponse } from 'next/server';
import { subDays, startOfDay } from 'date-fns';
import connectDB from '@/lib/db-connect';
import { LimitEvent } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { logLimitEvent } from '@/lib/limit-logger';
import { canRunBreachScan } from '@/lib/feature-gates';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const entitlements = await resolveEntitlements(user.uid);

  if (!entitlements.limits.breachMonitoring) {
    return NextResponse.json(
      planLimitPayload({
        feature: 'breach_monitoring',
        currentPlan: entitlements.effectivePlan,
        upgradeTo: 'pro',
        message: 'Breach monitoring is not available on the free plan.',
      }),
      { status: 403 }
    );
  }

  // Count how many scans the user has already triggered today
  const dayStart = startOfDay(new Date());
  const scansToday = await LimitEvent.countDocuments({
    firebaseUid: user.uid,
    event: 'scan_triggered',
    feature: 'breach_scan',
    createdAt: { $gte: dayStart },
  });

  const maxScansPerDay = entitlements.limits.maxBreachScansPerDay;

  if (!canRunBreachScan(entitlements.effectivePlan, scansToday)) {
    logLimitEvent({
      firebaseUid: user.uid,
      companyId: entitlements.companyId,
      event: 'scan_denied',
      feature: 'breach_scan',
      plan: entitlements.effectivePlan,
      currentUsage: scansToday,
      allowedLimit: maxScansPerDay,
      ipAddress: ip,
    });

    return NextResponse.json(
      planLimitPayload({
        feature: 'breach_scan',
        currentPlan: entitlements.effectivePlan,
        currentUsage: scansToday,
        allowedLimit: maxScansPerDay,
        upgradeTo: 'pro',
        message: `You have used all ${maxScansPerDay} breach scans for today. Scans reset at midnight.`,
      }),
      { status: 422 }
    );
  }

  // Record the scan event (fire-and-forget)
  logLimitEvent({
    firebaseUid: user.uid,
    companyId: entitlements.companyId,
    event: 'scan_triggered',
    feature: 'breach_scan',
    plan: entitlements.effectivePlan,
    currentUsage: scansToday + 1,
    allowedLimit: maxScansPerDay,
    ipAddress: ip,
  });

  const scansRemaining = maxScansPerDay === -1 ? null : maxScansPerDay - scansToday - 1;

  return NextResponse.json({
    success: true,
    authorized: true,
    scansUsedToday: scansToday + 1,
    scansRemaining,
    unlimited: maxScansPerDay === -1,
    plan: entitlements.effectivePlan,
  });
}

/**
 * GET /api/security/scan — return current scan quota without consuming one.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const entitlements = await resolveEntitlements(user.uid);

  const dayStart = startOfDay(new Date());
  const scansToday = await LimitEvent.countDocuments({
    firebaseUid: user.uid,
    event: 'scan_triggered',
    feature: 'breach_scan',
    createdAt: { $gte: dayStart },
  });

  const maxScansPerDay = entitlements.limits.maxBreachScansPerDay;
  const scansRemaining = maxScansPerDay === -1 ? null : Math.max(0, maxScansPerDay - scansToday);
  const canScan = canRunBreachScan(entitlements.effectivePlan, scansToday);

  return NextResponse.json({
    scansUsedToday: scansToday,
    scansRemaining,
    unlimited: maxScansPerDay === -1,
    canScan,
    plan: entitlements.effectivePlan,
    breachMonitoringEnabled: entitlements.limits.breachMonitoring,
  });
}
