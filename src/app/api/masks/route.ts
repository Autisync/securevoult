/**
 * /api/masks: email masking. Each mask forwards to the account's own email.
 *
 *   GET                                          your masks, and whether masking is set up
 *   POST { action: 'create', usedFor? }          a new mask
 *   POST { action: 'update', id, usedFor?, enabled? }
 *   POST { action: 'delete', id }
 */
import { NextRequest, NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import connectDB from '@/lib/db-connect';
import { EmailMask } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { apiError, badRequest, notFound, serviceUnavailable, tooManyRequests } from '@/lib/api-error';
import { MailcowError, createAlias, deleteAlias, maskDomain, maskingConfigured, newMaskAddress, setAliasActive } from '@/lib/mailcow';

export const dynamic = 'force-dynamic';

const MAX_MASKS = 50;

type Mask = { _id: unknown; address: string; forwardTo: string; usedFor: string; enabled: boolean; mailcowId?: string | null; createdAt?: Date; save: () => Promise<unknown>; deleteOne: () => Promise<unknown> };
const view = (m: Mask) => ({ id: String(m._id), address: m.address, forwardTo: m.forwardTo, usedFor: m.usedFor, enabled: m.enabled, createdAt: m.createdAt });

async function guard(request: NextRequest) {
  const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.sessions);
  if (!rl.allowed) return { error: tooManyRequests(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) };
  const auth = await requireAuthenticatedUser(request);
  if ('error' in auth) return { error: auth.error };
  try { await connectDB(); } catch { return { error: serviceUnavailable('Database unavailable.') }; }
  return { user: auth.user };
}

const fail = (e: unknown) => apiError(503, 'mail_server', e instanceof MailcowError ? e.message : 'The mail server could not be reached.');

export async function GET(request: NextRequest) {
  const g = await guard(request);
  if ('error' in g) return g.error;
  const masks = (await EmailMask.find({ uid: g.user.uid }).sort({ createdAt: -1 })) as unknown as Mask[];
  return NextResponse.json({ success: true, configured: maskingConfigured(), domain: maskDomain() || null, forwardTo: g.user.email, max: MAX_MASKS, masks: masks.map(view) });
}

export async function POST(request: NextRequest) {
  const g = await guard(request);
  if ('error' in g) return g.error;
  const body = (await request.json().catch(() => ({}))) as { action?: string; id?: string; usedFor?: string; enabled?: boolean };
  const usedFor = typeof body.usedFor === 'string' ? body.usedFor.trim().slice(0, 120) : undefined;

  if (body.action === 'create') {
    if (!maskingConfigured()) return serviceUnavailable('Email masking is not set up on this server yet.');
    if (!g.user.email) return badRequest('Your account has no email address to forward to.');
    if ((await EmailMask.countDocuments({ uid: g.user.uid })) >= MAX_MASKS) return badRequest(`You can have up to ${MAX_MASKS} masks. Delete one you no longer use.`);
    let address = newMaskAddress();
    for (let i = 0; i < 5 && (await EmailMask.exists({ address })); i++) address = newMaskAddress();
    let mailcowId: string | null;
    try { mailcowId = await createAlias(address, g.user.email); } catch (e) { return fail(e); }
    const m = (await EmailMask.create({ uid: g.user.uid, address, forwardTo: g.user.email, usedFor: usedFor ?? '', enabled: true, mailcowId })) as unknown as Mask;
    return NextResponse.json({ success: true, mask: view(m) });
  }

  if (!body.id || !isValidObjectId(body.id)) return badRequest('Missing mask id.');
  const m = (await EmailMask.findOne({ _id: body.id, uid: g.user.uid })) as unknown as Mask | null;
  if (!m) return notFound('Mask not found.');

  if (body.action === 'update') {
    if (usedFor !== undefined) m.usedFor = usedFor;
    if (typeof body.enabled === 'boolean' && body.enabled !== m.enabled) {
      try { if (m.mailcowId) await setAliasActive(m.mailcowId, body.enabled); } catch (e) { return fail(e); }
      m.enabled = body.enabled;
    }
    await m.save();
    return NextResponse.json({ success: true, mask: view(m) });
  }

  if (body.action === 'delete') {
    try { if (m.mailcowId) await deleteAlias(m.mailcowId); } catch (e) { return fail(e); }
    await m.deleteOne();
    return NextResponse.json({ success: true });
  }

  return badRequest('Unknown action.');
}
