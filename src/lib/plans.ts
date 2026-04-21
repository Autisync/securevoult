/**
 * Plan definitions and limits for SecureVoult.
 *
 * This file is the single source of truth for what each plan includes.
 * Import from both client and server — no server-only code here.
 */

// ── Plan types ────────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro' | 'company' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

// ── Pricing ────────────────────────────────────────────────────────────────────

export const PLAN_PRICING: Record<PlanId, {
  monthly: number;   // GBP
  yearly: number;    // GBP per year
  perUser?: boolean; // true = price is per user
  custom?: boolean;  // true = contact for pricing
}> = {
  free:       { monthly: 0,  yearly: 0 },
  pro:        { monthly: 6,  yearly: 58  },  // £6/mo or £58/year (≈£4.83/mo, 20% off)
  company:    { monthly: 8,  yearly: 77, perUser: true }, // £8/user/mo or £77/user/year
  enterprise: { monthly: 0,  yearly: 0, custom: true },
};

export function getYearlyDiscount(plan: PlanId): number {
  const p = PLAN_PRICING[plan];
  if (p.custom || p.monthly === 0) return 0;
  const monthlyAnnual = p.monthly * 12;
  if (monthlyAnnual === 0) return 0;
  return Math.round(((monthlyAnnual - p.yearly) / monthlyAnnual) * 100);
}

// ── Plan limits ────────────────────────────────────────────────────────────────

export interface PlanLimits {
  maxEntries: number;          // -1 = unlimited
  maxDevices: number;          // -1 = unlimited
  maxPasskeys: number;         // -1 = unlimited; 0 = passkeys not allowed
  maxCompanyUsers: number;     // -1 = unlimited; 0 = no company access
  maxMonitoredEmails: number;  // -1 = unlimited; number of emails tracked in exposure monitoring
  maxBreachScansPerDay: number;// -1 = unlimited; 0 = no on-demand scans
  breachHistoryDays: number;   // 0 = no history; -1 = forever
  breachMonitoring: boolean;   // basic HIBP k-anon password check
  breachHistory: boolean;      // persistent breach findings storage
  pasteMonitoring: boolean;    // HIBP paste API
  passkeys: boolean;           // WebAuthn passkeys
  extensionSync: boolean;      // browser extension sync
  mobileSync: boolean;         // mobile app sync
  adminPanel: boolean;         // admin dashboard access
  companyFeatures: boolean;    // company/team features
  auditLogs: boolean;          // audit trail
  sessionControl: boolean;     // session revocation
  prioritySupport: boolean;
  ssoReady: boolean;           // SSO placeholder
  apiAccess: boolean;
  securityPolicies: boolean;
  advancedReports: boolean;
  incidentTracking: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxEntries:            50,
    maxDevices:            2,
    maxPasskeys:           0,
    maxCompanyUsers:       0,
    maxMonitoredEmails:    1,
    maxBreachScansPerDay:  3,
    breachHistoryDays:     0,
    breachMonitoring:      true,   // HIBP k-anon only (free API)
    breachHistory:         false,
    pasteMonitoring:       false,
    passkeys:              false,
    extensionSync:         false,
    mobileSync:            false,
    adminPanel:            false,
    companyFeatures:       false,
    auditLogs:             false,
    sessionControl:        false,
    prioritySupport:       false,
    ssoReady:              false,
    apiAccess:             false,
    securityPolicies:      false,
    advancedReports:       false,
    incidentTracking:      false,
  },
  pro: {
    maxEntries:            -1,
    maxDevices:            -1,
    maxPasskeys:           5,
    maxCompanyUsers:       0,
    maxMonitoredEmails:    5,
    maxBreachScansPerDay:  -1,
    breachHistoryDays:     90,
    breachMonitoring:      true,
    breachHistory:         true,
    pasteMonitoring:       true,
    passkeys:              true,
    extensionSync:         true,
    mobileSync:            true,
    adminPanel:            false,
    companyFeatures:       false,
    auditLogs:             false,
    sessionControl:        true,
    prioritySupport:       true,
    ssoReady:              false,
    apiAccess:             false,
    securityPolicies:      false,
    advancedReports:       true,
    incidentTracking:      false,
  },
  company: {
    maxEntries:            -1,
    maxDevices:            -1,
    maxPasskeys:           -1,
    maxCompanyUsers:       -1,
    maxMonitoredEmails:    -1,
    maxBreachScansPerDay:  -1,
    breachHistoryDays:     -1,
    breachMonitoring:      true,
    breachHistory:         true,
    pasteMonitoring:       true,
    passkeys:              true,
    extensionSync:         true,
    mobileSync:            true,
    adminPanel:            true,
    companyFeatures:       true,
    auditLogs:             true,
    sessionControl:        true,
    prioritySupport:       true,
    ssoReady:              false,
    apiAccess:             false,
    securityPolicies:      true,
    advancedReports:       true,
    incidentTracking:      true,
  },
  enterprise: {
    maxEntries:            -1,
    maxDevices:            -1,
    maxPasskeys:           -1,
    maxCompanyUsers:       -1,
    maxMonitoredEmails:    -1,
    maxBreachScansPerDay:  -1,
    breachHistoryDays:     -1,
    breachMonitoring:      true,
    breachHistory:         true,
    pasteMonitoring:       true,
    passkeys:              true,
    extensionSync:         true,
    mobileSync:            true,
    adminPanel:            true,
    companyFeatures:       true,
    auditLogs:             true,
    sessionControl:        true,
    prioritySupport:       true,
    ssoReady:              true,
    apiAccess:             true,
    securityPolicies:      true,
    advancedReports:       true,
    incidentTracking:      true,
  },
};

// ── Plan metadata (for UI) ────────────────────────────────────────────────────

export interface PlanMeta {
  id: PlanId;
  name: string;
  tagline: string;
  badge?: string;         // e.g. 'Most popular'
  color: string;          // tailwind class
  features: string[];     // marketing feature bullets
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For personal use to get started',
    color: 'text-muted-foreground',
    features: [
      'Up to 50 vault entries',
      'Password breach check (k-anonymity)',
      'AES-256 zero-knowledge encryption',
      'Up to 2 devices',
      'Basic password generator',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For power users who need everything',
    badge: 'Most popular',
    color: 'text-blue-400',
    features: [
      'Unlimited vault entries',
      'Full exposure intelligence',
      'Passkey / biometric login',
      'Browser extension + mobile sync',
      'Unlimited devices',
      'Password health reports',
      'Session control',
      'Priority support',
    ],
  },
  company: {
    id: 'company',
    name: 'Company',
    tagline: 'For teams that take security seriously',
    color: 'text-violet-400',
    features: [
      'Everything in Pro, per user',
      'Company admin dashboard',
      'Team breach monitoring',
      'Incident tracking',
      'Audit logs',
      'Security policy enforcement',
      'Session management across team',
      'Company-wide security reports',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organisations with custom needs',
    color: 'text-amber-400',
    features: [
      'Everything in Company',
      'SSO integration (SAML/OIDC)',
      'API access',
      'Advanced security policies',
      'Dedicated support & SLA',
      'Custom onboarding',
      'Compliance reporting',
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatPrice(plan: PlanId, cycle: BillingCycle, userCount = 1): string {
  const p = PLAN_PRICING[plan];
  if (p.custom) return 'Custom';
  const base = cycle === 'yearly' ? p.yearly / 12 : p.monthly;
  if (base === 0) return 'Free';
  const total = base * (p.perUser ? userCount : 1);
  return `£${total.toFixed(0)}/mo`;
}
