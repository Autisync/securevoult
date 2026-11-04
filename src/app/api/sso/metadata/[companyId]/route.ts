/**
 * GET  /api/sso/metadata/[companyId]
 *
 * Returns SAML SP metadata XML for the given company.
 * IdP administrators paste this URL into their identity provider setup.
 *
 * No authentication required — metadata is public information shared with IdPs.
 * Status: SCAFFOLD — returns stub XML until a SAML library generates it.
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { Company } from '@/lib/models';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { getSPMetadataXML } from '@/lib/sso';
import { badRequest, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

type RouteParams = { params: Promise<{ companyId: string }> };

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return badRequest('Invalid company ID.');
  }

  const company = await Company.findById(companyId).select('name isActive').lean<{
    name: string;
    isActive: boolean;
  }>();

  if (!company || !company.isActive) {
    return notFound('Company not found.');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.securevoult.co.uk';
  const xml = getSPMetadataXML(companyId, appUrl);

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
