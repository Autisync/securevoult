/**
 * POST /api/auth/passkey/register/challenge
 *
 * Issues a WebAuthn registration challenge for an authenticated user.
 * The challenge is stored in MongoDB with a 5-minute TTL.
 *
 * Body: { deviceName?: string }
 * Returns: { challenge, rpId, rpName, userId, userName, userDisplayName, userIdBytes }
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { WebAuthnChallenge, PasskeyCredential, User } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { generateChallenge, generateUserIdBytes, getRpId, getRpName } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  // Check if user already has passkeys to get a consistent userIdBytes
  const existing = await PasskeyCredential.findOne({ firebaseUid: user.uid }).select('rpId');

  const rpId = getRpId();
  const rpName = getRpName();
  const userIdBytes = generateUserIdBytes();
  const challenge = generateChallenge();

  // Fetch user record for display name
  const dbUser = await User.findOne({ firebaseUid: user.uid }).select('displayName email');

  // Store challenge (TTL-indexed — auto-expires in 5 min)
  await WebAuthnChallenge.create({
    challenge,
    type: 'registration',
    firebaseUid: user.uid,
    userIdBytes,
  });

  // Fetch existing credential IDs to pass as excludeCredentials
  const creds = await PasskeyCredential.find({ firebaseUid: user.uid }).select('credentialId transports');
  const excludeCredentials = creds.map((c: { credentialId: string; transports: string[] }) => ({
    id: c.credentialId,
    type: 'public-key',
    transports: c.transports ?? [],
  }));

  return NextResponse.json({
    challenge,
    rpId,
    rpName,
    userId: user.uid,
    userName: user.email,
    userDisplayName: dbUser?.displayName || user.email,
    userIdBytes,
    excludeCredentials,
    // Suggest supported algorithms: ES256 (-7) and RS256 (-257)
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 },  // RS256
    ],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
    // rpId note: pass-through to client — don't include `existing` in response
    _existingCount: existing ? 1 : 0,
  });
}
