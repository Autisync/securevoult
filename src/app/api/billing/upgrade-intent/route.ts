/**
 * POST /api/billing/upgrade-intent
 *
 * Records that a user wants to upgrade their plan.
 * Returns a structured response with the suggested next step.
 *
 * This is a placeholder for future Stripe integration.
 * When Stripe is added, this endpoint will create a checkout session and
 * return a redirect URL.
 *
 * Body: {
 *   targetPlan: 'pro' | 'company' | 'enterprise',
 *   billingCycle?: 'monthly' | 'yearly',
 *   feature?: string,  // the feature that triggered the upgrade
 * }
 *
 * Returns: {
 *   success: true,
 *   intent: 'recorded',
 *   targetPlan: string,
 *   message: string,
 *   // future: checkoutUrl: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements } from '@/lib/entitlements';
import { logLimitEvent } from '@/lib/limit-logger';
import { PLAN_PRICING, PLAN_META, type PlanId, type BillingCycle } from '@/lib/plans';
import { createCheckoutSession, isStripeConfigured } from '@/lib/stripe';

const VALID_UPGRADE_PLANS: PlanId[] = ['pro', 'company', 'enterprise'];
const VALID_CYCLES: BillingCycle[] = ['monthly', 'yearly'];

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.auth);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  let body: {
    targetPlan?: string;
    billingCycle?: string;
    feature?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { targetPlan, billingCycle = 'monthly', feature = 'general' } = body;

  if (!targetPlan || !VALID_UPGRADE_PLANS.includes(targetPlan as PlanId)) {
    return NextResponse.json(
      { error: `targetPlan must be one of: ${VALID_UPGRADE_PLANS.join(', ')}.` },
      { status: 400 }
    );
  }
  if (!VALID_CYCLES.includes(billingCycle as BillingCycle)) {
    return NextResponse.json({ error: 'billingCycle must be "monthly" or "yearly".' }, { status: 400 });
  }

  const plan = targetPlan as PlanId;
  const cycle = billingCycle as BillingCycle;

  const entitlements = await resolveEntitlements(user.uid);

  // Prevent "upgrading" to current or lower plan
  const planOrder: PlanId[] = ['free', 'pro', 'company', 'enterprise'];
  const currentIdx = planOrder.indexOf(entitlements.effectivePlan);
  const targetIdx = planOrder.indexOf(plan);
  if (targetIdx <= currentIdx) {
    return NextResponse.json(
      { error: `You are already on ${entitlements.effectivePlan} plan or higher.` },
      { status: 400 }
    );
  }

  // Log the intent
  logLimitEvent({
    firebaseUid: user.uid,
    companyId: entitlements.companyId,
    event: 'upgrade_intent',
    feature,
    plan: entitlements.effectivePlan,
    meta: { targetPlan: plan, billingCycle: cycle },
    ipAddress: ip,
  });

  // Build pricing summary for the response
  const pricing = PLAN_PRICING[plan];
  const meta = PLAN_META[plan];
  const price = cycle === 'yearly' ? pricing.yearly : pricing.monthly;
  const priceLabel = pricing.custom
    ? 'Custom pricing — contact us'
    : cycle === 'yearly'
      ? `£${pricing.yearly}/year${pricing.perUser ? ' per user' : ''}`
      : `£${pricing.monthly}/month${pricing.perUser ? ' per user' : ''}`;

  // ── Stripe checkout (when configured) ──────────────────────────────────
  if (isStripeConfigured() && !pricing.custom) {
    const checkout = await createCheckoutSession({
      firebaseUid: user.uid,
      email: user.email,
      targetPlan: plan,
      billingCycle: cycle,
      companyId: entitlements.companyId,
    });

    if (checkout.configured && checkout.checkoutUrl) {
      return NextResponse.json({
        success: true,
        intent: 'checkout',
        targetPlan: plan,
        billingCycle: cycle,
        planName: meta.name,
        priceLabel,
        price,
        checkoutUrl: checkout.checkoutUrl,
        sessionId: checkout.sessionId,
      });
    }

    // Stripe is configured but checkout creation failed — log and fall through
    if (checkout.error) {
      console.error('[billing/upgrade-intent] Stripe checkout failed:', checkout.error);
    }
  }

  // ── Fallback: record intent only (no Stripe or enterprise custom pricing) ─
  const isEnterprise = plan === 'enterprise' || pricing.custom;
  return NextResponse.json({
    success: true,
    intent: 'recorded',
    targetPlan: plan,
    billingCycle: cycle,
    planName: meta.name,
    priceLabel,
    price,
    checkoutUrl: null,
    message: isEnterprise
      ? 'Thank you for your interest in Enterprise. Our team will be in touch shortly.'
      : 'Your upgrade request has been noted. Stripe integration is coming soon — we\'ll notify you when payments are live.',
  });
}

/**
 * GET /api/billing/upgrade-intent
 *
 * Returns the current plan, pricing, and suggested upgrade path for the user.
 * Used by BillingSettings to show upgrade CTAs.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const entitlements = await resolveEntitlements(user.uid);
  const planOrder: PlanId[] = ['free', 'pro', 'company', 'enterprise'];
  const currentIdx = planOrder.indexOf(entitlements.effectivePlan);
  const upgradePaths = planOrder.slice(currentIdx + 1).map((p) => {
    const pricing = PLAN_PRICING[p];
    const meta = PLAN_META[p];
    return {
      planId: p,
      name: meta.name,
      tagline: meta.tagline,
      monthlyPrice: pricing.monthly,
      yearlyPrice: pricing.yearly,
      perUser: pricing.perUser ?? false,
      custom: pricing.custom ?? false,
      features: meta.features,
    };
  });

  return NextResponse.json({
    success: true,
    currentPlan: entitlements.effectivePlan,
    planSource: entitlements.planSource,
    scope: entitlements.scope,
    isTrial: entitlements.isTrial,
    trialEndsAt: entitlements.trialEndsAt ?? null,
    upgradePaths,
  });
}
