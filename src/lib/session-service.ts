/**
 * Session service — server-side session/device registry.
 *
 * A session represents one authenticated client context (web tab, extension,
 * mobile app).  Sessions are identified by a random UUID generated at login.
 * The client stores this ID (sessionStorage on web, chrome.storage.session on
 * extension) and sends it as the `X-Session-Id` request header.
 *
 * Revocation: setting isRevoked=true blocks future requests that carry that
 * session ID.  The TTL index on the Session model auto-expires stale sessions
 * after 90 days.
 */
import connectDB from './db-connect';
import { Session } from './models';

// ── Types ────────────────────────────────────────────────────────────────────

export type ClientType = 'web' | 'extension' | 'mobile';

export interface SessionRecord {
  sessionId: string;
  firebaseUid: string;
  clientType: ClientType;
  userAgent: string;
  ipAddress: string;
  lastSeenAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

/** Redacted representation safe to return to the owner's client. */
export interface PublicSession {
  sessionId: string;
  clientType: ClientType;
  /** Truncated, non-identifying user agent string. */
  deviceLabel: string;
  lastSeenAt: string; // ISO
  createdAt: string;  // ISO
  isCurrent: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a human-readable device label from a User-Agent string.
 * Intentionally lossy — we never store the raw UA in the public payload.
 */
function makeDeviceLabel(ua: string): string {
  if (!ua) return 'Unknown device';

  // Extension override (set explicitly)
  if (ua === '__extension__') return 'Browser extension';
  if (ua === '__mobile__') return 'Mobile app';

  // Browser detection (very rough, sufficient for a device label)
  const lower = ua.toLowerCase();
  let browser = 'Browser';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari';

  // OS detection
  let os = '';
  if (lower.includes('windows')) os = ' · Windows';
  else if (lower.includes('macintosh') || lower.includes('mac os')) os = ' · macOS';
  else if (lower.includes('linux')) os = ' · Linux';
  else if (lower.includes('android')) os = ' · Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = ' · iOS';

  return `${browser}${os}`;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Create a new session or update `lastSeenAt` if one already exists for the
 * given sessionId.  Returns the session ID (echoed back for convenience).
 */
export async function createOrUpdateSession(
  firebaseUid: string,
  sessionId: string,
  meta: { clientType: ClientType; userAgent: string; ipAddress: string }
): Promise<string> {
  await connectDB();

  await Session.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        firebaseUid,
        clientType: meta.clientType,
        userAgent: meta.userAgent.slice(0, 512), // cap UA length
        ipAddress: meta.ipAddress,
        lastSeenAt: new Date(),
        isRevoked: false,
      },
      $setOnInsert: { sessionId },
    },
    { upsert: true }
  );

  return sessionId;
}

/**
 * Touch (update `lastSeenAt`) for an existing session without creating a new
 * one.  No-op if the session doesn't exist or is revoked.
 */
export async function touchSession(
  firebaseUid: string,
  sessionId: string
): Promise<void> {
  if (!sessionId) return;
  await connectDB();
  await Session.updateOne(
    { sessionId, firebaseUid, isRevoked: false },
    { $set: { lastSeenAt: new Date() } }
  );
}

/**
 * Check whether a session is revoked.  Returns true if the session is revoked
 * or does not exist.
 */
export async function isSessionRevoked(
  firebaseUid: string,
  sessionId: string
): Promise<boolean> {
  if (!sessionId) return false; // no session header = legacy client, allow through
  await connectDB();
  const doc = await Session.findOne({ sessionId, firebaseUid }).select('isRevoked').lean() as { isRevoked?: boolean } | null;
  if (!doc) return false; // session not found — don't block (could be a new device)
  return doc.isRevoked === true;
}

/**
 * List all non-revoked sessions for a user, newest first.
 */
export async function listSessions(firebaseUid: string): Promise<SessionRecord[]> {
  await connectDB();
  const docs = await Session.find({ firebaseUid, isRevoked: false })
    .sort({ lastSeenAt: -1 })
    .lean() as unknown as SessionRecord[];

  return docs.map((d) => ({
    sessionId: d.sessionId,
    firebaseUid: d.firebaseUid,
    clientType: (d.clientType as ClientType) ?? 'web',
    userAgent: d.userAgent ?? '',
    ipAddress: d.ipAddress ?? '',
    lastSeenAt: d.lastSeenAt,
    isRevoked: d.isRevoked,
    createdAt: d.createdAt,
  }));
}

/**
 * Convert a full SessionRecord into a safe public payload.
 */
export function toPublicSession(
  session: SessionRecord,
  currentSessionId: string
): PublicSession {
  return {
    sessionId: session.sessionId,
    clientType: session.clientType,
    deviceLabel: makeDeviceLabel(session.userAgent),
    lastSeenAt: session.lastSeenAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    isCurrent: session.sessionId === currentSessionId,
  };
}

/**
 * Revoke a specific session.  Only the owning user can revoke their own sessions.
 * Returns false if the session was not found or does not belong to this user.
 */
export async function revokeSession(
  firebaseUid: string,
  sessionId: string
): Promise<boolean> {
  await connectDB();
  const result = await Session.updateOne(
    { sessionId, firebaseUid },
    { $set: { isRevoked: true } }
  );
  return result.modifiedCount > 0;
}

/**
 * Revoke all sessions for a user except the current one.
 * Returns the number of sessions revoked.
 */
export async function revokeOtherSessions(
  firebaseUid: string,
  currentSessionId: string
): Promise<number> {
  await connectDB();
  const result = await Session.updateMany(
    { firebaseUid, sessionId: { $ne: currentSessionId }, isRevoked: false },
    { $set: { isRevoked: true } }
  );
  return result.modifiedCount;
}
