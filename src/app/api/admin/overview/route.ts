import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { User, Session, Incident, BreachFinding, Company } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.admin);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    adminCount,
    activeSessions,
    newUsersToday,
    openIncidents,
    criticalIncidents,
    totalBreachFindings,
    unresolvedBreaches,
    totalCompanies,
    activeCompanies,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'admin' }),
    Session.countDocuments({ isRevoked: false, lastSeenAt: { $gte: last24h } }),
    User.countDocuments({ createdAt: { $gte: last24h } }),
    Incident.countDocuments({ status: { $in: ['open', 'investigating', 'waiting'] } }),
    Incident.countDocuments({ status: { $in: ['open', 'investigating'] }, severity: 'critical' }),
    BreachFinding.countDocuments({}),
    BreachFinding.countDocuments({ status: { $in: ['new', 'investigating'] } }),
    Company.countDocuments({}),
    Company.countDocuments({ isActive: true }),
  ]);

  // Plan distribution across users
  const planDistribution = await User.aggregate([
    { $group: { _id: { $ifNull: ['$plan', 'free'] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Companies at risk: have critical/high unresolved breach findings
  const companiesAtRisk = await BreachFinding.distinct('companyId', {
    status: { $in: ['new', 'investigating'] },
    severity: { $in: ['critical', 'high'] },
    companyId: { $ne: null },
  });

  // Company plan distribution
  const companyPlanDist = await Company.aggregate([
    { $group: { _id: { $ifNull: ['$plan', 'free'] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Recent incidents (last 5)
  const recentIncidents = await Incident.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .select('title category severity status createdAt affectedUserEmail');

  // New user trend (last 7 days)
  const newUsersWeek = await User.countDocuments({ createdAt: { $gte: last7d } });

  return NextResponse.json({
    success: true,
    metrics: {
      totalUsers,
      activeUsers,
      adminCount,
      activeSessions,
      newUsersToday,
      newUsersWeek,
      openIncidents,
      criticalIncidents,
      totalBreachFindings,
      unresolvedBreaches,
      totalCompanies,
      activeCompanies,
      companiesAtRisk: companiesAtRisk.length,
      planDistribution: Object.fromEntries(
        planDistribution.map((p: { _id: string; count: number }) => [p._id, p.count])
      ),
      companyPlanDistribution: Object.fromEntries(
        companyPlanDist.map((p: { _id: string; count: number }) => [p._id, p.count])
      ),
    },
    recentIncidents: recentIncidents.map(i => ({
      id: i._id,
      title: i.title,
      category: i.category,
      severity: i.severity,
      status: i.status,
      createdAt: i.createdAt,
      affectedUserEmail: i.affectedUserEmail,
    })),
  });
}
