/**
 * Downgrade cleanup handler — SecureVoult
 *
 * When a user or company is downgraded to a lower plan, this module
 * applies server-side enforcement to ensure they no longer exceed the
 * new plan's limits. It does NOT delete user data — it gates access.
 *
 * Philosophy:
 *   - We never silently delete user credentials during a downgrade.
 *   - Data beyond the new limit is preserved but inaccessible until
 *     the user either removes excess items or re-upgrades.
 *   - The next time the user tries to add a new item that would exceed
 *     the limit, the normal feature gates reject the request.
 *
 * What this handler does actively on downgrade:
 *   1. Records an audit log entry for the plan change.
 *   2. Suspends pending invites that would put the company over the new seat limit.
 *   3. (Passkeys) No deletion — existing credentials continue to work;
 *      new registrations are blocked by the passkey feature gate.
 *   4. (Monitored emails) No deletion — the breach-monitor gate already
 *      limits scans; over-limit emails are preserved but not actively scanned.
 *   5. Logs a LimitEvent for auditing.
 *
 * Server-only: imports Mongoose models and connectDB.
 */

import { PlanId, PLAN_LIMITS } from '@/lib/plans';
import connectDB from '@/lib/db-connect';
import { User, Company, CompanyInvite, AdminActivity } from '@/lib/models';
import { logLimitEvent } from '@/lib/limit-logger';

export interface DowngradeResult {
  /** Whether any cleanup actions were taken */
  actionsPerformed: string[];
  /** Number of pending invites that were canceled due to seat limit reduction */
  invitesCanceled: number;
  /** Whether passkeys are blocked on the new plan */
  passkeysBlocked: boolean;
  /** Whether breach history is restricted on the new plan */
  breachHistoryRestricted: boolean;
  /** Whether SSO is no longer available on the new plan */
  ssoRevoked: boolean;
}

/**
 * Called server-side whenever a user's or company's plan is downgraded.
 *
 * @param firebaseUid  — UID of the user who triggered or is subject to the downgrade
 * @param fromPlan     — the plan being left
 * @param toPlan       — the plan being entered
 * @param companyId    — if this is a company downgrade, the company's MongoDB _id string
 */
export async function handlePlanDowngrade(
  firebaseUid: string,
  fromPlan: PlanId,
  toPlan: PlanId,
  companyId?: string
): Promise<DowngradeResult> {
  const actions: string[] = [];
  let invitesCanceled = 0;

  try {
    await connectDB();
  } catch {
    // If DB is down we still return a result — the next request will enforce limits
    return {
      actionsPerformed: ['db_unavailable'],
      invitesCanceled: 0,
      passkeysBlocked: PLAN_LIMITS[toPlan].maxPasskeys === 0,
      breachHistoryRestricted: !PLAN_LIMITS[toPlan].breachHistory,
      ssoRevoked: !PLAN_LIMITS[toPlan].ssoReady,
    };
  }

  const fromLimits = PLAN_LIMITS[fromPlan];
  const toLimits = PLAN_LIMITS[toPlan];

  // ── 1. Company seat limit reduction ────────────────────────────────────────
  if (companyId) {
    const newMaxSeats = toLimits.maxCompanyUsers;
    if (newMaxSeats !== -1) {
      const currentSeats = await User.countDocuments({ companyId });
      if (currentSeats > newMaxSeats) {
        // Cancel pending invites to stop the overage growing
        const cancelResult = await CompanyInvite.updateMany(
          { companyId, status: 'pending' },
          { $set: { status: 'canceled' } }
        );
        invitesCanceled = cancelResult.modifiedCount;
        if (invitesCanceled > 0) {
          actions.push(`canceled_${invitesCanceled}_pending_invites`);
        }
      }

      // Update the company's maxSeats to the new plan limit
      await Company.updateOne(
        { _id: companyId },
        { $set: { maxSeats: newMaxSeats, plan: toPlan } }
      );
      actions.push('updated_company_max_seats');
    }
  }

  // ── 2. SSO revocation ──────────────────────────────────────────────────────
  const ssoRevoked = fromLimits.ssoReady && !toLimits.ssoReady;
  if (ssoRevoked) {
    // We don't delete the SSO config — the admin may re-upgrade.
    // The API gates will reject SSO requests for the new plan.
    actions.push('sso_access_revoked_by_plan_gate');
  }

  // ── 3. Passkey access ──────────────────────────────────────────────────────
  const passkeysBlocked = toLimits.maxPasskeys === 0;
  if (fromLimits.passkeys && passkeysBlocked) {
    // Existing passkey credentials are preserved.
    // New registrations will be blocked by canRegisterMorePasskeys gate.
    // For security, we do NOT delete existing passkeys — user must do so manually.
    actions.push('new_passkey_registrations_blocked_by_plan_gate');
  }

  // ── 4. Breach history restriction ─────────────────────────────────────────
  const breachHistoryRestricted = fromLimits.breachHistory && !toLimits.breachHistory;
  if (breachHistoryRestricted) {
    actions.push('breach_history_hidden_by_plan_gate');
  }

  // ── 5. Audit log ───────────────────────────────────────────────────────────
  logLimitEvent({
    firebaseUid,
    companyId,
    event: 'plan_changed',
    feature: 'plan_downgrade',
    plan: toPlan,
    meta: { fromPlan, toPlan, actions, invitesCanceled },
  });

  try {
    await AdminActivity.create({
      actorUid: firebaseUid,
      action: 'plan_changed',
      targetType: companyId ? 'company' : 'user',
      targetId: companyId ?? firebaseUid,
      details: `Plan downgraded from ${fromPlan} to ${toPlan}.`,
      metadata: { fromPlan, toPlan, invitesCanceled, ssoRevoked, passkeysBlocked },
    });
  } catch {
    // Non-fatal — audit log failure does not block the downgrade
  }

  return {
    actionsPerformed: actions,
    invitesCanceled,
    passkeysBlocked,
    breachHistoryRestricted,
    ssoRevoked,
  };
}
