/**
 * GET  /api/security/breach-history           — list this user's breach findings
 * POST /api/security/breach-history           — store a new breach finding
 * PUT  /api/security/breach-history/[findingId] — update status (dismiss, resolve)
 *
 * Enforcement:
 *   - `breachHistory` gate: free plan users cannot see breach history at all
 *   - `breachHistoryDays`: pro users see up to 90 days; company/enterprise unlimited
 */
import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import connectDB from '@/lib/db-connect';
import { BreachFinding } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { getBreachHistoryDays } from '@/lib/feature-gates';
import { badRequest, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

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

  // Gate 1: must have breach history access at all
  if (!entitlements.limits.breachHistory) {
    return NextResponse.json(
      planLimitPayload({
        feature: 'breach_history',
        currentPlan: entitlements.effectivePlan,
        upgradeTo: 'pro',
        message: 'Breach history is not available on the free plan. Upgrade to Pro to access your full breach history.',
      }),
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const status   = searchParams.get('status');
  const severity = searchParams.get('severity');

  const query: Record<string, unknown> = { firebaseUid: user.uid };
  if (status)   query.status   = status;
  if (severity) query.severity = severity;

  // Gate 2: limit history window by plan
  const historyDays = getBreachHistoryDays(entitlements.effectivePlan);
  if (historyDays !== -1) {
    query.firstDetectedAt = { $gte: subDays(new Date(), historyDays) };
  }

  const [findings, total] = await Promise.all([
    BreachFinding.find(query)
      .sort({ firstDetectedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v')
      .lean(),
    BreachFinding.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    findings,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    meta: {
      historyLimitDays: historyDays === -1 ? null : historyDays,
      plan: entitlements.effectivePlan,
    },
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
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
      }),
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON body.');
  }

  const { entryId, entryLabel, entryUrl, breachType, severity, hibpCount } = body as {
    entryId?: string;
    entryLabel?: string;
    entryUrl?: string;
    breachType?: string;
    severity?: string;
    hibpCount?: number;
  };

  if (!entryId || !breachType || !severity) {
    return badRequest('entryId, breachType, and severity are required.');
  }

  if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
    return badRequest('Invalid severity value.');
  }

  // Upsert: update existing finding for this entry or create a new one
  const finding = await BreachFinding.findOneAndUpdate(
    { firebaseUid: user.uid, entryId },
    {
      $set: {
        entryLabel: entryLabel ?? null,
        entryUrl: entryUrl ?? null,
        breachType,
        severity,
        hibpCount: hibpCount ?? 0,
        lastCheckedAt: new Date(),
      },
      $setOnInsert: {
        firebaseUid: user.uid,
        status: 'new',
        firstDetectedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ success: true, finding }, { status: 201 });
}
