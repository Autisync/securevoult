import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { User } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createOrUpdateSession, ClientType, canReuseSessionId } from '@/lib/session-service';
import { tooManyRequests, serviceUnavailable } from '@/lib/api-error';
import { randomUUID } from 'crypto';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function POST(request: NextRequest) {
  // Rate limit: 20 syncs per 15 min per IP
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.authSync);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  const { uid, email, name, picture, emailVerified } = authResult.user;

  let body: {
    displayName?: string;
    photoURL?: string;
    provider?: string;
    emailVerified?: boolean;
    sessionId?: string;
    clientType?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  try {
    await connectDB();
  } catch {
    return serviceUnavailable('Database unavailable.');
  }

  // Resolve role: promote if email is in the ADMIN_EMAILS env list
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdminEmail = adminEmails.includes((email ?? '').toLowerCase());

  const update: Record<string, unknown> = {
    email,
    displayName: name ?? body.displayName ?? '',
    photoURL: picture ?? body.photoURL ?? '',
    provider: body.provider ?? 'password',
    emailVerified: emailVerified ?? body.emailVerified ?? false,
    isActive: true,
    // Always enforce admin role for designated emails; never overwrite role for normal users
    ...(isAdminEmail ? { role: 'admin' } : {}),
  };

  const user = await User.findOneAndUpdate(
    { firebaseUid: uid },
    {
      $set: update,
      $setOnInsert: {
        firebaseUid: uid,
        // Only set default role on insert; $set already handles admin promotion above
        ...(!isAdminEmail ? { role: 'user' } : {}),
      },
    },
    { upsert: true, new: true }
  );

  // Create or refresh the session record for this login
  const clientType: ClientType =
    body.clientType === 'extension' ? 'extension'
      : body.clientType === 'mobile' ? 'mobile'
      : 'web';
  const requestedSessionId =
    body.sessionId && typeof body.sessionId === 'string' && body.sessionId.length <= 64
      ? body.sessionId
      : null;
  const sessionId = requestedSessionId && await canReuseSessionId(uid, requestedSessionId)
    ? requestedSessionId
    : randomUUID();
  const ua =
    clientType === 'extension' ? '__extension__'
      : clientType === 'mobile' ? '__mobile__'
      : (request.headers.get('user-agent') ?? '');

  // Best-effort — don't fail the sync if session creation fails
  try {
    await createOrUpdateSession(uid, sessionId, { clientType, userAgent: ua, ipAddress: ip });
  } catch {
    // non-fatal
  }

  let plan = 'free';
  try {
    const { resolveEntitlements } = await import('@/lib/entitlements');
    plan = (await resolveEntitlements(uid)).effectivePlan;
  } catch { /* free until it can be resolved */ }

  return NextResponse.json({
    success: true,
    sessionId,
    user: {
      plan,
      billingCycle: (user as { billingCycle?: string }).billingCycle ?? 'monthly',
      planExpiresAt: (user as { planExpiresAt?: Date | null }).planExpiresAt ?? null,
      id: user._id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      provider: user.provider,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
}
