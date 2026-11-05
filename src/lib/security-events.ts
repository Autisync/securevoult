/**
 * The security log. Every important thing that happens to an account is
 * recorded with who, what, when and from where (IP, country, device).
 *
 * Serious events are emailed to the admins (ALERT_EMAILS, or ADMIN_EMAILS),
 * and the account owner is told about sign-ins from a new device and changes
 * to their two-step sign-in. Repeated failures escalate to critical.
 *
 * Recording never throws: a logging problem must not break the request.
 */
import connectDB from '@/lib/db-connect';
import { SecurityEvent } from '@/lib/models';
import { getClientIp } from '@/lib/rate-limit';
import { sendMail, brandedHtml } from '@/lib/mailer';

export type Severity = 'info' | 'warning' | 'critical';

/** What each event means, in words an admin or user understands. */
export const EVENT_INFO: Record<string, { label: string; severity: Severity }> = {
  sign_in: { label: 'Signed in', severity: 'info' },
  new_device_sign_in: { label: 'Signed in on a new device', severity: 'warning' },
  auth_failed: { label: 'Rejected sign-in token', severity: 'warning' },
  auth_failed_burst: { label: 'Many rejected sign-ins from one address', severity: 'critical' },
  mfa_enabled: { label: 'Two-step sign-in turned on', severity: 'info' },
  mfa_disabled: { label: 'Two-step sign-in turned off', severity: 'warning' },
  mfa_verified: { label: 'Two-step code accepted', severity: 'info' },
  mfa_failed: { label: 'Wrong two-step code', severity: 'warning' },
  mfa_brute_force: { label: 'Repeated wrong two-step codes', severity: 'critical' },
  backup_code_used: { label: 'Backup code used', severity: 'warning' },
  backup_codes_renewed: { label: 'New backup codes made', severity: 'info' },
  rate_limited: { label: 'Too many requests blocked', severity: 'warning' },
  rate_limited_burst: { label: 'Address repeatedly blocked for too many requests', severity: 'critical' },
  session_revoked: { label: 'Device signed out remotely', severity: 'warning' },
  revoked_session_used: { label: 'A signed-out device tried to connect', severity: 'warning' },
  vault_created: { label: 'Vault created', severity: 'info' },
  vault_conflict: { label: 'Vault changed on two devices at once', severity: 'info' },
  file_uploaded: { label: 'File added', severity: 'info' },
  file_deleted: { label: 'File removed', severity: 'info' },
  storage_full: { label: 'File storage full', severity: 'warning' },
  admin_viewed_users: { label: 'Admin opened the user list', severity: 'info' },
  admin_changed_role: { label: 'Admin changed a role', severity: 'critical' },
  admin_changed_user: { label: 'Admin changed an account', severity: 'warning' },
  admin_forced_reset: { label: 'Admin forced a password reset', severity: 'warning' },
  admin_test_alert: { label: 'Test alert', severity: 'critical' },
  backup_late: { label: 'Nightly backup is late', severity: 'critical' },
  disk_low: { label: 'Server disk nearly full', severity: 'critical' },
  vulnerable_dependency: { label: 'Security update needed', severity: 'critical' },
};

/** "Chrome on Windows", "Safari on iPhone", "SecureVoult extension". */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';
  if (ua === '__extension__') return 'SecureVoult extension';
  if (ua === '__mobile__') return 'SecureVoult app';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|python|node|axios|Go-http/i.test(ua) ? 'Script' : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export interface EventInput {
  type: keyof typeof EVENT_INFO | string;
  severity?: Severity;
  uid?: string | null;
  email?: string | null;
  actorUid?: string | null;
  actorEmail?: string | null;
  summary?: string;
  details?: Record<string, unknown>;
  /** Overrides the request's user agent (the extension sends a marker). */
  userAgent?: string;
}

const recentAlerts = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

