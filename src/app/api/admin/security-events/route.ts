import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { AdminActivity, SecurityEvent, User } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';
import { EVENT_INFO, recordEvent, describeDevice } from '@/lib/security-events';
import { verifyMail, mailConfigured } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; at: Date; type: string; label: string; severity: string; email?: string; actorEmail?: string;
  ip?: string; country?: string; device?: string; userAgent?: string; method?: string; path?: string; summary?: string;
  details?: unknown; alerted?: boolean;
};

/** The security log for admins: filter by severity, type, or any text (email, IP, device). */
export async function GET(request: NextRequest) {
  const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.admin);
  if (!rl.allowed) return tooManyRequests(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)));
  const admin = await requireVerifiedAdmin(request);
  if ('error' in admin) return admin.error;
  try { await connectDB(); } catch { return serviceUnavailable('Database unavailable.'); }

  const sp = new URL(request.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(sp.get('limit') ?? 100)));
  const before = sp.get('before') ? new Date(sp.get('before')!) : null;
  const severity = sp.get('severity');
  const type = sp.get('type');
  const q = (sp.get('q') ?? '').trim();

  const query: Record<string, unknown> = {};
  if (severity && ['info', 'warning', 'critical'].includes(severity)) query.severity = severity;
  if (type) query.type = type;
  if (before && !isNaN(+before)) query.at = { $lt: before };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ email: rx }, { actorEmail: rx }, { ip: rx }, { device: rx }, { summary: rx }, { type: rx }];
  }

  const events = await SecurityEvent.find(query).sort({ at: -1 }).limit(limit).lean() as unknown as (Row & { _id: unknown; actorUid?: string; uid?: string })[];

  // Older admin actions recorded before the security log existed.
  let legacy: Row[] = [];
  if (!severity && !type && !q && events.length < limit) {
    const oldest = events.length ? events[events.length - 1].at : before ?? new Date();
    const acts = await AdminActivity.find({ timestamp: { $lt: oldest } }).sort({ timestamp: -1 }).limit(limit - events.length).lean() as unknown as {
      _id: unknown; adminFirebaseUid: string; action: string; targetFirebaseUid?: string; details?: unknown; ipAddress?: string; userAgent?: string; timestamp: Date }[];
    const uids = [...new Set(acts.flatMap((a) => [a.adminFirebaseUid, a.targetFirebaseUid].filter(Boolean) as string[]))];
    const users = await User.find({ firebaseUid: { $in: uids } }).select('firebaseUid email').lean() as unknown as { firebaseUid: string; email?: string }[];
    const emailOf = new Map(users.map((u) => [u.firebaseUid, u.email]));
    legacy = acts.map((a) => ({
      id: String(a._id), at: a.timestamp, type: a.action === 'vault_accessed' ? 'admin_viewed_users' : a.action,
      label: a.action === 'vault_accessed' ? 'Admin opened the user list' : a.action.replace(/_/g, ' '),
      severity: 'info', actorEmail: emailOf.get(a.adminFirebaseUid), email: a.targetFirebaseUid ? emailOf.get(a.targetFirebaseUid) : undefined,
      ip: a.ipAddress, userAgent: a.userAgent, device: describeDevice(a.userAgent), details: a.details,
    }));
  }

  // Fill in actor emails for events that only have the uid.
  const missing = [...new Set(events.filter((e) => e.actorUid && !e.actorEmail).map((e) => e.actorUid!))];
  const actors = missing.length ? await User.find({ firebaseUid: { $in: missing } }).select('firebaseUid email').lean() as unknown as { firebaseUid: string; email?: string }[] : [];
  const actorEmail = new Map(actors.map((u) => [u.firebaseUid, u.email]));

  const rows: Row[] = [
    ...events.map((e) => ({
      id: String(e._id), at: e.at, type: e.type, label: EVENT_INFO[e.type]?.label ?? e.type, severity: e.severity,
      email: e.email, actorEmail: e.actorEmail ?? (e.actorUid ? actorEmail.get(e.actorUid) : undefined),
      ip: e.ip, country: e.country, device: e.device, userAgent: e.userAgent, method: e.method, path: e.path,
      summary: e.summary, details: e.details, alerted: e.alerted,
    })),
    ...legacy,
  ];

  const since = new Date(Date.now() - 24 * 3600e3);
  const [critical24h, warning24h] = await Promise.all([
    SecurityEvent.countDocuments({ severity: 'critical', at: { $gte: since } }),
    SecurityEvent.countDocuments({ severity: 'warning', at: { $gte: since } }),
  ]);

  return NextResponse.json({
    success: true,
    events: rows,
    counts: { critical24h, warning24h },
    types: Object.entries(EVENT_INFO).map(([k, v]) => ({ type: k, label: v.label, severity: v.severity })),
    email: { configured: mailConfigured(), alertTo: (process.env.ALERT_EMAILS || process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean) },
  });
}

/** POST { action: 'test' }: checks the email connection and sends a test alert to the admins. */
export async function POST(request: NextRequest) {
  const admin = await requireVerifiedAdmin(request);
  if ('error' in admin) return admin.error;
  const check = await verifyMail();
  if (!check.ok) return NextResponse.json({ success: false, message: check.detail }, { status: 200 });
  await recordEvent(request, { type: 'admin_test_alert', actorUid: admin.adminUid, actorEmail: admin.adminEmail, summary: `Test alert sent by ${admin.adminEmail}. If you can read this, security alerts reach you.` });
  return NextResponse.json({ success: true, message: `${check.detail}. Test alert sent.` });
}
