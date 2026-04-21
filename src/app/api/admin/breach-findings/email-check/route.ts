import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, RATE_LIMITS.admin);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const adminResult = await requireVerifiedAdmin(req);
  if ('error' in adminResult) return adminResult.error;

  const apiKey = process.env.HIBP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ notConfigured: true });
  }

  const email = req.nextUrl.searchParams.get('email')?.trim();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  try {
    const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
    const res = await fetch(url, {
      headers: {
        'hibp-api-key': apiKey,
        'user-agent': 'SecureVoult-AdminConsole/1.0',
      },
    });

    if (res.status === 404) {
      return NextResponse.json({ email, breaches: [] });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `HIBP API error ${res.status}: ${body.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const breaches = await res.json();
    return NextResponse.json({ email, breaches: Array.isArray(breaches) ? breaches : [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to contact HIBP' },
      { status: 502 }
    );
  }
}
