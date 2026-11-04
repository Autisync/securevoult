/**
 * GET /api/sso/login?companyId=...
 *
 * Initiate SSO login for a company. Redirects the user to the IdP.
 *
 * Status: SCAFFOLD — returns 501 until a real SAML/OIDC library is wired in.
 * Replace `initiateSSOLogin` in src/lib/sso.ts with a real implementation.
 *
 * Query params:
 *   companyId    — the company's MongoDB _id or slug
 *   redirectTo   — (optional) URL to return to after successful login
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { Company, SSOConfig } from '@/lib/models';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { isSSOAvailable } from '@/lib/sso';
import { initiateSSOLogin } from '@/lib/sso';
import { apiError, badRequest, forbidden, internalError, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

function resolveRelayState(rawRedirectTo: string | null): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const target = new URL(rawRedirectTo ?? '/', appUrl);
    const appOrigin = new URL(appUrl).origin;
    if (target.origin !== appOrigin) {
      return null;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.auth);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const { searchParams } = new URL(request.url);
  const companyIdOrSlug = searchParams.get('companyId');
  const relayState = resolveRelayState(searchParams.get('redirectTo'));

  if (!companyIdOrSlug) {
    return badRequest('companyId query parameter is required.');
  }

  if (!relayState) {
    return badRequest('redirectTo must be a same-origin path.');
  }

  // Look up the company by ID or slug
  const companyQuery = mongoose.isValidObjectId(companyIdOrSlug)
    ? { _id: companyIdOrSlug }
    : { slug: companyIdOrSlug };

  const company = await Company.findOne(companyQuery).select('plan status isActive').lean<{
    _id: { toString(): string };
    plan: string;
    status?: string;
    isActive: boolean;
  }>();

  if (!company || !company.isActive) {
    return notFound('Company not found.');
  }

  if (!isSSOAvailable(company.plan as Parameters<typeof isSSOAvailable>[0])) {
    return forbidden('SSO is not available for this company. Enterprise plan required.');
  }

  const ssoConfig = await SSOConfig.findOne({ companyId: company._id }).lean();
  if (!ssoConfig) {
    return notFound('SSO is not configured for this company. Contact your administrator.');
  }

  const result = await initiateSSOLogin(
    ssoConfig as unknown as Parameters<typeof initiateSSOLogin>[0],
    relayState
  );

  if ('error' in result) {
    const errResult = result as { error: string; notImplemented?: true };
    if (errResult.notImplemented) {
      return apiError(
        501,
        'not_implemented',
        'SSO login is not yet implemented.',
        {
          detail: errResult.error,
          status: 'scaffold',
          hint: 'Wire a SAML/OIDC library into src/lib/sso.ts to enable SSO login.',
        }
      );
    }
    return internalError(errResult.error);
  }

  return NextResponse.redirect(result.redirectUrl);
}
