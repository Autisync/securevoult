import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { apiError, badRequest, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, RATE_LIMITS.admin);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const adminResult = await requireVerifiedAdmin(req);
  if ('error' in adminResult) return adminResult.error;

  const apiKey = process.env.HIBP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ notConfigured: true });
  }

  const email = req.nextUrl.searchParams.get('email')?.trim();
  if (!email || !email.includes('@')) {
    return badRequest('Valid email required');
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
      return apiError(502, 'upstream_error', `HIBP API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const breaches = await res.json();
    return NextResponse.json({ email, breaches: Array.isArray(breaches) ? breaches : [] });
  } catch (err) {
    return apiError(502, 'upstream_error', err instanceof Error ? err.message : 'Failed to contact HIBP');
  }
}
