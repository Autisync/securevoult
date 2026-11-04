import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { BreachFinding } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { badRequest, serviceUnavailable, tooManyRequests } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.admin);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const { searchParams } = new URL(request.url);
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit    = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const status   = searchParams.get('status');
  const severity = searchParams.get('severity');
  const uid      = searchParams.get('uid');

  const query: Record<string, unknown> = {};
  if (status)   query.status   = status;
  if (severity) query.severity = severity;
  if (uid)      query.firebaseUid = uid;

  const [findings, total] = await Promise.all([
    BreachFinding.find(query)
      .sort({ firstDetectedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v'),
    BreachFinding.countDocuments(query),
  ]);

  // Summary stats
  const [critical, high, medium, low, resolved] = await Promise.all([
    BreachFinding.countDocuments({ status: { $in: ['new', 'investigating'] }, severity: 'critical' }),
    BreachFinding.countDocuments({ status: { $in: ['new', 'investigating'] }, severity: 'high' }),
    BreachFinding.countDocuments({ status: { $in: ['new', 'investigating'] }, severity: 'medium' }),
    BreachFinding.countDocuments({ status: { $in: ['new', 'investigating'] }, severity: 'low' }),
    BreachFinding.countDocuments({ status: 'resolved' }),
  ]);

  return NextResponse.json({
    success: true,
    summary: { critical, high, medium, low, resolved },
    findings: findings.map(f => ({
      id: f._id,
      firebaseUid: f.firebaseUid,
      entryId: f.entryId,
      entryLabel: f.entryLabel,
      entryUrl: f.entryUrl,
      breachType: f.breachType,
      severity: f.severity,
      status: f.status,
      hibpCount: f.hibpCount,
      firstDetectedAt: f.firstDetectedAt,
      lastCheckedAt: f.lastCheckedAt,
      resolvedAt: f.resolvedAt,
      notes: f.notes,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function PUT(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.adminAction);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const adminResult = await requireVerifiedAdmin(request);
  if ('error' in adminResult) return adminResult.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return badRequest('Invalid JSON.');
  }

  const { findingId, status, note } = body as Record<string, string>;
  if (!findingId) return badRequest('findingId is required.');

  try { await connectDB(); } catch {
    return serviceUnavailable('Database unavailable.');
  }

  const update: Record<string, unknown> = {};
  if (status) {
    update.status = status;
    if (status === 'resolved') update.resolvedAt = new Date();
  }
  if (note) {
    await BreachFinding.findByIdAndUpdate(findingId, {
      ...update,
      $push: {
        notes: {
          authorUid: adminResult.adminUid,
          text: note,
          createdAt: new Date(),
        },
      },
    });
  } else {
    await BreachFinding.findByIdAndUpdate(findingId, update);
  }

  return NextResponse.json({ success: true });
}
