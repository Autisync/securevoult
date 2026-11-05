import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { SecurityEvent } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';
import { EVENT_INFO } from '@/lib/security-events';

export const dynamic = 'force-dynamic';

/** Your own recent security activity (sign-ins, two-step changes, devices signed out). */
export async function GET(request: NextRequest) {
  const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.sessions);
  if (!rl.allowed) return tooManyRequests(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)));
  const auth = await requireAuthenticatedUser(request);
  if ('error' in auth) return auth.error;
  try { await connectDB(); } catch { return serviceUnavailable('Database unavailable.'); }
  const shown = ['sign_in', 'new_device_sign_in', 'mfa_enabled', 'mfa_disabled', 'mfa_failed', 'mfa_brute_force', 'backup_code_used',
    'backup_codes_renewed', 'session_revoked', 'revoked_session_used', 'admin_changed_role', 'admin_changed_user', 'admin_forced_reset', 'vault_created'];
  const events = await SecurityEvent.find({ uid: auth.user.uid, type: { $in: shown } }).sort({ at: -1 }).limit(40).lean() as unknown as
    { _id: unknown; at: Date; type: string; severity: string; ip?: string; country?: string; device?: string }[];
  return NextResponse.json({
    success: true,
    events: events.map((e) => ({ id: String(e._id), at: e.at, type: e.type, label: EVENT_INFO[e.type]?.label ?? e.type, severity: e.severity, ip: e.ip, country: e.country, device: e.device })),
  });
}
