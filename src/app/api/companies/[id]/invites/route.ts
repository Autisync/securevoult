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
 * The actual email delivery is handled by /api/companies/[id]/invites (this file)
 * when RESEND_API_KEY is set. Otherwise the token is returned for manual use.
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

const INVITE_TTL_DAYS = 7;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: companyId } = await params;

  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return NextResponse.json({ error: 'Invalid company ID.' }, { status: 400 });
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin' && entitlements.companyId === companyId;
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
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
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  if (!mongoose.isValidObjectId(companyId)) {
    return NextResponse.json({ error: 'Invalid company ID.' }, { status: 400 });
  }

  const entitlements = await resolveEntitlements(user.uid);
  const isGlobalAdmin = entitlements.scope === 'global_admin';
  const isCompanyAdmin = entitlements.scope === 'company_admin' && entitlements.companyId === companyId;
  if (!isGlobalAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let body: { email?: string; role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { email, role = 'user' } = body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (!['user', 'companyAdmin'].includes(role)) {
    return NextResponse.json({ error: 'role must be "user" or "companyAdmin".' }, { status: 400 });
  }

  const company = await Company.findById(companyId)
    .select('name plan maxSeats')
    .lean<{ name: string; plan: string; maxSeats: number }>();
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

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
    return NextResponse.json({ error: 'This user is already a member of the company.' }, { status: 409 });
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

  // ── Email delivery (optional — requires RESEND_API_KEY) ──────────────────
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    emailSent = await sendInviteEmail({
      to: normalEmail,
      companyName: company.name,
      inviteUrl,
      expiresAt,
    });
  }

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

// ── Email helper ──────────────────────────────────────────────────────────────

async function sendInviteEmail(opts: {
  to: string;
  companyName: string;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'SecureVoult <noreply@securevoult.app>',
        to: opts.to,
        subject: `You've been invited to join ${opts.companyName} on SecureVoult`,
        html: buildInviteEmailHtml(opts),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildInviteEmailHtml(opts: {
  companyName: string;
  inviteUrl: string;
  expiresAt: Date;
}): string {
  const expires = opts.expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:8px">You've been invited to SecureVoult</h2>
  <p>${opts.companyName} has invited you to join their secure password vault.</p>
  <p>
    <a href="${opts.inviteUrl}"
       style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
              text-decoration:none;border-radius:6px;font-weight:600">
      Accept Invitation
    </a>
  </p>
  <p style="font-size:13px;color:#666">
    This invite expires on ${expires}.<br>
    If you weren't expecting this email you can safely ignore it.
  </p>
  <p style="font-size:12px;color:#999">
    Or paste this link into your browser:<br>${opts.inviteUrl}
  </p>
</body>
</html>`;
}
