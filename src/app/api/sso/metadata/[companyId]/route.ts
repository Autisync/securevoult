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

type RouteParams = { params: Promise<{ companyId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return new NextResponse('Too many requests.', { status: 429 });

  try { await connectDB(); } catch {
    return new NextResponse('Database unavailable.', { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return new NextResponse('Invalid company ID.', { status: 400 });
  }

  const company = await Company.findById(companyId).select('name isActive').lean<{
    name: string;
    isActive: boolean;
  }>();

  if (!company || !company.isActive) {
    return new NextResponse('Company not found.', { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.securevoult.com';
  const xml = getSPMetadataXML(companyId, appUrl);

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
