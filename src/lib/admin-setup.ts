/**
 * Admin setup utility — for use in CI / seed scripts only.
 *
 * SECURITY NOTE: Never commit real admin credentials.
 * Admin role is assigned server-side via PUT /api/admin/users using
 * the firebaseUid and role fields. Use Firebase Console or a secure
 * seed script with credentials pulled from environment variables.
 *
 * Example (run once, never in production application code):
 *   await fetch('/api/admin/users', {
 *     method: 'PUT',
 *     headers: { Authorization: 'Bearer <serviceAccountToken>' },
 *     body: JSON.stringify({ firebaseUid: '<uid>', role: 'admin' }),
 *   });
 */
