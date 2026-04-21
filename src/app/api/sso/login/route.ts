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

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.auth);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const companyIdOrSlug = searchParams.get('companyId');
  const relayState = searchParams.get('redirectTo') ?? '/';

  if (!companyIdOrSlug) {
    return NextResponse.json({ error: 'companyId query parameter is required.' }, { status: 400 });
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
    return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  }

  if (!isSSOAvailable(company.plan as Parameters<typeof isSSOAvailable>[0])) {
    return NextResponse.json(
      { error: 'SSO is not available for this company. Enterprise plan required.' },
      { status: 403 }
    );
  }

  const ssoConfig = await SSOConfig.findOne({ companyId: company._id }).lean();
  if (!ssoConfig) {
    return NextResponse.json(
      { error: 'SSO is not configured for this company. Contact your administrator.' },
      { status: 404 }
    );
  }

  const result = await initiateSSOLogin(
    ssoConfig as unknown as Parameters<typeof initiateSSOLogin>[0],
    relayState
  );

  if ('error' in result) {
    const errResult = result as { error: string; notImplemented?: true };
    if (errResult.notImplemented) {
      return NextResponse.json(
        {
          error: 'SSO login is not yet implemented.',
          detail: errResult.error,
          status: 'scaffold',
          hint: 'Wire a SAML/OIDC library into src/lib/sso.ts to enable SSO login.',
        },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: errResult.error }, { status: 500 });
  }

  return NextResponse.redirect(result.redirectUrl);
}
