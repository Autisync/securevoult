/**
 * /api/notifications: the bell menu's server-side items (new breaches…).
 *   GET                                   latest 50
 *   POST { action: 'read', ids? }         mark some (or all) as read
 */
import { NextRequest, NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import connectDB from '@/lib/db-connect';
import { AppNotification } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

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
  const items = (await AppNotification.find({ uid: g.user.uid }).sort({ at: -1 }).limit(50).lean()) as unknown as
    { _id: unknown; kind: string; title: string; body: string; link: string; read: boolean; at: Date }[];
  return NextResponse.json({ success: true, items: items.map((n) => ({ id: String(n._id), kind: n.kind, title: n.title, body: n.body, link: n.link, read: n.read, at: n.at })) });
}

export async function POST(request: NextRequest) {
  const g = await guard(request);
  if ('error' in g) return g.error;
  const body = (await request.json().catch(() => ({}))) as { action?: string; ids?: string[] };
  if (body.action === 'read') {
    const ids = Array.isArray(body.ids) ? body.ids.filter((i) => typeof i === 'string' && isValidObjectId(i)).slice(0, 100) : null;
    await AppNotification.updateMany({ uid: g.user.uid, ...(ids ? { _id: { $in: ids } } : {}) }, { $set: { read: true } });
  }
  return NextResponse.json({ success: true });
}
