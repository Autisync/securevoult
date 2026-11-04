/**
 * POST /api/auth/passkey/login/verify
 *
 * Verifies a WebAuthn authentication assertion.
 * On success, returns a Firebase custom token the client can exchange for an
 * ID token via `signInWithCustomToken`.
 *
 * Body: {
 *   credentialId: string,
 *   clientDataJSON: string,
 *   authenticatorData: string,
 *   signature: string,
 *   userHandle?: string,   // base64url userId from the authenticator
 * }
 *
 * Returns: { success: true, firebaseCustomToken: string, email: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { WebAuthnChallenge, PasskeyCredential, User } from '@/lib/models';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import {
  verifyAuthentication, getRpId, getAllowedOrigins,
} from '@/lib/webauthn';
import { badRequest, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

// Reuse the shared Firebase Admin app (initialised from FIREBASE_ADMIN_* env vars)
import { getAdminAuth } from '@/lib/firebase-admin';

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

  let body: {
    credentialId?: string;
    clientDataJSON?: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string;
  };
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON body.');
  }

  const { credentialId, clientDataJSON, authenticatorData, signature } = body;
  if (!credentialId || !clientDataJSON || !authenticatorData || !signature) {
    return badRequest('Missing required fields.');
  }

  // Look up stored credential
  const cred = await PasskeyCredential.findOne({ credentialId });
  if (!cred) {
    return notFound('Passkey not found.');
  }

  // Retrieve and consume the pending authentication challenge
  // Accept challenge tied to this user OR an unbound discoverable challenge
  const challengeDoc = await WebAuthnChallenge.findOneAndDelete({
    type: 'authentication',
    $or: [
      { firebaseUid: cred.firebaseUid },
      { firebaseUid: null },
    ],
  });
  if (!challengeDoc) {
    return badRequest('No pending authentication challenge. Please retry.');
  }

  const rpId = getRpId();
  const allowedOrigins = getAllowedOrigins();

  try {
    const result = await verifyAuthentication({
      credentialId,
      clientDataJSON,
      authenticatorData,
      signature,
      storedPublicKey: cred.publicKey,
      storedCounter: cred.counter,
      expectedChallenge: challengeDoc.challenge,
      rpId,
      allowedOrigins,
      requireUserVerification: false,
    });

    // Update counter + last used
    await PasskeyCredential.updateOne(
      { credentialId },
      { counter: result.newCounter, lastUsedAt: new Date() }
    );

    // Look up the user for email / Firebase UID
    const dbUser = await User.findOne({ firebaseUid: cred.firebaseUid }).select('email firebaseUid');
    if (!dbUser) {
      return notFound('User account not found.');
    }

    // Mint a Firebase custom token so the client can sign in
    const adminAuth = getAdminAuth();
    const customToken = await adminAuth.createCustomToken(dbUser.firebaseUid, {
      passkeyAuth: true,
    });

    return NextResponse.json({
      success: true,
      firebaseCustomToken: customToken,
      email: dbUser.email,
    });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Authentication failed.');
  }
}
