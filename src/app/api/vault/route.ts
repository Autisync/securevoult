import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db-connect';
import { Vault } from '@/lib/models';
import { requireAuthenticatedUser } from '@/lib/server-auth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveEntitlements, planLimitPayload } from '@/lib/entitlements';
import { logLimitEvent } from '@/lib/limit-logger';
import { tooManyRequests, serviceUnavailable, badRequest, conflict } from '@/lib/api-error';

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

async function ensureDB() {
  try {
    await connectDB();
  } catch {
    return serviceUnavailable('Database unavailable.');
  }
  return null;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultRead);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
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
      : { encryptedData: '', version: 0, lastSync: null },
  });
}

export async function POST(request: NextRequest) {
  // Rate limit: 60 vault writes per 15 min per IP
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.vaultWrite);
  if (!rl.allowed) {
    return tooManyRequests(retryAfterSeconds(rl.resetAt));
  }

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  const dbError = await ensureDB();
  if (dbError) return dbError;

  const { uid } = authResult.user;

  let body: { encryptedVault?: string; version?: number; baseVersion?: number; entryCount?: number };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const { encryptedVault, version, baseVersion, entryCount } = body;

  if (!encryptedVault || typeof encryptedVault !== 'string') {
    return badRequest('encryptedVault (string) is required');
  }
  if (encryptedVault.length > 20 * 1024 * 1024) {
    return badRequest('Vault is too large');
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

  // Compare-and-set: the write only lands if the server is still at the
  // version this client started from. Otherwise 409 + the current version,
  // and the client fetches, merges item by item, and tries again.
  if (typeof baseVersion === 'number') {
    const lastSync = new Date();
    let saved = await Vault.findOneAndUpdate(
      { userId: uid, version: baseVersion },
      { $set: { encryptedVault, lastSync }, $inc: { version: 1 } },
      { new: true },
    );
    if (!saved && baseVersion === 0) {
      const existing = await Vault.findOne({ userId: uid }).select('version encryptedVault').lean() as { version?: number; encryptedVault?: string } | null;
      if (!existing) {
        try {
          saved = await Vault.create({ userId: uid, encryptedVault, version: 1, lastSync });
        } catch {
          saved = null; // another device created it at the same moment
        }
      } else if (!existing.encryptedVault) {
        saved = await Vault.findOneAndUpdate(
          { userId: uid, version: existing.version },
          { $set: { encryptedVault, lastSync }, $inc: { version: 1 } },
          { new: true },
        );
      }
    }
    if (!saved) {
      const current = await Vault.findOne({ userId: uid }).select('version').lean() as { version?: number } | null;
      return NextResponse.json(
        { error: true, code: 'conflict', message: 'Your vault changed on another device.', serverVersion: current?.version ?? 0 },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, version: saved.version, lastSync: saved.lastSync });
  }

  // Older clients (no baseVersion): refuse a stale version, otherwise overwrite.
  if (version !== undefined) {
    const existing = await Vault.findOne({ userId: uid }).select('version').lean() as { version?: number } | null;
    if (existing && typeof existing.version === 'number' && version < existing.version) {
      return conflict('Version conflict: server has a newer vault. Fetch the latest version before saving.');
    }
  }

  const vault =
    (await Vault.findOneAndUpdate(
      { userId: uid },
      { $set: { encryptedVault, lastSync: new Date() }, $inc: { version: 1 } },
      { new: true },
    )) ?? (await Vault.create({ userId: uid, encryptedVault, version: 1, lastSync: new Date() }));

  return NextResponse.json({
    success: true,
    version: vault.version,
    lastSync: vault.lastSync,
  });
}
