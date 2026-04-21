/**
 * POST /api/billing/downgrade
 *
 * Intentional plan downgrade — the user explicitly requests a lower plan.
 *
 * This route:
 *   1. Validates the downgrade is permitted (can't "downgrade" to a higher plan)
 *   2. Applies the new plan to User or Company in the DB
 *   3. Calls handlePlanDowngrade for cleanup side-effects
 *   4. Returns a summary of what was changed
 *
 * If Stripe is configured, this should cancel or modify the Stripe subscription.
 * The Stripe webhook will then call this flow automatically — in that case callers
 * should NOT call this endpoint directly (the webhook handles it).
 *
 * Body: { toPlan: PlanId, billingCycle?: 'monthly' | 'yearly', companyId?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { User, Company } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements } from '@/lib/entitlements';
import { handlePlanDowngrade } from '@/lib/downgrade';
import { PlanId, PLAN_PRICING } from '@/lib/plans';

const PLAN_ORDER: PlanId[] = ['free', 'pro', 'company', 'enterprise'];

function isPlanLower(from: PlanId, to: PlanId): boolean {
  return PLAN_ORDER.indexOf(to) < PLAN_ORDER.indexOf(from);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  let body: { toPlan?: string; billingCycle?: string; companyId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { toPlan, billingCycle, companyId } = body;

  if (!toPlan || !PLAN_ORDER.includes(toPlan as PlanId)) {
    return NextResponse.json({ error: 'toPlan must be one of: free, pro, company, enterprise.' }, { status: 400 });
  }

  if (billingCycle && !['monthly', 'yearly'].includes(billingCycle)) {
    return NextResponse.json({ error: 'billingCycle must be "monthly" or "yearly".' }, { status: 400 });
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin';

  const targetCompanyId =
    companyId ?? (isCompanyAdmin || isGlobalAdmin ? entitlements.companyId : undefined);

  // Determine current plan
  const currentPlan = entitlements.effectivePlan;

  // Validate the downgrade direction
  if (!isPlanLower(currentPlan, toPlan as PlanId)) {
    return NextResponse.json(
      {
        error: `Cannot downgrade from "${currentPlan}" to "${toPlan}". For upgrades use POST /api/billing/upgrade-intent.`,
      },
      { status: 400 }
    );
  }

  // Validate company scope if target is a company
  if (targetCompanyId) {
    if (!isGlobalAdmin && !isCompanyAdmin) {
      return NextResponse.json({ error: 'Forbidden. Company admin access required.' }, { status: 403 });
    }
    if (!mongoose.isValidObjectId(targetCompanyId)) {
      return NextResponse.json({ error: 'Invalid companyId.' }, { status: 400 });
    }
    if (isCompanyAdmin && entitlements.companyId !== targetCompanyId) {
      return NextResponse.json({ error: 'Forbidden. You can only downgrade your own company.' }, { status: 403 });
    }
  }

  const newPlan = toPlan as PlanId;
  const newBillingCycle = (billingCycle as 'monthly' | 'yearly') ?? 'monthly';

  // Apply plan change
  if (targetCompanyId) {
    await Company.updateOne(
      { _id: targetCompanyId },
      { $set: { plan: newPlan, billingCycle: newBillingCycle, planExpiresAt: null } }
    );
  } else {
    await User.updateOne(
      { firebaseUid: user.uid },
      { $set: { plan: newPlan, billingCycle: newBillingCycle, planExpiresAt: null } }
    );
  }

  // Run cleanup side-effects
  const cleanup = await handlePlanDowngrade(
    user.uid,
    currentPlan,
    newPlan,
    targetCompanyId
  );

  return NextResponse.json({
    success: true,
    previousPlan: currentPlan,
    newPlan,
    billingCycle: newBillingCycle,
    cleanup,
    message: `Plan downgraded from ${currentPlan} to ${newPlan}. Some features may now be limited or unavailable.`,
  });
}
