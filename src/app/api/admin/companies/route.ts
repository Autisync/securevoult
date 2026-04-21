import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { Company, User, BreachFinding } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

// ── GET — list all companies ─────────────────────────────────────────────

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

  const { searchParams } = new URL(request.url);
  const search   = searchParams.get('search') ?? '';
  const planFilter = searchParams.get('plan') ?? '';
  const activeFilter = searchParams.get('active') ?? '';
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

  const query: Record<string, unknown> = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }
  if (planFilter) query.plan = planFilter;
  if (activeFilter !== '') query.isActive = activeFilter === 'true';

  const [companies, total] = await Promise.all([
    Company.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Company.countDocuments(query),
  ]);

  // For each company, fetch member count, owner email, and breach summary
  const companyIds = companies.map(c => c._id);
  const [memberCounts, owners, breachCounts] = await Promise.all([
    User.aggregate([
      { $match: { companyId: { $in: companyIds } } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } },
    ]),
    User.find({ firebaseUid: { $in: companies.map(c => c.ownerFirebaseUid) } })
      .select('firebaseUid email displayName'),
    BreachFinding.aggregate([
      { $match: { companyId: { $in: companyIds }, status: { $in: ['new', 'investigating'] } } },
      {
        $group: {
          _id: '$companyId',
          total:    { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          high:     { $sum: { $cond: [{ $eq: ['$severity', 'high'] },     1, 0] } },
          medium:   { $sum: { $cond: [{ $eq: ['$severity', 'medium'] },   1, 0] } },
          low:      { $sum: { $cond: [{ $eq: ['$severity', 'low'] },      1, 0] } },
        },
      },
    ]),
  ]);

  const memberCountMap = new Map(memberCounts.map((m: { _id: string; count: number }) => [String(m._id), m.count]));
  const ownerMap = new Map(owners.map(o => [o.firebaseUid, o]));
  const breachMap = new Map(breachCounts.map((b: { _id: string; total: number; critical: number; high: number; medium: number; low: number }) => [String(b._id), b]));

  return NextResponse.json({
    success: true,
    companies: companies.map(c => {
      const owner = ownerMap.get(c.ownerFirebaseUid);
      const breach = breachMap.get(String(c._id));
      return {
        id:              c._id,
        name:            c.name,
        slug:            c.slug,
        plan:            c.plan,
        isActive:        c.isActive,
        ownerFirebaseUid: c.ownerFirebaseUid,
        ownerEmail:      owner?.email ?? '',
        ownerName:       owner?.displayName ?? '',
        memberCount:     memberCountMap.get(String(c._id)) ?? 0,
        breachSummary: {
          total:    breach?.total    ?? 0,
          critical: breach?.critical ?? 0,
          high:     breach?.high     ?? 0,
          medium:   breach?.medium   ?? 0,
          low:      breach?.low      ?? 0,
        },
        adminNotes:      c.adminNotes ?? [],
        createdAt:       c.createdAt,
        updatedAt:       c.updatedAt,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ── POST — create a company ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { name, slug, ownerFirebaseUid, plan } = body as Record<string, string>;

  if (!name?.trim() || !slug?.trim() || !ownerFirebaseUid?.trim()) {
    return NextResponse.json({ error: 'name, slug, and ownerFirebaseUid are required.' }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug.trim().toLowerCase())) {
    return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens.' }, { status: 400 });
  }

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const existing = await Company.findOne({ slug: slug.trim().toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: 'A company with this slug already exists.' }, { status: 409 });
  }

  const company = await Company.create({
    name: name.trim(),
    slug: slug.trim().toLowerCase(),
    ownerFirebaseUid: ownerFirebaseUid.trim(),
    plan: ['free', 'pro', 'enterprise'].includes(plan) ? plan : 'free',
  });

  return NextResponse.json({ success: true, company: { id: company._id, name: company.name, slug: company.slug } }, { status: 201 });
}

// ── PUT — update company (activate/deactivate, plan change, add note) ────

export async function PUT(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { companyId, isActive, plan, note } = body as Record<string, unknown>;

  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const company = await Company.findById(companyId);
  if (!company) {
    return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  }

  if (typeof isActive === 'boolean') company.isActive = isActive;
  if (typeof plan === 'string' && ['free', 'pro', 'enterprise'].includes(plan)) company.plan = plan;

  if (typeof note === 'string' && note.trim()) {
    company.adminNotes.push({
      authorUid: adminResult.adminUid,
      text: note.trim(),
      createdAt: new Date(),
    });
  }

  await company.save();

  return NextResponse.json({ success: true });
}
