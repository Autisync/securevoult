/**
 * Limit event logger — server-side only.
 *
 * Records plan-limit and feature-gate events to the LimitEvent collection.
 * Always fire-and-forget: never throws, never blocks API responses.
 *
 * Used by vault, passkey, exposure, and other API routes to log when a limit
 * is reached or a feature is denied.
 */
import { LimitEvent } from '@/lib/models';
import connectDB from '@/lib/db-connect';

export interface LimitEventInput {
  firebaseUid: string;
  companyId?: string;
  event:
    | 'limit_reached'
    | 'feature_denied'
    | 'upgrade_prompted'
    | 'upgrade_intent'
    | 'downgrade_warning'
    | 'seat_limit_reached'
    | 'trial_started'
    | 'trial_expired'
    | 'plan_activated'
    | 'plan_expired'
    | 'scan_denied'
    | 'scan_triggered'
    | 'plan_changed';
  feature: string;
  plan: string;
  currentUsage?: number;
  allowedLimit?: number;
  ipAddress?: string;
  meta?: Record<string, unknown>;
}

/**
 * Log a limit/gate event asynchronously.
 * Never throws — failures are silently discarded so the main request is unaffected.
 */
export function logLimitEvent(input: LimitEventInput): void {
  // Fire and forget — do not await
  (async () => {
    try {
      await connectDB();
      await LimitEvent.create({
        firebaseUid: input.firebaseUid,
        ...(input.companyId ? { companyId: input.companyId } : {}),
        event: input.event,
        feature: input.feature,
        plan: input.plan,
        ...(input.currentUsage !== undefined ? { currentUsage: input.currentUsage } : {}),
        ...(input.allowedLimit !== undefined ? { allowedLimit: input.allowedLimit } : {}),
        ipAddress: input.ipAddress ?? '',
        meta: input.meta ?? {},
      });
    } catch {
      // Silently discard — logging failures must never affect the main response
    }
  })();
}
