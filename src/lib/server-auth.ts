/**
 * Server-side authentication helpers.
 * Use `requireAuthenticatedUser` in every protected API route.
 * Never use atob / manual JWT decoding for auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from './firebase-admin';
import { isSessionRevoked } from './session-service';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
  /** Session ID from X-Session-Id header, if present and not revoked. */
  sessionId?: string;
}

/**
 * Extract and cryptographically verify the Firebase ID token from the
 * Authorization: Bearer <token> header.
 *
 * When the request includes an `X-Session-Id` header, this function
 * additionally checks the session registry for revocation. If the session has
 * been explicitly revoked (e.g. from another device), the request is rejected
 * with 401 so the client can force a re-auth.
 *
 * Revocation check fails-open on DB errors — token verification still
 * gates every request even when the session DB is unavailable.
 *
 * Returns the verified user identity on success.
 * Returns a 401 NextResponse on failure — callers should return it immediately.
 */
export async function requireAuthenticatedUser(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Missing or malformed Authorization header' },
        { status: 401 }
      ),
    };
  }

  const idToken = authHeader.slice(7);

  let decoded: Awaited<ReturnType<typeof verifyIdToken>>;
  try {
    decoded = await verifyIdToken(idToken);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    console.error('[server-auth] Token verification failed:', message);
    return {
      error: NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      ),
    };
  }

  const uid = decoded.uid;
  const sessionId = request.headers.get('x-session-id') ?? undefined;

  // If a session ID is present, verify it has not been explicitly revoked.
  // Fails-open on DB errors so a DB outage doesn't lock everyone out.
  if (sessionId) {
    try {
      const revoked = await isSessionRevoked(uid, sessionId);
      if (revoked) {
        return {
          error: NextResponse.json(
            { error: 'Session has been revoked. Please sign in again.' },
            { status: 401 }
          ),
        };
      }
    } catch {
      // DB unavailable — allow through; Firebase token still verified above
      console.warn('[server-auth] Session revocation check failed; skipping');
    }
  }

  return {
    user: {
      uid,
      email: decoded.email ?? '',
      name: decoded.name,
      picture: decoded.picture,
      emailVerified: decoded.email_verified ?? false,
      sessionId,
    },
  };
}

/**
 * Require the caller to be an admin user (role === 'admin' in MongoDB).
 * Callers must already have a verified AuthenticatedUser.
 */
export function requireAdminRole(role: string): NextResponse | null {
  if (role !== 'admin') {
    return NextResponse.json(
      { error: 'Administrator access required' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Verify the request is from an active admin user.
 * Checks Firebase token, session revocation, DB user existence, and role.
 * Use at the top of every admin route instead of the local `getVerifiedAdmin` copies.
 */
export async function requireVerifiedAdmin(
  request: NextRequest
): Promise<
  | { adminUid: string; adminEmail: string }
  | { error: NextResponse }
> {
  // Dynamic import avoids circular deps at module load time
  const [{ default: connectDB }, { User }] = await Promise.all([
    import('./db-connect'),
    import('./models'),
  ]);

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return { error: authResult.error };

  try {
    await connectDB();
  } catch {
    return {
      error: NextResponse.json({ error: 'Database unavailable.' }, { status: 503 }),
    };
  }

  const dbUser = await User.findOne({
    firebaseUid: authResult.user.uid,
    isActive: true,
  }).select('role firebaseUid email').lean() as { role?: string; firebaseUid?: string; email?: string } | null;

  if (!dbUser) {
    return { error: NextResponse.json({ error: 'User not found.' }, { status: 404 }) };
  }

  const roleError = requireAdminRole(dbUser.role ?? '');
  if (roleError) return { error: roleError };

  return {
    adminUid: authResult.user.uid,
    adminEmail: authResult.user.email,
  };
}

/**
 * Require either a global admin ('admin') or a company-scoped admin ('companyAdmin').
 *
 * Returns:
 *   { adminUid, adminEmail, isGlobalAdmin: true,  companyId: null }   — global admin
 *   { adminUid, adminEmail, isGlobalAdmin: false, companyId: ObjectId }— company admin
 *   { error: NextResponse }                                            — not authorised
 *
 * Company admins can only access resources for their own companyId.
 * Routes must use `isGlobalAdmin` and `companyId` to scope queries.
 */
export async function requireVerifiedAdminOrCompanyAdmin(
  request: NextRequest
): Promise<
  | { adminUid: string; adminEmail: string; isGlobalAdmin: boolean; companyId: string | null }
  | { error: NextResponse }
> {
  const [{ default: connectDB }, { User }] = await Promise.all([
    import('./db-connect'),
    import('./models'),
  ]);

  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return { error: authResult.error };

  try {
    await connectDB();
  } catch {
    return {
      error: NextResponse.json({ error: 'Database unavailable.' }, { status: 503 }),
    };
  }

  const dbUser = await User.findOne({
    firebaseUid: authResult.user.uid,
    isActive: true,
  }).select('role firebaseUid email companyId').lean() as {
    role?: string;
    firebaseUid?: string;
    email?: string;
    companyId?: unknown;
  } | null;

  if (!dbUser) {
    return { error: NextResponse.json({ error: 'User not found.' }, { status: 404 }) };
  }

  const role = dbUser.role ?? 'user';

  if (role !== 'admin' && role !== 'companyAdmin') {
    return {
      error: NextResponse.json({ error: 'Administrator access required.' }, { status: 403 }),
    };
  }

  const isGlobalAdmin = role === 'admin';
  const companyId = isGlobalAdmin ? null : (dbUser.companyId ? String(dbUser.companyId) : null);

  // A companyAdmin with no companyId association is a misconfiguration — reject.
  if (!isGlobalAdmin && !companyId) {
    return {
      error: NextResponse.json(
        { error: 'Company admin account is not associated with a company.' },
        { status: 403 }
      ),
    };
  }

  return {
    adminUid: authResult.user.uid,
    adminEmail: authResult.user.email,
    isGlobalAdmin,
    companyId,
  };
}
