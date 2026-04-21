/**
 * Entitlement resolver — single source of truth for what a user can do.
 *
 * Resolves the *effective* plan:
 *   - Company member  → company plan (if company is active)
 *   - Individual      → user plan (if not expired)
 *   - Global admin    → enterprise-level access regardless of personal plan
 *
 * Returns a typed `Entitlements` object consumed by:
 *   - API routes (server-side enforcement)
 *   - React contexts (UI gating)
 *   - Admin dashboards
 *
 * Server-only file: imports Mongoose models and connectDB.
 * Do NOT import from client-side code.
 */
import { PlanId, PlanLimits, PLAN_LIMITS } from '@/lib/plans';
import connectDB from '@/lib/db-connect';
import { User, Company } from '@/lib/models';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountScope =
  | 'personal'        // individual user, no company
  | 'company_member'  // member of a company, no admin rights
  | 'company_admin'   // company owner or companyAdmin role
  | 'global_admin';   // platform-level admin

export interface Entitlements {
  /** Firebase UID of the resolved user */
  uid: string;
  /** Effective plan that applies to this user (may come from their company) */
  effectivePlan: PlanId;
  /** Where the plan comes from */
  planSource: 'personal' | 'company';
  /** All feature limits for the effective plan */
  limits: PlanLimits;
  /** Scope of this user in the platform */
  scope: AccountScope;
  /** MongoDB _id of the company this user belongs to (if any) */
  companyId?: string;
  /** Whether the account/company is currently active (not suspended/canceled) */
  isActive: boolean;
  /** Whether the user/company is within a trial period */
  isTrial: boolean;
  /** Trial end date (present only if isTrial=true) */
  trialEndsAt?: Date;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolve the full entitlement set for a verified Firebase UID.
 *
 * Requires a database connection — call server-side only.
 * Always resolves (never throws): unknown users get minimal free entitlements.
 */
export async function resolveEntitlements(firebaseUid: string): Promise<Entitlements> {
  try {
    await connectDB();
  } catch {
    // DB unavailable — return minimal safe defaults so we fail-closed on features
    return makeEntitlements(firebaseUid, 'free', 'personal', 'personal', null, false, false);
  }

  const dbUser = await User.findOne({ firebaseUid })
    .select('role plan billingCycle planExpiresAt companyId isActive trialEndsAt')
    .lean<{
      role: string;
      plan: PlanId;
      planExpiresAt?: Date | null;
      companyId?: { toString(): string } | null;
      isActive: boolean;
      trialEndsAt?: Date | null;
    }>();

  if (!dbUser) {
    return makeEntitlements(firebaseUid, 'free', 'personal', 'personal', null, true, false);
  }

  // ── Global admin ──────────────────────────────────────────────────────────
  // Admins always get enterprise-level access so they can manage everything.
  if (dbUser.role === 'admin') {
    return makeEntitlements(
      firebaseUid, 'enterprise', 'personal', 'global_admin', null, true, false,
    );
  }

  // ── Company member ────────────────────────────────────────────────────────
  if (dbUser.companyId) {
    const company = await Company.findById(dbUser.companyId)
      .select('plan status isActive planExpiresAt trialEndsAt ownerFirebaseUid maxSeats')
      .lean<{
        plan: PlanId;
        status?: string;
        isActive: boolean;
        planExpiresAt?: Date | null;
        trialEndsAt?: Date | null;
        ownerFirebaseUid: string;
        maxSeats: number;
      }>();

    if (company) {
      const companyStatus = company.status ?? 'active';
      const companyActive =
        company.isActive &&
        companyStatus !== 'suspended' &&
        companyStatus !== 'canceled' &&
        (!company.planExpiresAt || company.planExpiresAt > new Date());

      const effectivePlan: PlanId = companyActive ? company.plan : 'free';
      const isTrial = companyStatus === 'trial';

      const isOwnerOrAdmin =
        company.ownerFirebaseUid === firebaseUid || dbUser.role === 'companyAdmin';
      const scope: AccountScope = isOwnerOrAdmin ? 'company_admin' : 'company_member';

      return makeEntitlements(
        firebaseUid,
        effectivePlan,
        'company',
        scope,
        String(dbUser.companyId),
        companyActive,
        isTrial,
        company.trialEndsAt ?? undefined,
      );
    }
  }

  // ── Personal account ──────────────────────────────────────────────────────
  const planActive =
    !dbUser.planExpiresAt || dbUser.planExpiresAt > new Date();
  const effectivePlan: PlanId = planActive ? dbUser.plan : 'free';
  const isTrial = !!(dbUser.trialEndsAt && dbUser.trialEndsAt > new Date());

  return makeEntitlements(
    firebaseUid,
    effectivePlan,
    'personal',
    'personal',
    null,
    dbUser.isActive,
    isTrial,
    dbUser.trialEndsAt ?? undefined,
  );
}

// ── Response helpers ──────────────────────────────────────────────────────────

/**
 * Build a structured 422/403 payload for plan-enforcement responses.
 * Safe to expose to clients — contains no internal billing data.
 *
 * Usage:
 *   return NextResponse.json(
 *     planLimitPayload({ feature: 'entries', currentPlan: 'free', currentUsage: 51, allowedLimit: 50, upgradeTo: 'pro' }),
 *     { status: 422 }
 *   );
 */
export function planLimitPayload(opts: {
  feature: string;
  currentPlan: PlanId;
  currentUsage?: number;
  allowedLimit?: number | null;
  upgradeTo?: PlanId;
  message?: string;
}): Record<string, unknown> {
  return {
    error: opts.message ?? `Your ${opts.currentPlan} plan does not allow this action.`,
    upgradeRequired: true,
    feature: opts.feature,
    currentPlan: opts.currentPlan,
    ...(opts.currentUsage !== undefined ? { currentUsage: opts.currentUsage } : {}),
    ...(opts.allowedLimit !== undefined && opts.allowedLimit !== null
      ? { allowedLimit: opts.allowedLimit }
      : {}),
    ...(opts.upgradeTo ? { upgradeTo: opts.upgradeTo } : {}),
  };
}

// ── Internal helper ───────────────────────────────────────────────────────────

function makeEntitlements(
  uid: string,
  plan: PlanId,
  planSource: 'personal' | 'company',
  scope: AccountScope,
  companyId: string | null,
  isActive: boolean,
  isTrial: boolean,
  trialEndsAt?: Date,
): Entitlements {
  return {
    uid,
    effectivePlan: plan,
    planSource,
    limits: PLAN_LIMITS[plan],
    scope,
    ...(companyId ? { companyId } : {}),
    isActive,
    isTrial,
    ...(trialEndsAt ? { trialEndsAt } : {}),
  };
}
