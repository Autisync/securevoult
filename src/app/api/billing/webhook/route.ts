/**
 * POST /api/billing/webhook
 *
 * Stripe webhook endpoint. Receives and verifies Stripe events then updates
 * the user/company plan in MongoDB accordingly.
 *
 * Configure in Stripe Dashboard → Developers → Webhooks:
 *   URL: https://your-domain.com/api/billing/webhook
 *   Events to listen for:
 *     - checkout.session.completed
 *     - customer.subscription.updated
 *     - customer.subscription.deleted
 *     - invoice.payment_failed
 *
 * Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { User, Company } from '@/lib/models';
import { constructWebhookEvent } from '@/lib/stripe';
import { logLimitEvent } from '@/lib/limit-logger';
import { badRequest, internalError, serviceUnavailable } from '@/lib/api-error';
import type { PlanId } from '@/lib/plans';
import type Stripe from 'stripe';

// Next.js App Router requires raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

// ── Stripe plan mapping ───────────────────────────────────────────────────────
// Map Stripe price IDs to our internal plan IDs.
// Populated from env vars so no hardcoded IDs in source.
function stripePriceToplan(priceId: string): PlanId | null {
  const map: Record<string, PlanId> = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY     ?? '__']: 'pro',
    [process.env.STRIPE_PRICE_PRO_YEARLY      ?? '__']: 'pro',
    [process.env.STRIPE_PRICE_COMPANY_MONTHLY ?? '__']: 'company',
    [process.env.STRIPE_PRICE_COMPANY_YEARLY  ?? '__']: 'company',
  };
  return map[priceId] ?? null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return badRequest('Missing stripe-signature header.');
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return badRequest('Could not read request body.');
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return badRequest('Invalid webhook signature.');
  }

  try {
    await connectDB();
  } catch {
    console.error('[stripe/webhook] DB unavailable — event not processed:', event.type);
    return serviceUnavailable('Webhook processing unavailable. Please retry.');
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error('[stripe/webhook] Handler error:', err);
    return internalError('Webhook processing failed.');
  }

  return NextResponse.json({ received: true, processed: true });
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      // Unhandled event type — safe to ignore
      break;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const { firebaseUid, targetPlan, billingCycle, companyId } = session.metadata ?? {};
  if (!firebaseUid || !targetPlan) return;

  const plan = targetPlan as PlanId;
  const cycle = (billingCycle ?? 'monthly') as 'monthly' | 'yearly';

  // Compute expiry: 1 month or 1 year from now
  const expiresAt = new Date();
  if (cycle === 'yearly') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  if (companyId) {
    await Company.updateOne(
      { _id: companyId },
      { $set: { plan, billingCycle: cycle, planExpiresAt: expiresAt, status: 'active', isActive: true } }
    );
  } else {
    await User.updateOne(
      { firebaseUid },
      { $set: { plan, billingCycle: cycle, planExpiresAt: expiresAt } }
    );
  }

  logLimitEvent({
    firebaseUid,
    ...(companyId ? { companyId } : {}),
    event: 'plan_activated',
    feature: 'plan',
    plan: targetPlan,
    meta: { cycle, via: 'stripe_checkout', sessionId: session.id },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  // Find the user by Stripe customer ID stored in metadata
  // (We store it on first checkout via customer_email lookup)
  const customerId = subscription.customer as string;

  // Get price ID from first item
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) return;

  const plan = stripePriceToplan(priceId);
  if (!plan) return;

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const periodEnd = (subscription as unknown as Record<string, unknown>).current_period_end;
  const currentPeriodEnd = periodEnd ? new Date((periodEnd as number) * 1000) : null;

  // Update user by stripeCustomerId (stored in User when checkout completed)
  await User.updateOne(
    { stripeCustomerId: customerId },
    { $set: { plan: isActive ? plan : 'free', planExpiresAt: currentPeriodEnd } }
  );

  // Also update company if one matches
  await Company.updateOne(
    { stripeCustomerId: customerId },
    {
      $set: {
        plan: isActive ? plan : 'free',
        planExpiresAt: currentPeriodEnd,
        status: isActive ? 'active' : 'suspended',
      },
    }
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  await User.updateOne(
    { stripeCustomerId: customerId },
    { $set: { plan: 'free', planExpiresAt: null } }
  );

  await Company.updateOne(
    { stripeCustomerId: customerId },
    { $set: { plan: 'free', planExpiresAt: null, status: 'canceled' } }
  );
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  // Grace period: don't immediately downgrade — just mark as suspended.
  // On next webhook (subscription.deleted) we downgrade fully.
  await Company.updateOne(
    { stripeCustomerId: customerId },
    { $set: { status: 'suspended' } }
  );

  logLimitEvent({
    firebaseUid: 'stripe_' + customerId,
    event: 'plan_expired',
    feature: 'billing',
    plan: 'unknown',
    meta: { customerId, invoiceId: (invoice as { id?: string }).id },
  });
}
