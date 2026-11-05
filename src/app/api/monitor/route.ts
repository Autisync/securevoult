/**
 * /api/monitor: the Data breach scanner.
 *
 *   GET                                     your watched addresses and what was found
 *   POST { action: 'add', email }           watch another address (a code is emailed to it)
 *   POST { action: 'verify', email, code }  confirm it with the code
 *   POST { action: 'check', email }         check now
 *   POST { action: 'dismiss', email, name } mark a breach as dealt with
 *   POST { action: 'remove', email }        stop watching
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { MonitoredEmail } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { apiError, badRequest, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';
import { BreachLookupError, breachSource, checkMonitored, hashCode, sendVerifyCode } from '@/lib/breach-monitor';
import { mailConfigured } from '@/lib/mailer';
import { resolveEntitlements } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

/** Watched addresses allowed on the plan (-1 = unlimited, capped at 25). */
async function maxEmails(uid: string): Promise<number> {
  try { const n = (await resolveEntitlements(uid)).limits.maxMonitoredEmails; return n < 0 ? 25 : Math.max(1, n); }
  catch { return 1; }
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Doc = {
  _id: unknown; uid: string; email: string; notifyTo: string; verified: boolean; lastChecked?: Date | null; source?: string | null;
  codeHash?: string | null; codeExpires?: Date | null; codeTries?: number; createdAt?: Date;
  breaches: { name: string; title: string; domain: string; date: string; count: number; dataClasses: string[]; description: string; firstSeen?: Date; dismissed?: boolean }[];
  save: () => Promise<unknown>; deleteOne: () => Promise<unknown>;
};

const view = (d: Doc, own: string) => ({
  email: d.email,
  own: d.email === own,
  verified: d.verified,
  lastChecked: d.lastChecked ?? null,
  source: d.source ?? null,
  breaches: [...d.breaches]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((b) => ({ name: b.name, title: b.title, domain: b.domain, date: b.date, count: b.count, dataClasses: b.dataClasses, description: b.description, firstSeen: b.firstSeen, dismissed: !!b.dismissed })),
});

async function guard(request: NextRequest) {
  const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.sessions);
  if (!rl.allowed) return { error: tooManyRequests(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) };
  const auth = await requireAuthenticatedUser(request);
  if ('error' in auth) return { error: auth.error };
  try { await connectDB(); } catch { return { error: serviceUnavailable('Database unavailable.') }; }
  return { user: auth.user };
}

export async function GET(request: NextRequest) {
  const g = await guard(request);
  if ('error' in g) return g.error;
  const own = g.user.email.toLowerCase();
  // The account's own address is watched from the start.
  if (own && !(await MonitoredEmail.exists({ uid: g.user.uid, email: own }))) {
    await MonitoredEmail.create({ uid: g.user.uid, email: own, notifyTo: own, verified: true }).catch(() => {});
  }
  const docs = (await MonitoredEmail.find({ uid: g.user.uid }).sort({ createdAt: 1 })) as unknown as Doc[];
  // First visit: check the account's address straight away so the page isn't empty.
  for (const d of docs) {
    if (d.verified && !d.lastChecked) { try { await checkMonitored(d, { notify: false }); } catch { /* shown as "not checked yet" */ } }
  }
  return NextResponse.json({ success: true, source: breachSource(), max: await maxEmails(g.user.uid), emails: docs.map((d) => view(d, own)) });
}

export async function POST(request: NextRequest) {
  const g = await guard(request);
  if ('error' in g) return g.error;
  const own = g.user.email.toLowerCase();
  const body = (await request.json().catch(() => ({}))) as { action?: string; email?: string; code?: string; name?: string };
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return badRequest('Enter a valid email address.');

  const doc = (await MonitoredEmail.findOne({ uid: g.user.uid, email })) as unknown as Doc | null;

  switch (body.action) {
    case 'add': {
      if (doc?.verified) return NextResponse.json({ success: true, email: view(doc, own) });
      const max = await maxEmails(g.user.uid);
      if (!doc && email !== own && (await MonitoredEmail.countDocuments({ uid: g.user.uid })) >= max) return apiError(402, 'plan_limit', `Your plan watches up to ${max} address${max === 1 ? '' : 'es'}. Upgrade to watch more.`);
      if (email === own) {
        const d = doc ?? ((await MonitoredEmail.create({ uid: g.user.uid, email, notifyTo: own, verified: true })) as unknown as Doc);
        return NextResponse.json({ success: true, email: view(d, own) });
      }
      if (!mailConfigured()) return serviceUnavailable('Email is not set up on this server yet, so the confirmation code can\'t be sent.');
      // One code per address per minute.
      if (doc?.codeExpires && doc.codeExpires.getTime() - 14 * 60_000 > Date.now()) return tooManyRequests(60);
      const { code, sent } = await sendVerifyCode(email);
      if (!sent) return serviceUnavailable('The confirmation email could not be sent. Try again shortly.');
      const d = doc ?? ((await MonitoredEmail.create({ uid: g.user.uid, email, notifyTo: own, verified: false })) as unknown as Doc);
      d.codeHash = hashCode(code); d.codeExpires = new Date(Date.now() + 15 * 60_000); d.codeTries = 0;
      await d.save();
      return NextResponse.json({ success: true, codeSent: true, email: view(d, own) });
    }
    case 'verify': {
      if (!doc) return notFound('Add the address first.');
      if (doc.verified) return NextResponse.json({ success: true, email: view(doc, own) });
      const code = String(body.code ?? '').replace(/\D/g, '');
      if (!doc.codeHash || !doc.codeExpires || doc.codeExpires.getTime() < Date.now()) return badRequest('That code has expired. Send a new one.');
      if ((doc.codeTries ?? 0) >= 5) return badRequest('Too many wrong codes. Send a new one.');
      if (hashCode(code) !== doc.codeHash) {
        doc.codeTries = (doc.codeTries ?? 0) + 1; await doc.save();
        return badRequest('That code isn\'t right.');
      }
      doc.verified = true; doc.codeHash = null; doc.codeExpires = null; doc.codeTries = 0;
      await doc.save();
      try { await checkMonitored(doc, { notify: false }); } catch { /* checked by the daily job */ }
      return NextResponse.json({ success: true, email: view(doc, own) });
    }
    case 'check': {
      if (!doc?.verified) return notFound('Confirm the address first.');
      if (doc.lastChecked && Date.now() - doc.lastChecked.getTime() < 5 * 60_000) return NextResponse.json({ success: true, email: view(doc, own), recent: true });
      try { await checkMonitored(doc, { notify: false }); }
      catch (e) {
        if (e instanceof BreachLookupError) return apiError(503, 'breach_lookup_failed', e.message);
        return serviceUnavailable('The breach check failed. Try again shortly.');
      }
      return NextResponse.json({ success: true, email: view(doc, own) });
    }
    case 'dismiss': {
      if (!doc) return notFound('Not found.');
      const b = doc.breaches.find((x) => x.name === body.name);
      if (b) { b.dismissed = true; await doc.save(); }
      return NextResponse.json({ success: true, email: view(doc, own) });
    }
    case 'remove': {
      if (doc) await doc.deleteOne();
      return NextResponse.json({ success: true });
    }
    default:
      return badRequest('Unknown action.');
  }
}
