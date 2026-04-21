import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { Incident } from '@/lib/models';
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

  const { searchParams } = new URL(request.url);
  const page      = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit     = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const status    = searchParams.get('status');
  const severity  = searchParams.get('severity');
  const category  = searchParams.get('category');
  const search    = searchParams.get('search');

  const query: Record<string, unknown> = {};
  if (status)   query.status   = status;
  if (severity) query.severity = severity;
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { affectedUserEmail: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const [incidents, total] = await Promise.all([
    Incident.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v'),
    Incident.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    incidents: incidents.map(i => ({
      id: i._id,
      title: i.title,
      category: i.category,
      severity: i.severity,
      status: i.status,
      companyId: i.companyId,
      affectedUserUid: i.affectedUserUid,
      affectedUserEmail: i.affectedUserEmail,
      assignedToUid: i.assignedToUid,
      description: i.description,
      timeline: i.timeline,
      resolvedAt: i.resolvedAt,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { title, category, severity, description, affectedUserEmail, affectedUserUid } = body as Record<string, string>;
  if (!title || !category) {
    return NextResponse.json({ error: 'title and category are required.' }, { status: 400 });
  }

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const incident = await Incident.create({
    title,
    category,
    severity: severity ?? 'medium',
    description: description ?? '',
    affectedUserEmail: affectedUserEmail ?? null,
    affectedUserUid: affectedUserUid ?? null,
    status: 'open',
    timeline: [{
      actorUid: adminResult.adminUid,
      actorEmail: adminResult.adminEmail,
      action: 'incident_created',
      note: description ?? '',
      at: new Date(),
    }],
  });

  return NextResponse.json({ success: true, incident: { id: incident._id, ...incident.toObject() } }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { incidentId, status, note, assignedToUid } = body as Record<string, string>;
  if (!incidentId) {
    return NextResponse.json({ error: 'incidentId is required.' }, { status: 400 });
  }

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) return NextResponse.json({ error: 'Incident not found.' }, { status: 404 });

  const update: Record<string, unknown> = {};
  const timelineEntry = {
    actorUid: adminResult.adminUid,
    actorEmail: adminResult.adminEmail,
    action: 'status_changed',
    note: note ?? '',
    at: new Date(),
  };

  if (status) {
    update.status = status;
    timelineEntry.action = `status_changed_to_${status}`;
    if (status === 'resolved') update.resolvedAt = new Date();
  }
  if (assignedToUid) update.assignedToUid = assignedToUid;
  if (note && !status) timelineEntry.action = 'note_added';

  await Incident.findByIdAndUpdate(incidentId, {
    ...update,
    $push: { timeline: timelineEntry },
  });

  return NextResponse.json({ success: true });
}
