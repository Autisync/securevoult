/**
 * Stripe billing integration — server-side only.
 *
 * Set STRIPE_SECRET_KEY in .env.local to enable live Stripe checkout.
 * When the key is absent every function returns a graceful "not configured" result
 * so the rest of the app continues to work in free/dev mode.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          — from Stripe Dashboard → Developers → API keys
 *   STRIPE_WEBHOOK_SECRET      — from Stripe Dashboard → Webhooks (for /api/billing/webhook)
 *   NEXT_PUBLIC_APP_URL        — used to build success/cancel redirect URLs
 *
 * Stripe price IDs must be created in the Stripe Dashboard and set here.
 * One price ID per plan × billing cycle combination.
 */

import Stripe from 'stripe';
import { type PlanId, type BillingCycle } from '@/lib/plans';

// ── Stripe instance ───────────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia',
      typescript: true,
    });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// ── Price ID mapping ──────────────────────────────────────────────────────────
// Populate these with your actual Stripe price IDs.
// Format: price_xxxxxxxxxxxxxxxxxxxxx

const STRIPE_PRICE_IDS: Partial<Record<`${PlanId}_${BillingCycle}`, string>> = {
  pro_monthly:        process.env.STRIPE_PRICE_PRO_MONTHLY        ?? '',
  pro_yearly:         process.env.STRIPE_PRICE_PRO_YEARLY         ?? '',
  company_monthly:    process.env.STRIPE_PRICE_COMPANY_MONTHLY    ?? '',
  company_yearly:     process.env.STRIPE_PRICE_COMPANY_YEARLY     ?? '',
  // enterprise has custom pricing — no price ID
};

export function getStripePriceId(plan: PlanId, cycle: BillingCycle): string | null {
  if (plan === 'free' || plan === 'enterprise') return null;
  return STRIPE_PRICE_IDS[`${plan}_${cycle}`] || null;
}

// ── Checkout session ──────────────────────────────────────────────────────────

export interface CreateCheckoutOptions {
  firebaseUid: string;
  email: string;
  targetPlan: PlanId;
  billingCycle: BillingCycle;
  companyId?: string;
  /** Current Stripe customer ID if one exists — prevents duplicate customers */
  stripeCustomerId?: string;
  successPath?: string;
  cancelPath?: string;
}

export interface CheckoutResult {
  configured: boolean;
  priceId: string | null;
  checkoutUrl: string | null;
  sessionId: string | null;
  error?: string;
}

/**
 * Create a Stripe Checkout Session for a plan upgrade.
 *
 * Returns `configured: false` when STRIPE_SECRET_KEY is not set so callers
 * can gracefully fall back to the "coming soon" message.
 */
export async function createCheckoutSession(
  opts: CreateCheckoutOptions
): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { configured: false, priceId: null, checkoutUrl: null, sessionId: null };
  }

  const priceId = getStripePriceId(opts.targetPlan, opts.billingCycle);
  if (!priceId) {
    return {
      configured: true,
      priceId: null,
      checkoutUrl: null,
      sessionId: null,
      error: `No Stripe price ID configured for ${opts.targetPlan}/${opts.billingCycle}.`,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const successPath = opts.successPath ?? '/settings?tab=billing&status=success';
  const cancelPath  = opts.cancelPath  ?? '/settings?tab=billing&status=canceled';

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}${cancelPath}`,
      metadata: {
        firebaseUid: opts.firebaseUid,
        targetPlan: opts.targetPlan,
        billingCycle: opts.billingCycle,
        ...(opts.companyId ? { companyId: opts.companyId } : {}),
      },
      // Pre-fill customer email so Stripe can match or create a customer
      customer_email: opts.stripeCustomerId ? undefined : opts.email,
      ...(opts.stripeCustomerId ? { customer: opts.stripeCustomerId } : {}),
      // Allow promotion codes (future discount capability)
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      configured: true,
      priceId,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    return {
      configured: true,
      priceId,
      checkoutUrl: null,
      sessionId: null,
      error: msg,
    };
  }
}

// ── Webhook signature verification ───────────────────────────────────────────

/**
 * Verify and parse a Stripe webhook payload.
 * Returns the event on success; throws on invalid signature.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured.');

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.');

  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// ── Customer portal ───────────────────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session so users can manage their
 * subscription, invoices, and payment methods without us building custom UI.
 */
export async function createPortalSession(
  stripeCustomerId: string
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/settings?tab=billing`,
  });

  return session.url;
}
