/**
 * POST /api/admin/users/force-password-reset
 *
 * Forces a password reset for the target user by:
 *  1. Revoking all existing Firebase refresh tokens (immediate sign-out on all devices).
 *  2. Setting a `passwordResetRequired: true` custom claim so the client can
 *     detect the forced state and block vault access until the user changes
 *     their password via Firebase Auth's sendPasswordResetEmail flow.
 *  3. Recording the action in the AdminActivity audit log.
 *
 * Security notes:
 *  - Only global admins may trigger this.
 *  - Admins cannot reset another admin's password (prevents privilege escalation).
 *  - Token revocation is immediate — Firebase checks revocation on every
 *    verifyIdToken call in server-auth.ts (checkRevoked = true).
 *  - The custom claim `passwordResetRequired` is informational; the authoritative
 *    gate is token revocation.
 */
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import connectDB from '@/lib/db-connect';
import { User, AdminActivity } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { badRequest, forbidden, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON body.');
  }

  const { firebaseUid, reason } = body as { firebaseUid?: string; reason?: string };
  if (!firebaseUid?.trim()) {
    return badRequest('firebaseUid is required.');
  }

  // Prevent an admin from resetting another admin's tokens
  if (firebaseUid === adminResult.adminUid) {
    return badRequest('You cannot force-reset your own account.');
  }

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const targetUser = await User.findOne({ firebaseUid }).select('role email displayName').lean() as {
    role?: string; email?: string; displayName?: string;
  } | null;

  if (!targetUser) {
    return notFound('Target user not found.');
  }

  // Prevent resetting another global admin's tokens (privilege escalation guard)
  if (targetUser.role === 'admin') {
    return forbidden('Cannot force-reset another global admin account.');
  }

  // Ensure Firebase Admin is initialised
  if (!admin.apps.length) {
    const { verifyIdToken } = await import('@/lib/firebase-admin');
    // Side-effect: initialises the app
    await verifyIdToken('').catch(() => undefined);
  }

  const auth = admin.apps[0]!.auth();

  // 1. Revoke all refresh tokens — forces immediate sign-out everywhere
  await auth.revokeRefreshTokens(firebaseUid);

  // 2. Set a custom claim so client code can surface a "change your password" prompt
  await auth.setCustomUserClaims(firebaseUid, { passwordResetRequired: true });

  // 3. Audit log
  await new AdminActivity({
    adminFirebaseUid: adminResult.adminUid,
    action: 'password_reset',
    targetFirebaseUid: firebaseUid,
    details: { reason: reason?.slice(0, 500) ?? 'Admin-initiated force reset' },
    ipAddress: ip,
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  }).save();

  return NextResponse.json({
    success: true,
    message: `Password reset forced for ${targetUser.email ?? firebaseUid}. All sessions have been revoked.`,
  });
}
