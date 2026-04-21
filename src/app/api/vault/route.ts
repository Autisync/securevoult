import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { Vault } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { logLimitEvent } from '@/lib/limit-logger';

async function ensureDB() {
  try {
    await connectDB();
  } catch {
    return NextResponse.json(
      { error: 'Database unavailable. Please try again later.' },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  const dbError = await ensureDB();
  if (dbError) return dbError;

  const { uid } = authResult.user;

  const vault = await Vault.findOne({ userId: uid });

  return NextResponse.json({
    success: true,
    vault: vault
      ? { encryptedData: vault.encryptedVault, version: vault.version, lastSync: vault.lastSync }
      : { encryptedData: '', version: 1, lastSync: null },
  });
}

export async function POST(request: NextRequest) {
  // Rate limit: 60 vault writes per 15 min per IP
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  const dbError = await ensureDB();
  if (dbError) return dbError;

  const { uid } = authResult.user;

  let body: { encryptedVault?: string; version?: number; entryCount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { encryptedVault, version, entryCount } = body;

  if (!encryptedVault || typeof encryptedVault !== 'string') {
    return NextResponse.json(
      { error: 'encryptedVault (string) is required' },
      { status: 400 }
    );
  }

  // ── Plan enforcement: entry count ─────────────────────────────────────────
  // The vault is a zero-knowledge encrypted blob, so the server cannot count
  // individual entries. The client passes entryCount as metadata; we enforce
  // it here. A malicious client could lie, but: (a) zero-knowledge design
  // means we cannot do better without decryption, and (b) legitimate clients
  // always send the real count.
  if (typeof entryCount === 'number' && entryCount > 0) {
    const entitlements = await resolveEntitlements(uid);
    const maxEntries = entitlements.limits.maxEntries;
    if (maxEntries !== -1 && entryCount > maxEntries) {
      const ip = getClientIp(request);
      await logLimitEvent({
        firebaseUid: uid,
        companyId: entitlements.companyId,
        event: 'limit_reached',
        feature: 'entries',
        plan: entitlements.effectivePlan,
        currentUsage: entryCount,
        allowedLimit: maxEntries,
        ipAddress: ip,
      });
      return NextResponse.json(
        planLimitPayload({
          feature: 'entries',
          currentPlan: entitlements.effectivePlan,
          currentUsage: entryCount,
          allowedLimit: maxEntries,
          upgradeTo: 'pro',
          message: `Your ${entitlements.effectivePlan} plan allows a maximum of ${maxEntries} entries. Upgrade to Pro for unlimited entries.`,
        }),
        { status: 422 }
      );
    }
  }

  // Version-conflict safeguard: prevent a stale client from silently
  // overwriting a newer server vault.  If the client sends `clientVersion`
  // and the server already has a higher version, return 409 so the client can
  // merge/reload before writing.
  if (version !== undefined) {
    const existing = await Vault.findOne({ userId: uid }).select('version').lean() as { version?: number } | null;
    if (existing && typeof existing.version === 'number' && version < existing.version) {
      return NextResponse.json(
        {
          error: 'Version conflict: server has a newer vault. Fetch the latest version before saving.',
          serverVersion: existing.version,
        },
        { status: 409 }
      );
    }
  }

  const vault = await Vault.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        encryptedVault,
        lastSync: new Date(),
        ...(version !== undefined ? { version } : {}),
      },
      $setOnInsert: { userId: uid },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({
    success: true,
    version: vault.version,
    lastSync: vault.lastSync,
  });
}
