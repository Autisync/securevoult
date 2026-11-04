import { apiError } from '@/lib/api-error';

// User registration is handled client-side via the Firebase Auth SDK.
// This endpoint is no longer in use.
export function POST() {
  return apiError(410, 'endpoint_retired', 'Use Firebase Auth SDK to create accounts. See /api/auth/sync-user to sync the user record after registration.');
}
