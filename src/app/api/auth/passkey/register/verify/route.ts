/**
 * POST /api/auth/passkey/register/verify
 *
 * Verifies the WebAuthn registration response and stores the credential.
 *
 * Body: {
 *   credentialId: string,        // base64url
 *   clientDataJSON: string,      // base64url
 *   attestationObject: string,   // base64url
 *   transports?: string[],
 *   deviceName?: string,
 * }
 *
 * Returns: { success: true, credentialId, deviceName }
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { WebAuthnChallenge, PasskeyCredential } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import {
  verifyRegistration, getRpId, getAllowedOrigins,
} from '@/lib/webauthn';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { logLimitEvent } from '@/lib/limit-logger';

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

  let body: {
    credentialId?: string;
    clientDataJSON?: string;
    attestationObject?: string;
    transports?: string[];
    deviceName?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { credentialId, clientDataJSON, attestationObject, transports = [], deviceName = 'Passkey' } = body;
  if (!credentialId || !clientDataJSON || !attestationObject) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Retrieve and consume the pending challenge
  const challengeDoc = await WebAuthnChallenge.findOneAndDelete({
    firebaseUid: user.uid,
    type: 'registration',
  });
  if (!challengeDoc) {
    return NextResponse.json({ error: 'No pending registration challenge found. Please restart.' }, { status: 400 });
  }

  // ── Plan enforcement: passkeys ────────────────────────────────────────────
  const entitlements = await resolveEntitlements(user.uid);

  if (!entitlements.limits.passkeys) {
    logLimitEvent({
      firebaseUid: user.uid,
      event: 'feature_denied',
      feature: 'passkeys',
      plan: entitlements.effectivePlan,
      ipAddress: ip,
      meta: { reason: 'plan_does_not_include_passkeys' },
    });
    return NextResponse.json(
      planLimitPayload({
        feature: 'passkeys',
        currentPlan: entitlements.effectivePlan,
        upgradeTo: 'pro',
        message: 'Passkeys require a Pro plan or higher.',
      }),
      { status: 403 }
    );
  }

  // Check per-plan passkey count limit (e.g. Pro = 5, Company/Enterprise = unlimited)
  const maxPasskeys = entitlements.limits.maxPasskeys;
  if (maxPasskeys !== -1) {
    const currentPasskeyCount = await PasskeyCredential.countDocuments({ firebaseUid: user.uid });
    if (currentPasskeyCount >= maxPasskeys) {
      logLimitEvent({
        firebaseUid: user.uid,
        event: 'limit_reached',
        feature: 'passkeys',
        plan: entitlements.effectivePlan,
        currentUsage: currentPasskeyCount,
        allowedLimit: maxPasskeys,
        ipAddress: ip,
      });
      return NextResponse.json(
        planLimitPayload({
          feature: 'passkeys',
          currentPlan: entitlements.effectivePlan,
          currentUsage: currentPasskeyCount,
          allowedLimit: maxPasskeys,
          upgradeTo: 'company',
          message: `You have reached the maximum of ${maxPasskeys} passkeys for your ${entitlements.effectivePlan} plan.`,
        }),
        { status: 422 }
      );
    }
  }

  const rpId = getRpId();
  const allowedOrigins = getAllowedOrigins();

  try {
    const result = await verifyRegistration({
      clientDataJSON,
      attestationObject,
      expectedChallenge: challengeDoc.challenge,
      rpId,
      allowedOrigins,
      requireUserVerification: false,
    });

    // Prevent duplicate credential IDs
    const dup = await PasskeyCredential.findOne({ credentialId: result.credentialId });
    if (dup) {
      return NextResponse.json({ error: 'This passkey is already registered.' }, { status: 409 });
    }

    await PasskeyCredential.create({
      firebaseUid: user.uid,
      credentialId: result.credentialId,
      publicKey: result.publicKey,
      deviceName: deviceName.slice(0, 100),
      transports,
      counter: result.counter,
      rpId,
      userVerification: 'preferred',
      lastUsedAt: null,
    });

    return NextResponse.json({
      success: true,
      credentialId: result.credentialId,
      deviceName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed.' },
      { status: 400 }
    );
  }
}
