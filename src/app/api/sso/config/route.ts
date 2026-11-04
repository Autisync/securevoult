/**
 * GET  /api/sso/config   — return the SSO config for the requester's company
 * POST /api/sso/config   — save / update SSO config (enterprise only)
 *
 * Access: company admin of an enterprise-tier company, or global admin.
 *
 * Sensitive fields (oidcClientSecret, samlCert) are redacted from GET responses.
 * Only fields that the caller explicitly provides are updated on POST.
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { SSOConfig, Company } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { isSSOAvailable, SSOProvider } from '@/lib/sso';
import { badRequest, forbidden, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

const SENSITIVE_FIELDS = ['oidcClientSecret', 'samlCert'];

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin';
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return forbidden('Forbidden.');
  }

  if (!isSSOAvailable(entitlements.effectivePlan)) {
    return NextResponse.json(
      planLimitPayload({
        feature: 'sso',
        currentPlan: entitlements.effectivePlan,
        upgradeTo: 'enterprise',
        message: 'SSO is only available on the Enterprise plan.',
      }),
      { status: 403 }
    );
  }

  if (!entitlements.companyId) {
    return badRequest('No company associated with your account.');
  }

  const config = await SSOConfig.findOne({ companyId: entitlements.companyId }).lean();
  if (!config) {
    return NextResponse.json({ success: true, config: null });
  }

  // Redact sensitive fields
  const safe = { ...config } as Record<string, unknown>;
  for (const field of SENSITIVE_FIELDS) {
    if (safe[field]) safe[field] = '[redacted]';
  }

  return NextResponse.json({ success: true, config: safe });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin';
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return forbidden('Forbidden.');
  }

  if (!isSSOAvailable(entitlements.effectivePlan)) {
    return NextResponse.json(
      planLimitPayload({
        feature: 'sso',
        currentPlan: entitlements.effectivePlan,
        upgradeTo: 'enterprise',
        message: 'SSO configuration requires the Enterprise plan.',
      }),
      { status: 403 }
    );
  }

  if (!entitlements.companyId) {
    return badRequest('No company associated with your account.');
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON body.');
  }

  const validProviders: SSOProvider[] = ['saml', 'oidc', 'google_workspace', 'azure_ad'];
  if (body.provider && !validProviders.includes(body.provider as SSOProvider)) {
    return badRequest('Invalid provider value.');
  }

  // Allowlist of updatable fields to prevent mass-assignment
  const allowedFields: (keyof typeof body)[] = [
    'provider',
    'samlEntryPoint', 'samlIssuer', 'samlCert', 'samlCallbackUrl',
    'oidcDiscoveryUrl', 'oidcClientId', 'oidcClientSecret', 'oidcRedirectUri',
    'googleWorkspaceDomain',
    'azureTenantId',
    'attributeMapping',
    'defaultRole',
    'allowPasswordFallback',
    'jitProvisioning',
  ];

  const update: Record<string, unknown> = { updatedByUid: user.uid };
  for (const field of allowedFields) {
    if (field in body) update[field] = body[field];
  }

  if (Object.keys(update).length === 1) {
    return badRequest('No valid fields provided.');
  }

  const config = await SSOConfig.findOneAndUpdate(
    { companyId: entitlements.companyId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Return safe version (redact secrets)
  const safe = config.toObject() as Record<string, unknown>;
  for (const field of SENSITIVE_FIELDS) {
    if (safe[field]) safe[field] = '[redacted]';
  }

  return NextResponse.json({ success: true, config: safe });
}
