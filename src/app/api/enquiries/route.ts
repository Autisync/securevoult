/**
 * POST /api/enquiries: the partner and Enterprise quote forms on the website.
 * Sent to the CRM as a contact with its own deal, and emailed to the team.
 * Public, so: rate limited per IP, a hidden "website" field catches bots.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';
import { badRequest, serviceUnavailable, tooManyRequests } from '@/lib/api-error';
import { notifyEnquiry } from '@/lib/crm';
import { sendMail, mailConfigured } from '@/lib/mailer';
import { LEGAL } from '@/lib/legal';

export const dynamic = 'force-dynamic';

const LIMIT: RateLimitConfig = { key: 'enquiry', limit: 5, windowMs: 60 * 60 * 1000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(getClientIp(request), LIMIT);
  if (!rl.allowed) return tooManyRequests(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)));
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (clip(b.website, 200)) return NextResponse.json({ success: true }); // bot: say thanks, do nothing

  const kind = b.kind === 'quote' ? 'quote' : 'partner';
  const e = {
    kind: kind as 'partner' | 'quote',
    name: clip(b.name, 120), email: clip(b.email, 254).toLowerCase(), company: clip(b.company, 200),
    phone: clip(b.phone, 40), country: clip(b.country, 80), seats: clip(b.seats, 20), message: clip(b.message, 2000),
  };
  if (!e.name) return badRequest('Please tell us your name.');
  if (!EMAIL.test(e.email)) return badRequest('Please enter a valid email address.');
  if (!e.company) return badRequest('Please tell us your company name.');

  const [inCrm, mailed] = await Promise.all([
    notifyEnquiry(e),
    mailConfigured()
      ? sendMail({
          to: LEGAL.email,
          subject: `SecureVoult ${kind === 'quote' ? 'Enterprise quote' : 'partner'} enquiry: ${e.company}`,
          text: [`Name: ${e.name}`, `Email: ${e.email}`, `Company: ${e.company}`, e.phone && `Phone: ${e.phone}`, e.country && `Country: ${e.country}`, e.seats && `Seats: ${e.seats}`, '', e.message].filter((x) => x !== '' && x !== undefined).join('\n'),
        }).then((r) => r.sent)
      : Promise.resolve(false),
  ]);
  if (!inCrm && !mailed) return serviceUnavailable(`We couldn't send that just now. Please email ${LEGAL.email} instead.`);
  return NextResponse.json({ success: true });
}
