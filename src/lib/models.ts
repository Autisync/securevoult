import mongoose from 'mongoose';

/**
 * User — identity record, sourced from Firebase Auth.
 * Account authentication is handled entirely by Firebase.
 * No password hashes are stored here.
 */
const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, default: '' },
    photoURL: { type: String, default: '' },
    provider: {
      type: String,
      enum: ['password', 'google.com'],
      default: 'password',
    },
    emailVerified: { type: Boolean, default: false },
    /**
     * role:
     *   'user'         — regular vault user, no admin access
     *   'companyAdmin' — scoped admin for their own company only
     *   'admin'        — global admin, full platform access
     */
    role: { type: String, enum: ['user', 'companyAdmin', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    /** Optional company association. Null = individual/personal account. */
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    /** Trial end date for personal Pro trial. Null = no active trial. */
    trialEndsAt: { type: Date, default: null },
    /**
     * Set by admin scan-all trigger. The client vault checks this timestamp
     * and prompts the user to run their Security Center re-scan.
     */
    rescanRequestedAt: { type: Date, default: null },
    /**
     * Subscription plan for individual (non-company) accounts.
     * For company members, effective plan = company.plan.
     */
    plan: {
      type: String,
      enum: ['free', 'pro', 'company', 'enterprise'],
      default: 'free',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    /** ISO date — when the current plan expires (null = active / free). */
    planExpiresAt: { type: Date, default: null },
    /** Stripe customer ID — populated after first successful checkout. */
    stripeCustomerId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

/**
 * Vault — one encrypted blob per user.
 * The server never sees plaintext; it stores only the encrypted payload.
 */
const vaultSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true }, // firebaseUid
    encryptedVault: { type: String, default: '' }, // base64/hex-encoded AES-GCM ciphertext
    version: { type: Number, default: 1 },
    lastSync: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/**
 * AdminActivity — append-only audit log for privileged actions.
 */
const adminActivitySchema = new mongoose.Schema({
  adminFirebaseUid: { type: String, required: true, index: true },
  action: {
    type: String,
    required: true,
    enum: [
      'user_created', 'user_updated', 'user_deleted', 'user_suspended',
      'vault_accessed', 'vault_modified', 'password_reset',
      'permission_granted', 'permission_revoked',
      // Plan / billing events
      'limit_reached', 'upgrade_prompted', 'plan_changed', 'trial_started',
      'trial_expired', 'passkey_denied', 'scan_denied', 'seat_limit_reached',
      'downgrade_blocked', 'member_added', 'member_removed', 'member_role_changed',
    ],
  },
  targetFirebaseUid: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
});

/**
 * Session — per-device/client session registry.
 *
 * One document per active session.  Revoke by setting isRevoked=true or
 * deleting the document.  The server should check isRevoked on vault
 * reads/writes once full session enforcement is added.
 */
const sessionSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, index: true },
    /** Opaque identifier derived from the Firebase ID token `jti` claim. */
    sessionId: { type: String, required: true, unique: true, index: true },
    clientType: {
      type: String,
      enum: ['web', 'extension', 'mobile'],
      default: 'web',
    },
    /** Human-readable platform string, e.g. "Chrome 124 / macOS". */
    userAgent: { type: String, default: '' },
    /** IP address at session creation time. */
    ipAddress: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-expire revoked or stale sessions after 90 days of inactivity.
sessionSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/**
 * Company / Tenant — represents an organisation using the platform.
 * A user can belong to one company (optional; null = individual account).
 */
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerFirebaseUid: { type: String, required: true, index: true },
    plan: { type: String, enum: ['free', 'pro', 'company', 'enterprise'], default: 'free' },
    /**
     * Lifecycle status:
     *   active   — paid/active subscription
     *   trial    — within trial window
     *   suspended — payment failed / manually suspended
     *   canceled  — account closed, read-only
     */
    status: {
      type: String,
      enum: ['active', 'trial', 'suspended', 'canceled'],
      default: 'active',
    },
    isActive: { type: Boolean, default: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    /** Maximum seats (users) for the company plan. -1 = unlimited. */
    maxSeats: { type: Number, default: -1 },
    /** When the current plan expires (null = active / free). */
    planExpiresAt: { type: Date, default: null },
    /** End of trial window — null when not in trial. */
    trialEndsAt: { type: Date, default: null },
    /** Stripe customer ID — populated after first successful checkout. */
    stripeCustomerId: { type: String, default: null, index: true },
    /** Internal notes left by general admins — never shown to company members. */
    adminNotes: [
      {
        authorUid: { type: String, required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/**
 * BreachFinding — a record of a detected exposure for a specific user+entry.
 *
 * The server never stores plaintext passwords; the breach check is performed
 * client-side using HIBP k-anonymity. Only metadata is persisted here.
 */
const breachFindingSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    /** Opaque reference to a vault entry — matches PasswordEntry.id on the client. */
    entryId: { type: String, required: true },
    entryLabel: { type: String, default: '' },
    entryUrl: { type: String, default: '' },
    breachType: {
      type: String,
      enum: ['password_exposed', 'email_exposed', 'credential_reuse', 'stale_password'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'high',
    },
    status: {
      type: String,
      enum: ['new', 'investigating', 'resolved', 'ignored', 'false_positive'],
      default: 'new',
    },
    /** How many times this credential appeared in HIBP (0 = other finding type). */
    hibpCount: { type: Number, default: 0 },
    firstDetectedAt: { type: Date, default: Date.now },
    lastCheckedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    notes: [
      {
        authorUid: { type: String, required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
breachFindingSchema.index({ firebaseUid: 1, entryId: 1 });

/**
 * Incident / Resolution Item — actionable issue requiring admin attention.
 */
const incidentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'breach', 'suspicious_login', 'sync_failure', 'admin_role_change',
        'session_anomaly', 'health_degraded', 'misconfiguration',
        'support_flag', 'other',
      ],
      required: true,
    },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    status: {
      type: String,
      enum: ['open', 'investigating', 'waiting', 'resolved', 'dismissed'],
      default: 'open',
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    affectedUserUid: { type: String, default: null },
    affectedUserEmail: { type: String, default: null },
    assignedToUid: { type: String, default: null },
    /** Optional link to a BreachFinding document. */
    breachFindingId: { type: mongoose.Schema.Types.ObjectId, ref: 'BreachFinding', default: null },
    description: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    timeline: [
      {
        actorUid: { type: String, required: true },
        actorEmail: { type: String, default: '' },
        action: { type: String, required: true },
        note: { type: String, default: '' },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
incidentSchema.index({ status: 1, severity: 1, createdAt: -1 });
incidentSchema.index({ companyId: 1, status: 1 });

// Export models (guard against hot-reload re-registration)
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Vault = mongoose.models.Vault || mongoose.model('Vault', vaultSchema);
export const AdminActivity =
  mongoose.models.AdminActivity || mongoose.model('AdminActivity', adminActivitySchema);
export const Session =
  mongoose.models.Session || mongoose.model('Session', sessionSchema);
export const Company =
  mongoose.models.Company || mongoose.model('Company', companySchema);
export const BreachFinding =
  mongoose.models.BreachFinding || mongoose.model('BreachFinding', breachFindingSchema);
export const Incident =
  mongoose.models.Incident || mongoose.model('Incident', incidentSchema);

/**
 * PasskeyCredential — stores a WebAuthn public-key credential per user.
 * One user may register multiple credentials (e.g. phone + laptop).
 * The server stores the public key; the private key never leaves the device.
 */
const passkeyCredentialSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true },
    /** Raw base64url-encoded credential ID from the authenticator. */
    credentialId: { type: String, required: true, unique: true, index: true },
    /** COSE-encoded public key bytes, stored as base64url. */
    publicKey: { type: String, required: true },
    /** Human-readable device name set at registration time. */
    deviceName: { type: String, default: 'Passkey' },
    /** Supported transport hints: ['usb','nfc','ble','internal','hybrid']. */
    transports: [{ type: String }],
    /** Signature counter — used to detect credential cloning (replay attacks). */
    counter: { type: Number, default: 0 },
    /** RP ID used during registration — must match during authentication. */
    rpId: { type: String, required: true },
    /** Whether this credential can be used for user-presence-only (UV=false). */
    userVerification: { type: String, enum: ['required', 'preferred', 'discouraged'], default: 'preferred' },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
passkeyCredentialSchema.index({ firebaseUid: 1 });

export const PasskeyCredential =
  mongoose.models.PasskeyCredential ||
  mongoose.model('PasskeyCredential', passkeyCredentialSchema);

/**
 * WebAuthnChallenge — short-lived server challenge used during registration and
 * authentication ceremonies. Deleted immediately after use to prevent replay.
 * TTL index auto-expires stale challenges after 5 minutes.
 */
const webAuthnChallengeSchema = new mongoose.Schema({
  challenge: { type: String, required: true, unique: true, index: true },
  /** 'registration' or 'authentication' */
  type: { type: String, required: true, enum: ['registration', 'authentication'] },
  /** For authentication: which user is being authenticated (optional; allows usernameless flow). */
  firebaseUid: { type: String, default: null },
  /** For registration: the userId bytes (base64url) embedded in the credential. */
  userIdBytes: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
// Auto-expire after 5 minutes
webAuthnChallengeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

/**
 * LimitEvent — append-only log of plan-limit and gate events.
 *
 * Used for upgrade funnel analytics and admin monitoring.
 * Never store secrets — only metadata about what was blocked/prompted.
 */
const limitEventSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    event: {
      type: String,
      required: true,
      enum: [
        'limit_reached',      // user tried to exceed a numeric limit
        'feature_denied',     // user tried to access a plan-gated feature
        'upgrade_prompted',   // upgrade CTA was shown to user
        'upgrade_intent',     // user clicked upgrade / expressed intent
        'downgrade_warning',  // downgrade would remove active features
        'seat_limit_reached', // company seat cap hit
        'trial_started',
        'trial_expired',
        'plan_activated',
        'plan_expired',
      ],
    },
    /** Which feature or resource triggered the event. */
    feature: { type: String, required: true },
    /** Current plan at the time of the event. */
    plan: { type: String, required: true },
    /** Numeric usage at the time of the event (optional). */
    currentUsage: { type: Number, default: null },
    /** Numeric limit at the time of the event (optional). */
    allowedLimit: { type: Number, default: null },
    /** IP address — for rate/abuse monitoring only. */
    ipAddress: { type: String, default: '' },
    /** Metadata bag — e.g. { upgradeTo: 'pro' }. No secrets. */
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
limitEventSchema.index({ firebaseUid: 1, createdAt: -1 });
limitEventSchema.index({ event: 1, createdAt: -1 });

export const LimitEvent =
  mongoose.models.LimitEvent || mongoose.model('LimitEvent', limitEventSchema);

/**
 * CompanyInvite — a pending invitation for a user to join a company.
 *
 * Invite tokens are single-use, time-limited, and tied to a specific email.
 * When the invitee creates their account (or signs in), they redeem the token
 * to join the company automatically.
 */
const companyInviteSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    /** Firebase UID of the admin who sent the invite. */
    inviterUid: { type: String, required: true },
    /** Target email (lowercase). The invite is only redeemable by this address. */
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    /** Role the invitee will receive upon joining. */
    role: { type: String, enum: ['user', 'companyAdmin'], default: 'user' },
    /**
     * Status:
     *   pending   — awaiting redemption
     *   accepted  — successfully redeemed
     *   declined  — user declined
     *   expired   — TTL elapsed without redemption
     *   canceled  — admin revoked before redemption
     */
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'canceled'],
      default: 'pending',
      index: true,
    },
    /** Cryptographically random token (64 hex chars). */
    token: { type: String, required: true, unique: true, index: true },
    /** When the invite expires (default: 7 days after creation). */
    expiresAt: { type: Date, required: true },
    /** Firebase UID of the user who redeemed the invite (null until accepted). */
    redeemedByUid: { type: String, default: null },
    redeemedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
// Auto-expire expired invites after 30 days of inactivity
companyInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
companyInviteSchema.index({ companyId: 1, email: 1 });

export const CompanyInvite =
  mongoose.models.CompanyInvite || mongoose.model('CompanyInvite', companyInviteSchema);

export const WebAuthnChallenge =
  mongoose.models.WebAuthnChallenge ||
  mongoose.model('WebAuthnChallenge', webAuthnChallengeSchema);

/**
 * SSOConfig — company-level single sign-on configuration.
 *
 * Sensitive fields (oidcClientSecret, samlCert) should be encrypted at rest
 * using a KMS or secrets manager before being stored here.
 */
const ssoConfigSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true, index: true },
    provider: { type: String, enum: ['saml', 'oidc', 'google_workspace', 'azure_ad'], required: true },
    /** SAML configuration fields */
    samlEntryPoint: { type: String, default: null },
    samlIssuer:     { type: String, default: null },
    samlCert:       { type: String, default: null },           // IdP certificate (PEM)
    samlCallbackUrl:{ type: String, default: null },           // ACS URL
    /** OIDC configuration fields */
    oidcDiscoveryUrl: { type: String, default: null },
    oidcClientId:     { type: String, default: null },
    oidcClientSecret: { type: String, default: null },         // store encrypted!
    oidcRedirectUri:  { type: String, default: null },
    /** Google Workspace */
    googleWorkspaceDomain: { type: String, default: null },
    /** Azure AD */
    azureTenantId: { type: String, default: null },
    /** Attribute mapping — JSON object */
    attributeMapping: { type: mongoose.Schema.Types.Mixed, default: {} },
    defaultRole: { type: String, enum: ['user', 'companyAdmin'], default: 'user' },
    allowPasswordFallback: { type: Boolean, default: true },
    jitProvisioning: { type: Boolean, default: true },
    /** UID of the admin who last updated this config */
    updatedByUid: { type: String, default: null },
  },
  { timestamps: true }
);

export const SSOConfig =
  mongoose.models.SSOConfig || mongoose.model('SSOConfig', ssoConfigSchema);