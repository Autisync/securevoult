/**
 * Environment variable validation.
 *
 * Import `validateServerEnv()` in any server-side module that needs to
 * ensure the environment is complete before proceeding.
 *
 * Call `validateServerEnv()` early (e.g. in db-connect, firebase-admin init)
 * to surface missing variables at startup rather than at request time.
 */

// ── Required server-side variables ──────────────────────────────────────────

const SERVER_REQUIRED = [
  'MONGODB_URI',
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
] as const;

// ── Required client-side variables (NEXT_PUBLIC_*) ──────────────────────────

export const CLIENT_REQUIRED = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate that all required server-side environment variables are present.
 * Throws with a list of missing variables if any are absent.
 *
 * Safe to call multiple times (idempotent — only evaluates once per process
 * via module-level caching).
 */
let _serverValidated = false;

export function validateServerEnv(): void {
  if (_serverValidated) return;

  const missing = SERVER_REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[SecureVoult] Missing required server environment variables:\n` +
        missing.map((k) => `  • ${k}`).join('\n') +
        `\n\nSee .env.example for the full list of required variables.`
    );
  }

  _serverValidated = true;
}

/**
 * Non-throwing variant — returns a list of missing variable names.
 * Used by the /api/health endpoint.
 */
export function getMissingServerEnv(): string[] {
  return SERVER_REQUIRED.filter((key) => !process.env[key]);
}

/**
 * Check if all Firebase Admin env vars are present (for health checks).
 */
export function isFirebaseAdminConfigured(): boolean {
  return (
    !!process.env.FIREBASE_ADMIN_PROJECT_ID &&
    !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    !!process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}
