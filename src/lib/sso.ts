/**
 * Enterprise SSO scaffold — SecureVoult
 *
 * This file provides types, configuration helpers, and the stub integration layer
 * for SAML 2.0 / OIDC / Google Workspace / Azure AD single sign-on.
 *
 * Current status: SCAFFOLD — actual IdP handshake is not implemented.
 * Replace the stub functions with a real SAML/OIDC library (e.g. `passport-saml`,
 * `openid-client`, or a managed IdP service like WorkOS / Auth0 Organizations)
 * when ready to ship enterprise SSO.
 *
 * The gate check (`isSSOAvailable`) already works: it mirrors `ssoReady` in plans.ts.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SSOProvider = 'saml' | 'oidc' | 'google_workspace' | 'azure_ad';

/**
 * Company-level SSO configuration stored in the DB (SSOConfig collection).
 * Sensitive fields (clientSecret, certificate) should be encrypted at rest.
 */
export interface SSOConfig {
  companyId: string;

  /** Which protocol this company uses. */
  provider: SSOProvider;

  /**
   * SAML-specific:
   *   entryPoint       — IdP SSO URL (e.g. https://idp.example.com/sso/saml)
   *   issuer           — SP entity ID (your app URL)
   *   cert             — IdP signing certificate (PEM string, no headers)
   *   callbackUrl      — ACS URL: https://vault.autisync.com/api/sso/callback
   */
  saml?: {
    entryPoint: string;
    issuer: string;
    cert: string;
    callbackUrl: string;
  };

  /**
   * OIDC-specific:
   *   discoveryUrl     — .well-known/openid-configuration endpoint
   *   clientId
   *   clientSecret     — store encrypted; never expose to client
   *   redirectUri      — https://vault.autisync.com/api/sso/callback
   */
  oidc?: {
    discoveryUrl: string;
    clientId: string;
    clientSecret: string;   // encrypted at rest
    redirectUri: string;
  };

  /** Google Workspace domain (e.g. "mycompany.com") */
  googleWorkspaceDomain?: string;

  /** Azure AD tenant ID */
  azureTenantId?: string;

  /**
   * Attribute mapping: maps IdP user attributes to SecureVoult fields.
   * Keys are SecureVoult fields; values are IdP attribute names.
   * Defaults: { email: 'email', displayName: 'name', role: 'role' }
   */
  attributeMapping?: {
    email?: string;
    displayName?: string;
    role?: string;
  };

  /**
   * Default role to assign to users provisioned via SSO who have no role
   * attribute in the IdP assertion.
   */
  defaultRole?: 'user' | 'companyAdmin';

  /** Whether users can bypass SSO and log in with email/password. */
  allowPasswordFallback?: boolean;

  /** Whether new users are automatically provisioned on first SSO login (JIT provisioning). */
  jitProvisioning?: boolean;

  updatedAt?: Date;
  updatedByUid?: string;
}

/**
 * Minimal profile returned after a successful SSO assertion is validated.
 * This is passed to the session-creation logic after IdP verification.
 */
export interface SSOProfile {
  email: string;
  displayName?: string;
  idpUserId?: string;
  groups?: string[];
  rawAttributes?: Record<string, unknown>;
}

// ── Feature gate ──────────────────────────────────────────────────────────────

import { PlanId, PLAN_LIMITS } from '@/lib/plans';

/** Returns true if SSO is available for the given plan. */
export function isSSOAvailable(plan: PlanId): boolean {
  return PLAN_LIMITS[plan].ssoReady;
}

// ── Stub implementation ───────────────────────────────────────────────────────
// Replace these with real SAML/OIDC library calls when shipping enterprise SSO.

/**
 * Initiate SSO login: returns the IdP redirect URL that the user should be
 * sent to. Currently returns a 501 stub payload.
 *
 * @param config  SSO config for the company
 * @param relayState  Opaque value passed through the SSO round-trip (e.g. post-login URL)
 * @returns `{ redirectUrl }` or `{ error }`
 */
export async function initiateSSOLogin(
  config: SSOConfig,
  relayState?: string
): Promise<{ redirectUrl: string } | { error: string; notImplemented: true }> {
  void config; void relayState; // suppress unused-param lint until implemented
  return {
    error: 'SSO login is not yet implemented. Configure a SAML/OIDC library to complete this integration.',
    notImplemented: true,
  };
}

/**
 * Validate an incoming SSO callback (SAML response or OIDC authorization code).
 * Returns the resolved user profile on success.
 *
 * @param config  SSO config for the company
 * @param callbackPayload  Raw POST body (SAML) or { code, state } (OIDC)
 */
export async function validateSSOCallback(
  config: SSOConfig,
  callbackPayload: unknown
): Promise<{ profile: SSOProfile } | { error: string; notImplemented: true }> {
  void config; void callbackPayload;
  return {
    error: 'SSO callback validation is not yet implemented.',
    notImplemented: true,
  };
}

/**
 * Generate SAML Service Provider metadata XML to share with the IdP.
 * Returns a stub XML string until fully implemented.
 */
export function getSPMetadataXML(
  companyId: string,
  appUrl: string
): string {
  const callbackUrl = `${appUrl}/api/sso/callback/${companyId}`;
  return `<?xml version="1.0"?>
<!-- SecureVoult SP Metadata (stub) — companyId: ${companyId} -->
<!-- Replace this with real metadata generated by your SAML library. -->
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${appUrl}/sso/${companyId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${callbackUrl}"
      index="1" />
  </SPSSODescriptor>
</EntityDescriptor>`;
}
