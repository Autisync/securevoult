/**
 * POST /api/auth/passkey/login/challenge
 *
 * Issues a WebAuthn authentication challenge.
 * Supports both:
 *  - Discoverable (usernameless): no email required, browser selects credential
 *  - Targeted: email provided, returns allowCredentials for that user
 *
 * Body: { email?: string }
 * Returns: { challenge, rpId, allowCredentials, userVerification, timeout }
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { WebAuthnChallenge, PasskeyCredential, User } from '@/lib/models';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { generateChallenge, getRpId } from '@/lib/webauthn';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  let body: { email?: string } = {};
  try { body = await request.json(); } catch { /* no-op: empty body is fine */ }

  const { email } = body;
  const challenge = generateChallenge();
  const rpId = getRpId();

  let allowCredentials: { id: string; type: string; transports: string[] }[] = [];
  let firebaseUid: string | null = null;

  // If email provided, look up user's credentials to populate allowCredentials
  if (email) {
    const dbUser = await User.findOne({ email: email.toLowerCase().trim() }).select('firebaseUid');
    if (dbUser) {
      firebaseUid = dbUser.firebaseUid;
      const creds = await PasskeyCredential.find({ firebaseUid: dbUser.firebaseUid })
        .select('credentialId transports');
      allowCredentials = creds.map((c: { credentialId: string; transports: string[] }) => ({
        id: c.credentialId,
        type: 'public-key',
        transports: c.transports ?? [],
      }));
    }
    // Don't reveal whether the user exists — return empty allowCredentials if not found
  }

  await WebAuthnChallenge.create({
    challenge,
    type: 'authentication',
    firebaseUid, // may be null for discoverable flow
  });

  return NextResponse.json({
    challenge,
    rpId,
    allowCredentials,
    userVerification: 'preferred',
    timeout: 60000,
  });
}
