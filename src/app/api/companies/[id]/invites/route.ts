/**
 * POST /api/companies/[id]/invites   — send an invite
 * GET  /api/companies/[id]/invites   — list pending invites
 *
 * Access: company admin (scoped to own company) or global admin.
 *
 * The invite creates a CompanyInvite record with a secure token.
 * The token is returned in the response and should be emailed to the invitee
 * via your email service (SendGrid, Resend, etc.) using:
 *   https://your-domain.com/invite?token=<token>
 *
 * The invite is emailed through the SMTP server in lib/mailer.ts (same as the
 * CRM). Without email set up, the link is returned for the admin to share.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { Company, CompanyInvite, User } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { logLimitEvent } from '@/lib/limit-logger';
import { badRequest, conflict, forbidden, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';
import { sendMail, brandedHtml } from '@/lib/mailer';

const INVITE_TTL_DAYS = 7;

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return badRequest('Invalid company ID.');
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin' && entitlements.companyId === companyId;
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return forbidden('Forbidden.');
  }

  const invites = await CompanyInvite.find({
    companyId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .select('email role status createdAt expiresAt inviterUid')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, invites });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.authAction);
  if (!rl.allowed) return tooManyRequests(retryAfterSeconds(rl.resetAt));

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return badRequest('Invalid company ID.');
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin' && entitlements.companyId === companyId;
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return forbidden('Forbidden.');
  }

  let body: { email?: string; role?: string };
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON body.');
  }

  const { email, role = 'user' } = body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return badRequest('A valid email address is required.');
  }
  if (!['user', 'companyAdmin'].includes(role)) {
    return badRequest('role must be "user" or "companyAdmin".');
  }

  const company = await Company.findById(companyId)
    .select('name plan maxSeats')
    .lean<{ name: string; plan: string; maxSeats: number }>();
  if (!company) return notFound('Company not found.');

  // Seat limit check (count current members + pending invites)
  const [currentSeats, pendingInvites] = await Promise.all([
    User.countDocuments({ companyId }),
    CompanyInvite.countDocuments({ companyId, status: 'pending', expiresAt: { $gt: new Date() } }),
  ]);
  const projectedSeats = currentSeats + pendingInvites;
  if (company.maxSeats !== -1 && projectedSeats >= company.maxSeats) {
    logLimitEvent({
      firebaseUid: user.uid,
      companyId,
      event: 'seat_limit_reached',
      feature: 'company_seats',
      plan: company.plan,
      currentUsage: projectedSeats,
      allowedLimit: company.maxSeats,
      ipAddress: ip,
    });
    return NextResponse.json(
      planLimitPayload({
        feature: 'company_seats',
        currentPlan: company.plan as 'free' | 'pro' | 'company' | 'enterprise',
        currentUsage: projectedSeats,
        allowedLimit: company.maxSeats,
        upgradeTo: 'enterprise',
        message: `This company has reached its seat limit of ${company.maxSeats}.`,
      }),
      { status: 422 }
    );
  }

  const normalEmail = email.toLowerCase().trim();

  // Check if this email is already a member
  const existingMember = await User.findOne({ email: normalEmail, companyId });
  if (existingMember) {
    return conflict('This user is already a member of the company.');
  }

  // Cancel any existing pending invite for this email+company
  await CompanyInvite.updateMany(
    { companyId, email: normalEmail, status: 'pending' },
    { $set: { status: 'canceled' } }
  );

  // Generate a cryptographically secure token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await CompanyInvite.create({
    companyId,
    inviterUid: user.uid,
    email: normalEmail,
    role,
    token,
    expiresAt,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const inviteUrl = `${appUrl}/invite?token=${token}`;

  const expires = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const subject = `${company.name} invited you to SecureVoult`;
  const text = `${company.name} has invited you to their team on SecureVoult, the password manager from Autisync.\n\nOpen the link below and sign in or create your account with this email address (${normalEmail}). The invite works until ${expires}.\n\n${inviteUrl}\n\nNot expecting this? You can ignore this email.`;
  const emailSent = (await sendMail({ to: normalEmail, subject, text, html: brandedHtml(subject, text, { label: 'Accept the invite', url: inviteUrl }) })).sent;

  return NextResponse.json({
    success: true,
    inviteId: invite._id,
    email: normalEmail,
    role,
    expiresAt,
    inviteUrl,
    emailSent,
    message: emailSent
      ? `Invite sent to ${normalEmail}.`
      : `Invite created. Share this link with ${normalEmail}: ${inviteUrl}`,
  });
}
