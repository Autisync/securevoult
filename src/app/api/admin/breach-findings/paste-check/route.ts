/**
 * GET /api/admin/breach-findings/paste-check?email=user@example.com
 *
 * Checks whether an email address appears in known paste dumps via the
 * HaveIBeenPwned Paste API (/api/v3/pasteaccount/{email}).
 *
 * Pastes are public code/text snippets (Pastebin, GitHub, etc.) that contain
 * credential dumps. Unlike the breach API, paste data is often raw leaked
 * content rather than a named company breach event.
 *
 * Requirements:
 *  - HIBP_API_KEY env var (same key used for breach-by-account).
 *  - Returns { notConfigured: true } when the key is absent.
 *  - 404 from HIBP → { email, pastes: [] } (not found in any paste).
 *
 * Rate limits:
 *  - HIBP Paste API: 1 request/1.5s per IP. This endpoint is rate-limited
 *    via our standard admin rate limiter.
 *  - Only global admins may call this endpoint.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export interface HibpPaste {
  Source: string;
  Id: string;
  Title: string | null;
  Date: string | null;
  EmailCount: number;
}

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
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });
  }

  try {
    const url = `https://haveibeenpwned.com/api/v3/pasteaccount/${encodeURIComponent(email)}`;
    const res = await fetch(url, {
      headers: {
        'hibp-api-key': apiKey,
        'user-agent': 'SecureVoult-AdminConsole/1.0',
      },
    });

    if (res.status === 404) {
      return NextResponse.json({ email, pastes: [] });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `HIBP Paste API error ${res.status}: ${body.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const pastes: HibpPaste[] = await res.json();
    return NextResponse.json({ email, pastes: Array.isArray(pastes) ? pastes : [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to contact HIBP' },
      { status: 502 }
    );
  }
}
