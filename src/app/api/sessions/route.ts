/**
 * GET  /api/sessions  — list the caller's active sessions
 * POST /api/sessions  — create or refresh a session (called on login/sync)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import {
  createOrUpdateSession,
  listSessions,
  toPublicSession,
  ClientType,
} from '@/lib/session-service';
import { tooManyRequests, serviceUnavailable, unauthorized } from '@/lib/api-error';
import { randomUUID } from 'crypto';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

// ── GET — list active sessions ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.sessions);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  const currentSessionId = request.headers.get('x-session-id') ?? '';

  try {
    const sessions = await listSessions(authResult.user.uid);
    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => toPublicSession(s, currentSessionId)),
    });
  } catch {
    return serviceUnavailable();
  }
}

// ── POST — create / refresh a session ────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit: session creation
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.sessions);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return unauthorized();

  let body: { sessionId?: string; clientType?: string } = {};
  try { body = await request.json(); } catch { /* body is optional */ }

  const clientType: ClientType =
    body.clientType === 'extension' ? 'extension'
      : body.clientType === 'mobile' ? 'mobile'
      : 'web';

  // Reuse existing session ID if provided; otherwise create a new one
  const sessionId = body.sessionId && typeof body.sessionId === 'string' && body.sessionId.length <= 64
    ? body.sessionId
    : randomUUID();

  const ua =
    clientType === 'extension' ? '__extension__'
      : clientType === 'mobile' ? '__mobile__'
      : (request.headers.get('user-agent') ?? '');

  try {
    await createOrUpdateSession(authResult.user.uid, sessionId, {
      clientType,
      userAgent: ua,
      ipAddress: ip,
    });
  } catch {
    return serviceUnavailable();
  }

  return NextResponse.json({ success: true, sessionId });
}
