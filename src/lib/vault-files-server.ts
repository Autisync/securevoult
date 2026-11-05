import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { requireAuthenticatedUser, requireSecondFactor } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests, serviceUnavailable } from '@/lib/api-error';

/** Largest single attachment (before encryption). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** iv + GCM tag added by encryption. */
export const FILE_OVERHEAD = 28;

export const validFileId = (id: string) => /^[A-Za-z0-9_-]{8,64}$/.test(id);

/** Rate limit, sign-in, database and second step; returns the user id or an error response. */
export async function fileRequestUser(request: NextRequest): Promise<{ uid: string } | { error: NextResponse }> {
  const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.vaultFiles);
  if (!rl.allowed) {
    void import('@/lib/security-events').then(({ recordEvent }) => recordEvent(request, { type: 'rate_limited', summary: 'Too many file requests' }));
    return { error: tooManyRequests(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) };
  }
  const auth = await requireAuthenticatedUser(request);
  if ('error' in auth) return { error: auth.error };
  try { await connectDB(); } catch { return { error: serviceUnavailable('Database unavailable.') }; }
  const mfa = await requireSecondFactor(request, auth.user);
  if (mfa) return { error: mfa };
  return { uid: auth.user.uid };
}