function adminAddresses(): string[] {
  const raw = process.env.ALERT_EMAILS || process.env.ADMIN_EMAILS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://vault.autisync.com';

/** Records an event. Pass the request so IP, country and device are captured. */
const NOISY = new Set(['rate_limited', 'auth_failed', 'mfa_failed', 'revoked_session_used']);
const lastNoisy = new Map<string, number>();

export async function recordEvent(request: Request | null, input: EventInput): Promise<void> {
  try {
    // A flood of the same failure from one address is stored at most every 3 seconds.
    if (NOISY.has(input.type) && request) {
      const k = `${input.type}:${getClientIp(request)}`;
      const t = lastNoisy.get(k) ?? 0;
      if (Date.now() - t < 3000) return;
      lastNoisy.set(k, Date.now());
      if (lastNoisy.size > 5000) lastNoisy.clear();
    }
    await connectDB();
    const info = EVENT_INFO[input.type];
    const severity: Severity = input.severity ?? info?.severity ?? 'info';
    const ua = input.userAgent ?? request?.headers.get('user-agent') ?? '';
    let path = '', method = '';
    if (request) { try { const u = new URL(request.url); path = u.pathname; method = request.method; } catch { /* ignore */ } }
    const doc = {
      at: new Date(),
      type: input.type,
      severity,
      uid: input.uid ?? undefined,
      email: input.email ?? undefined,
      actorUid: input.actorUid ?? undefined,
      actorEmail: input.actorEmail ?? undefined,
      ip: request ? getClientIp(request) : 'server',
      country: request?.headers.get('cf-ipcountry') ?? undefined,
      userAgent: ua.slice(0, 400),
      device: request ? describeDevice(ua) : 'Server',
      method, path,
      summary: input.summary ?? info?.label ?? input.type,
      details: input.details,
    };
    const saved = await SecurityEvent.create(doc);
    await escalate(doc);
    if (severity === 'critical') await alertAdmins(doc, saved._id);
  } catch (e) {
    console.error('[security-events] could not record', input.type, e instanceof Error ? e.message : e);
  }
}

/** Turns repeated failures into one critical event. */
async function escalate(doc: { type: string; uid?: string; email?: string; ip: string }) {
  const since = (ms: number) => new Date(Date.now() - ms);
  if (doc.type === 'mfa_failed' && doc.uid) {
    const n = await SecurityEvent.countDocuments({ type: 'mfa_failed', uid: doc.uid, at: { $gte: since(15 * 60e3) } });
    if (n === 5) await recordEvent(null, { type: 'mfa_brute_force', uid: doc.uid, email: doc.email, summary: `5 wrong two-step codes in 15 minutes (last from ${doc.ip})`, details: { ip: doc.ip } });
  }
  if (doc.type === 'auth_failed') {
    const n = await SecurityEvent.countDocuments({ type: 'auth_failed', ip: doc.ip, at: { $gte: since(10 * 60e3) } });
    if (n === 20) await recordEvent(null, { type: 'auth_failed_burst', summary: `20 rejected sign-ins from ${doc.ip} in 10 minutes`, details: { ip: doc.ip } });
  }
  if (doc.type === 'rate_limited') {
    const n = await SecurityEvent.countDocuments({ type: 'rate_limited', ip: doc.ip, at: { $gte: since(60 * 60e3) } });
    if (n === 10) await recordEvent(null, { type: 'rate_limited_burst', summary: `${doc.ip} was blocked 10 times in an hour`, details: { ip: doc.ip } });
  }
}

async function alertAdmins(doc: Record<string, unknown> & { type: string; summary: string; ip: string }, id: unknown) {
  const key = `${doc.type}:${doc.uid ?? ''}:${doc.ip}`;
  const last = recentAlerts.get(key) ?? 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;
  recentAlerts.set(key, Date.now());
  if (recentAlerts.size > 2000) recentAlerts.clear();
  const to = adminAddresses();
  if (!to.length) return;
  const lines = [
    doc.summary,
    [
      `When: ${new Date().toUTCString()}`,
      doc.email ? `Account: ${doc.email}` : '',
      doc.actorEmail ? `Done by: ${doc.actorEmail}` : '',
      `From: ${doc.ip}${doc.country ? ` (${doc.country})` : ''}`,
      doc.device ? `Device: ${doc.device}` : '',
      doc.path ? `Request: ${doc.method} ${doc.path}` : '',
    ].filter(Boolean).join('\n'),
    'Open Admin → Security log to see the full details.',
  ].join('\n\n');
  const subject = `SecureVoult alert: ${EVENT_INFO[doc.type]?.label ?? doc.type}`;
  const r = await sendMail({ to, subject, text: lines, html: brandedHtml(subject, lines, { label: 'Open the security log', url: `${appUrl()}/#/admin/audit` }) });
  if (r.sent) await SecurityEvent.updateOne({ _id: id }, { $set: { alerted: true } }).catch(() => {});
}

/** Tells the account owner about something they should know (new device, 2FA change). */
export async function notifyUser(email: string | null | undefined, subject: string, text: string): Promise<void> {
  if (!email) return;
  const body = `${text}\n\nIf this wasn't you, change your account password, end unknown devices in Settings → Devices, and reply to this email.`;
  await sendMail({ to: email, subject, text: body, html: brandedHtml(subject, body, { label: 'Open SecureVoult', url: `${appUrl()}/#/vault/settings/security` }) });
}

/**
 * On a fresh session: records the sign-in and, if this device type has not
 * been seen on the account in the last 180 days, flags and emails it.
 */
export async function recordSignIn(request: Request, user: { uid: string; email?: string | null }, ua: string): Promise<void> {
  try {
    await connectDB();
    const device = describeDevice(ua);
    const seenBefore = await SecurityEvent.exists({ uid: user.uid, type: { $in: ['sign_in', 'new_device_sign_in'] }, device, at: { $gte: new Date(Date.now() - 180 * 864e5) } });
    const anyBefore = seenBefore ? true : await SecurityEvent.exists({ uid: user.uid, type: { $in: ['sign_in', 'new_device_sign_in'] } });
    const isNew = !seenBefore && !!anyBefore;
    await recordEvent(request, { type: isNew ? 'new_device_sign_in' : 'sign_in', uid: user.uid, email: user.email, userAgent: ua });
    if (isNew) {
      const ip = getClientIp(request), country = request.headers.get('cf-ipcountry');
      await notifyUser(user.email, 'New sign-in to your SecureVoult account',
        `Your account was just signed in on ${device}, from ${ip}${country ? ` (${country})` : ''}, at ${new Date().toUTCString()}.\n\nYour vault is still locked by your master password, which never leaves your devices.`);
    }
  } catch (e) {
    console.error('[security-events] sign-in record failed', e instanceof Error ? e.message : e);
  }
}
