import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { Session, User } from '@/lib/models';
import { requireVerifiedAdmin } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

// ── GET — list all active sessions (global admin only) ───────────────────

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
  const search      = searchParams.get('search') ?? '';
  const clientType  = searchParams.get('clientType') ?? '';
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

  const query: Record<string, unknown> = { isRevoked: false };
  if (clientType) query.clientType = clientType;

  const [sessions, total] = await Promise.all([
    Session.find(query).sort({ lastSeenAt: -1 }).skip((page - 1) * limit).limit(limit),
    Session.countDocuments(query),
  ]);

  // Enrich sessions with user info
  const uids = Array.from(new Set(sessions.map((s: { firebaseUid: string }) => s.firebaseUid)));
  const users = await User.find({ firebaseUid: { $in: uids } }).select('firebaseUid email displayName');
  const userMap = new Map(users.map(u => [u.firebaseUid, u]));

  const enriched = sessions
    .filter(s => {
      if (!search) return true;
      const u = userMap.get(s.firebaseUid);
      const searchLower = search.toLowerCase();
      return (
        u?.email?.toLowerCase().includes(searchLower) ||
        u?.displayName?.toLowerCase().includes(searchLower) ||
        s.userAgent?.toLowerCase().includes(searchLower) ||
        s.ipAddress?.includes(search)
      );
    })
    .map(s => {
      const u = userMap.get(s.firebaseUid);
      return {
        id:          s._id,
        sessionId:   s.sessionId,
        firebaseUid: s.firebaseUid,
        userEmail:   u?.email ?? '',
        userName:    u?.displayName ?? '',
        clientType:  s.clientType,
        userAgent:   s.userAgent,
        ipAddress:   s.ipAddress,
        lastSeenAt:  s.lastSeenAt,
        createdAt:   s.createdAt,
      };
    });

  // Summary counts
  const [totalActive, byClient] = await Promise.all([
    Session.countDocuments({ isRevoked: false }),
    Session.aggregate([
      { $match: { isRevoked: false } },
      { $group: { _id: '$clientType', count: { $sum: 1 } } },
    ]),
  ]);

  const clientSummary = { web: 0, extension: 0, mobile: 0 };
  for (const b of byClient) {
    if (b._id in clientSummary) clientSummary[b._id as keyof typeof clientSummary] = b.count;
  }

  return NextResponse.json({
    success: true,
    sessions: enriched,
    summary: { totalActive, ...clientSummary },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ── DELETE — revoke a specific session ──────────────────────────────────

export async function DELETE(request: NextRequest) {
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

  const { sessionId } = body as Record<string, string>;
  if (!sessionId?.trim()) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  try { await connectDB(); } catch {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const result = await Session.findOneAndUpdate(
    { sessionId: sessionId.trim() },
    { isRevoked: true },
    { new: true }
  );

  if (!result) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Session revoked.' });
}
