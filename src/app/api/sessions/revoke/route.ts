/**
 * POST /api/sessions/revoke
 *
 * Body:
 *   { sessionId: string }           — revoke one specific session
 *   { revokeOthers: true }          — revoke all sessions except the current one
 *
 * Ownership is enforced: a user can only revoke their own sessions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/security-events';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { revokeSession, revokeOtherSessions } from '@/lib/session-service';
import { badRequest, serviceUnavailable, unauthorized, tooManyRequests, notFound } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.sessions);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return unauthorized();

  const uid = authResult.user.uid;
  const currentSessionId = request.headers.get('x-session-id') ?? '';

  let body: { sessionId?: string; revokeOthers?: boolean } = {};
  try { body = await request.json(); } catch { /* bad JSON */ }

  try {
    if (body.revokeOthers === true) {
      if (!currentSessionId) {
        return badRequest('x-session-id header is required to revoke other sessions');
      }
      const count = await revokeOtherSessions(uid, currentSessionId);
      await recordEvent(request, { type: 'session_revoked', uid, email: authResult.user.email, summary: `Signed out ${count} other device${count === 1 ? '' : 's'}` });
      return NextResponse.json({ success: true, revoked: count });
    }

    if (typeof body.sessionId === 'string' && body.sessionId.length > 0) {
      const ok = await revokeSession(uid, body.sessionId);
      if (!ok) {
        return notFound('Session not found or already revoked.');
      }
      await recordEvent(request, { type: 'session_revoked', uid, email: authResult.user.email, details: { sessionId: body.sessionId.slice(0, 8) + '…' } });
      return NextResponse.json({ success: true });
    }

    return badRequest('Provide sessionId to revoke one session, or revokeOthers:true to revoke all others.');
  } catch {
    return serviceUnavailable();
  }
}
