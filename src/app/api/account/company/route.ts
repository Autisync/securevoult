/**
 * GET /api/account/company: the company this account belongs to (if any) and
 * whether it may manage the team. Drives Settings → Team.
 */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { Company } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { serviceUnavailable, tooManyRequests } from '@/lib/api-error';
import { resolveEntitlements } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.sessions);
  if (!rl.allowed) return tooManyRequests(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)));
  const auth = await requireAuthenticatedUser(request);
  if ('error' in auth) return auth.error;
  try { await connectDB(); } catch { return serviceUnavailable('Database unavailable.'); }
  const ent = await resolveEntitlements(auth.user.uid);
  if (!ent.companyId) return NextResponse.json({ success: true, company: null, canManage: false, plan: ent.effectivePlan });
  const c = (await Company.findById(ent.companyId).select('name plan status maxSeats').lean()) as { name: string; plan: string; status?: string; maxSeats: number } | null;
  return NextResponse.json({
    success: true,
    company: c ? { id: ent.companyId, name: c.name, plan: c.plan, status: c.status ?? 'active', maxSeats: c.maxSeats } : null,
    canManage: ent.scope === 'company_admin' || ent.scope === 'global_admin',
    plan: ent.effectivePlan,
  });
}
