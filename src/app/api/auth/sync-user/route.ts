import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { User } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { createOrUpdateSession, ClientType } from '@/lib/session-service';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  // Rate limit: 20 syncs per 15 min per IP
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.authSync);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
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
    return NextResponse.json(
      { error: 'Database unavailable. Please try again later.' },
      { status: 503 }
    );
  }

  const update = {
    email,
    displayName: name ?? body.displayName ?? '',
    photoURL: picture ?? body.photoURL ?? '',
    provider: body.provider ?? 'password',
    emailVerified: emailVerified ?? body.emailVerified ?? false,
    isActive: true,
  };

  const user = await User.findOneAndUpdate(
    { firebaseUid: uid },
    { $set: update, $setOnInsert: { firebaseUid: uid, role: 'user' } },
    { upsert: true, new: true }
  );

  // Create or refresh the session record for this login
  const clientType: ClientType =
    body.clientType === 'extension' ? 'extension'
      : body.clientType === 'mobile' ? 'mobile'
      : 'web';
  const sessionId = body.sessionId && typeof body.sessionId === 'string' && body.sessionId.length <= 64
    ? body.sessionId
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

  return NextResponse.json({
    success: true,
    sessionId,
    user: {
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
