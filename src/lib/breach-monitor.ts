/**
 * Data breach scanner: is this email address in a known breach?
 *
 * Asks Have I Been Pwned when HIBP_API_KEY is set (paid key, the standard
 * source), otherwise XposedOrNot (free, no key). Only the email address is
 * sent, never a password. Server-side only.
 */
import { createHash, randomInt } from 'crypto';
import connectDB from '@/lib/db-connect';
import { AppNotification, MonitoredEmail } from '@/lib/models';
import { sendMail, brandedHtml } from '@/lib/mailer';

export interface Breach {
  name: string;
  title: string;
  domain: string;
  /** YYYY-MM-DD or YYYY */
  date: string;
  count: number;
  dataClasses: string[];
  description: string;
}

export class BreachLookupError extends Error {
  constructor(message: string, public retryAfter?: number) { super(message); }
}

const UA = 'SecureVoult-BreachMonitor';
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://vault.autisync.com';
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export function breachSource(): 'hibp' | 'xposedornot' {
  return (process.env.HIBP_API_KEY ?? '').trim() ? 'hibp' : 'xposedornot';
}

async function fromHibp(email: string): Promise<Breach[]> {
  const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
    headers: { 'hibp-api-key': (process.env.HIBP_API_KEY ?? '').trim(), 'user-agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return [];
  if (res.status === 429) throw new BreachLookupError('Too many checks right now. Try again in a minute.', Number(res.headers.get('retry-after')) || 60);
  if (res.status === 401) throw new BreachLookupError('The Have I Been Pwned key was refused. Check HIBP_API_KEY on the server.');
  if (!res.ok) throw new BreachLookupError(`Have I Been Pwned answered ${res.status}.`);
  const list = (await res.json()) as { Name: string; Title: string; Domain: string; BreachDate: string; PwnCount: number; DataClasses: string[]; Description: string }[];
  return list.map((b) => ({
    name: b.Name, title: b.Title || b.Name, domain: b.Domain || '', date: b.BreachDate || '', count: b.PwnCount || 0,
    dataClasses: b.DataClasses ?? [], description: stripHtml(b.Description ?? '').slice(0, 600),
  }));
}

async function fromXposedOrNot(email: string): Promise<Breach[]> {
  const res = await fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return [];
  if (res.status === 429) throw new BreachLookupError('Too many checks right now. Try again in a minute.', 60);
  if (!res.ok) throw new BreachLookupError(`The breach service answered ${res.status}.`);
  const data = (await res.json().catch(() => ({}))) as {
    Error?: string;
    ExposedBreaches?: { breaches_details?: { breach: string; domain?: string; xposed_date?: string; xposed_records?: number; xposed_data?: string; details?: string }[] } | null;
  };
  if (data.Error) return [];
  const list = data.ExposedBreaches?.breaches_details ?? [];
  return list.map((b) => ({
    name: b.breach, title: b.breach, domain: b.domain ?? '', date: b.xposed_date ?? '', count: Number(b.xposed_records) || 0,
    dataClasses: (b.xposed_data ?? '').split(';').map((x) => x.trim()).filter(Boolean),
    description: stripHtml(b.details ?? '').slice(0, 600),
  }));
}

export async function lookupEmail(email: string): Promise<{ source: 'hibp' | 'xposedornot'; breaches: Breach[] }> {
  const source = breachSource();
  const breaches = source === 'hibp' ? await fromHibp(email) : await fromXposedOrNot(email);
  return { source, breaches };
}

type MonitoredDoc = {
  _id: unknown; uid: string; email: string; notifyTo: string; verified: boolean; lastChecked?: Date | null;
  breaches: (Breach & { firstSeen?: Date; dismissed?: boolean })[];
  save: () => Promise<unknown>;
};

/** Checks one monitored address, stores the result and returns the breaches that are new since last time. */
export async function checkMonitored(doc: MonitoredDoc, { notify }: { notify: boolean }): Promise<Breach[]> {
  const { source, breaches } = await lookupEmail(doc.email);
  const known = new Map(doc.breaches.map((b) => [b.name, b]));
  const firstCheck = !doc.lastChecked;
  const fresh = breaches.filter((b) => !known.has(b.name));
  doc.breaches = breaches.map((b) => ({ ...b, firstSeen: known.get(b.name)?.firstSeen ?? new Date(), dismissed: known.get(b.name)?.dismissed ?? false }));
  doc.lastChecked = new Date();
  (doc as unknown as { source: string }).source = source;
  await doc.save();
  // The first scan of an address reports what it found on screen; later scans tell the user about anything new.
  if (fresh.length && !firstCheck && notify) await tellUser(doc, fresh);
  return fresh;
}

async function tellUser(doc: MonitoredDoc, fresh: Breach[]) {
  const names = fresh.map((b) => b.title).slice(0, 5).join(', ') + (fresh.length > 5 ? ` and ${fresh.length - 5} more` : '');
  const title = `${doc.email} appeared in ${fresh.length === 1 ? 'a new data breach' : `${fresh.length} new data breaches`}`;
  await AppNotification.create({ uid: doc.uid, kind: 'breach', title, body: names, link: 'breach' });
  const text = `${title}: ${names}.\n\nChange the password for those sites (and anywhere you used the same one), and turn on two-step sign-in where you can. Open the Data breach scanner in SecureVoult for the details.`;
  await sendMail({ to: doc.notifyTo, subject: 'SecureVoult: your email was found in a data breach', text, html: brandedHtml('Your email was found in a data breach', text, { label: 'See the details', url: `${appUrl()}/#/vault/breach` }) }).catch(() => {});
}

/** Daily: re-checks every verified address not checked in the last 20 hours. Gentle on the services' limits. */
export async function checkAllMonitored(): Promise<{ checked: number; newBreaches: number; failed: number }> {
  await connectDB();
  const due = (await MonitoredEmail.find({ verified: true, $or: [{ lastChecked: null }, { lastChecked: { $lt: new Date(Date.now() - 20 * 3600 * 1000) } }] }).limit(500)) as unknown as MonitoredDoc[];
  let checked = 0, newBreaches = 0, failed = 0;
  const gap = breachSource() === 'hibp' ? 6500 : 1500;
  for (const doc of due) {
    try { newBreaches += (await checkMonitored(doc, { notify: true })).length; checked++; }
    catch (e) {
      failed++;
      if (e instanceof BreachLookupError && e.retryAfter) await new Promise((r) => setTimeout(r, e.retryAfter! * 1000));
    }
    await new Promise((r) => setTimeout(r, gap));
  }
  return { checked, newBreaches, failed };
}

// ── Verifying an extra address ───────────────────────────────────────────────
export const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

export async function sendVerifyCode(to: string): Promise<{ code: string; sent: boolean }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const text = `Your code is ${code}.\n\nSomeone asked SecureVoult to watch ${to} for data breaches. Enter this code in the Data breach scanner to confirm it's your address. It works for 15 minutes.\n\nIf this wasn't you, ignore this email: nothing happens without the code.`;
  const r = await sendMail({ to, subject: `${code} is your SecureVoult code`, text, html: brandedHtml('Confirm this email address', text) });
  return { code, sent: r.sent };
}
