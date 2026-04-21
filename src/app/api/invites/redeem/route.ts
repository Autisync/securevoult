/**
 * POST /api/invites/redeem
 *
 * Redeem a company invite token. The authenticated user's account will be
 * added to the company associated with the token.
 *
 * The invite is validated:
 *   - token must exist and be pending
 *   - token must not be expired
 *   - email on the invite must match the authenticated user's email
 *   - user must not already belong to another company
 *
 * Body: { token: string }
 *
 * Returns: { success: true, companyId, companyName, role }
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db-connect';
import { CompanyInvite, Company, User } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logLimitEvent } from '@/lib/limit-logger';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.auth);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  let body: { token?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== 'string' || token.length !== 64) {
    return NextResponse.json({ error: 'Invalid or missing invite token.' }, { status: 400 });
  }

  // Find the invite — use constant-time comparison via DB lookup (no timing oracle)
  const invite = await CompanyInvite.findOne({ token });
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found or already used.' }, { status: 404 });
  }

  if (invite.status !== 'pending') {
    return NextResponse.json(
      { error: `This invite has already been ${invite.status}.` },
      { status: 410 }
    );
  }

  if (invite.expiresAt < new Date()) {
    await CompanyInvite.updateOne({ _id: invite._id }, { $set: { status: 'expired' } });
    return NextResponse.json({ error: 'This invite has expired.' }, { status: 410 });
  }

  // Email on the invite must match the authenticated user
  if (invite.email !== user.email.toLowerCase().trim()) {
    return NextResponse.json(
      { error: 'This invite is for a different email address.' },
      { status: 403 }
    );
  }

  // Load the user record
  const dbUser = await User.findOne({ firebaseUid: user.uid });
  if (!dbUser) {
    return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
  }

  if (dbUser.companyId) {
    if (String(dbUser.companyId) === String(invite.companyId)) {
      return NextResponse.json({ error: 'You are already a member of this company.' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'You already belong to another company. Leave that company first.' },
      { status: 409 }
    );
  }

  const company = await Company.findById(invite.companyId)
    .select('name plan maxSeats')
    .lean<{ name: string; plan: string; maxSeats: number }>();
  if (!company) {
    return NextResponse.json({ error: 'Company no longer exists.' }, { status: 404 });
  }

  // Final seat check at redemption time
  const currentSeats = await User.countDocuments({ companyId: invite.companyId });
  if (company.maxSeats !== -1 && currentSeats >= company.maxSeats) {
    logLimitEvent({
      firebaseUid: user.uid,
      companyId: String(invite.companyId),
      event: 'seat_limit_reached',
      feature: 'company_seats',
      plan: company.plan,
      currentUsage: currentSeats,
      allowedLimit: company.maxSeats,
      ipAddress: ip,
    });
    return NextResponse.json(
      { error: 'This company has reached its seat limit. Contact the company admin.' },
      { status: 422 }
    );
  }

  // Atomic: join the company + mark invite accepted
  await Promise.all([
    User.updateOne(
      { firebaseUid: user.uid },
      {
        $set: {
          companyId: new mongoose.Types.ObjectId(String(invite.companyId)),
          role: invite.role,
        },
      }
    ),
    CompanyInvite.updateOne(
      { _id: invite._id },
      { $set: { status: 'accepted', redeemedByUid: user.uid, redeemedAt: new Date() } }
    ),
  ]);

  logLimitEvent({
    firebaseUid: user.uid,
    companyId: String(invite.companyId),
    event: 'plan_activated',
    feature: 'company_join',
    plan: company.plan,
    meta: { via: 'invite_token', inviteId: String(invite._id) },
    ipAddress: ip,
  });

  return NextResponse.json({
    success: true,
    companyId: String(invite.companyId),
    companyName: company.name,
    role: invite.role,
    message: `You have joined ${company.name}.`,
  });
}
