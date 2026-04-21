/**
 * GET  /api/auth/passkey/credentials  — list caller's registered passkeys
 * DELETE /api/auth/passkey/credentials — remove a passkey
 *
 * DELETE body: { credentialId: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { PasskeyCredential } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.auth);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const creds = await PasskeyCredential.find({ firebaseUid: authResult.user.uid })
    .select('credentialId deviceName transports lastUsedAt createdAt')
    .sort({ createdAt: -1 });

  return NextResponse.json({
    success: true,
    credentials: creds.map(c => ({
      credentialId: c.credentialId,
      deviceName:   c.deviceName,
      transports:   c.transports,
      lastUsedAt:   c.lastUsedAt,
      createdAt:    c.createdAt,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.authAction ?? RATE_LIMITS.auth);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  let body: { credentialId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { credentialId } = body;
  if (!credentialId) {
    return NextResponse.json({ error: 'credentialId required.' }, { status: 400 });
  }

  const result = await PasskeyCredential.deleteOne({
    credentialId,
    firebaseUid: authResult.user.uid, // scope to owner only
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Credential not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
