/**
 * Feature gate helpers.
 *
 * Use these on both client and server to check what a user or company can do.
 * Import `PLAN_LIMITS` to avoid hardcoding plan names in feature checks.
 *
 * Usage:
 *   import { canUsePasskeys, canAddMoreEntries } from '@/lib/feature-gates';
 *   if (!canUsePasskeys(plan)) showUpgradePrompt('passkeys');
 */

import { PlanId, PLAN_LIMITS } from '@/lib/plans';

// ── User-level gates ──────────────────────────────────────────────────────────

export function canUsePasskeys(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].passkeys;
}

export function canUseBreachMonitoring(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].breachMonitoring;
}

export function canUseBreachHistory(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].breachHistory;
}

export function canUsePasteMonitoring(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].pasteMonitoring;
}

export function canUseExtensionSync(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].extensionSync;
}

export function canUseMobileSync(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].mobileSync;
}

export function canUseSessionControl(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].sessionControl;
}

export function canUseAdvancedReports(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].advancedReports;
}

export function canUsePrioritySupport(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].prioritySupport;
}

// ── Entry limits ──────────────────────────────────────────────────────────────

export function canAddMoreEntries(plan: PlanId, currentCount: number): boolean {
  const limit = PLAN_LIMITS[plan].maxEntries;
  if (limit === -1) return true;
  return currentCount < limit;
}

export function getEntryLimit(plan: PlanId): number | null {
  const limit = PLAN_LIMITS[plan].maxEntries;
  return limit === -1 ? null : limit;
}

export function getEntriesUsagePercent(plan: PlanId, currentCount: number): number {
  const limit = PLAN_LIMITS[plan].maxEntries;
  if (limit === -1) return 0;
  return Math.min(100, Math.round((currentCount / limit) * 100));
}

// ── Device limits ─────────────────────────────────────────────────────────────

export function canAddMoreDevices(plan: PlanId, currentCount: number): boolean {
  const limit = PLAN_LIMITS[plan].maxDevices;
  if (limit === -1) return true;
  return currentCount < limit;
}

// ── Passkey limits ────────────────────────────────────────────────────────────

export function canRegisterMorePasskeys(plan: PlanId, currentCount: number): boolean {
  const limit = PLAN_LIMITS[plan].maxPasskeys;
  if (limit === -1) return true;
  if (limit === 0) return false;
  return currentCount < limit;
}

export function getPasskeyLimit(plan: PlanId): number | null {
  const limit = PLAN_LIMITS[plan].maxPasskeys;
  return limit === -1 ? null : limit;
}

// ── Exposure monitoring limits ────────────────────────────────────────────────

export function canMonitorMoreEmails(plan: PlanId, currentCount: number): boolean {
  const limit = PLAN_LIMITS[plan].maxMonitoredEmails;
  if (limit === -1) return true;
  return currentCount < limit;
}

export function canRunBreachScan(plan: PlanId, scansUsedToday: number): boolean {
  const limit = PLAN_LIMITS[plan].maxBreachScansPerDay;
  if (limit === -1) return true;
  if (limit === 0) return false;
  return scansUsedToday < limit;
}

export function getBreachHistoryDays(plan: PlanId): number {
  return PLAN_LIMITS[plan].breachHistoryDays;
}

// ── Company seat limits ───────────────────────────────────────────────────────

export function canAddCompanySeat(maxSeats: number, currentSeats: number): boolean {
  if (maxSeats === -1) return true;
  return currentSeats < maxSeats;
}

// ── Admin / company gates ─────────────────────────────────────────────────────

export function canAccessAdminPanel(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].adminPanel;
}

export function canUseCompanyFeatures(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].companyFeatures;
}

export function canUseAuditLogs(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].auditLogs;
}

export function canUseIncidentTracking(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].incidentTracking;
}

export function canUseSecurityPolicies(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].securityPolicies;
}

export function canUseSSO(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].ssoReady;
}

export function canUseAPIAccess(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].apiAccess;
}

// ── Server-side gate helpers ──────────────────────────────────────────────────
// These accept a raw role string so they can be used without the full User object.

export function isGlobalAdmin(role: string): boolean {
  return role === 'admin';
}

export function isCompanyAdmin(role: string): boolean {
  return role === 'companyAdmin' || role === 'admin';
}

// ── Upgrade prompts ───────────────────────────────────────────────────────────

export type UpgradeFeature =
  | 'passkeys'
  | 'breach_history'
  | 'paste_monitoring'
  | 'extension_sync'
  | 'mobile_sync'
  | 'session_control'
  | 'entries_limit'
  | 'advanced_reports'
  | 'company_features'
  | 'audit_logs'
  | 'incident_tracking';

export interface UpgradePrompt {
  title: string;
  description: string;
  cta: string;
  targetPlan: PlanId;
}

export const UPGRADE_PROMPTS: Record<UpgradeFeature, UpgradePrompt> = {
  passkeys: {
    title: 'Passkeys require Pro',
    description: 'Upgrade to Pro to enable biometric / device passkey login.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  breach_history: {
    title: 'Breach history requires Pro',
    description: 'Upgrade to Pro to save and track your breach findings over time.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  paste_monitoring: {
    title: 'Paste monitoring requires Pro',
    description: 'Upgrade to Pro to check if your email appears in paste dumps.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  extension_sync: {
    title: 'Extension sync requires Pro',
    description: 'Upgrade to Pro to sync your vault across browsers with the extension.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  mobile_sync: {
    title: 'Mobile sync requires Pro',
    description: 'Upgrade to Pro to access your vault on mobile devices.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  session_control: {
    title: 'Session control requires Pro',
    description: 'Upgrade to Pro to see and revoke active sessions on any device.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  entries_limit: {
    title: 'Free plan limit reached',
    description: 'You\'ve reached the 50-entry limit. Upgrade to Pro for unlimited entries.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  advanced_reports: {
    title: 'Advanced reports require Pro',
    description: 'Upgrade to Pro to access full security health reports.',
    cta: 'Upgrade to Pro',
    targetPlan: 'pro',
  },
  company_features: {
    title: 'Company plan required',
    description: 'This feature is available on the Company plan for teams.',
    cta: 'Upgrade to Company',
    targetPlan: 'company',
  },
  audit_logs: {
    title: 'Audit logs require Company plan',
    description: 'Upgrade to Company to access full audit trail and compliance logs.',
    cta: 'Upgrade to Company',
    targetPlan: 'company',
  },
  incident_tracking: {
    title: 'Incident tracking requires Company plan',
    description: 'Upgrade to Company to track and manage security incidents.',
    cta: 'Upgrade to Company',
    targetPlan: 'company',
  },
};
