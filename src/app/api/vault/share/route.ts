/**
 * /api/vault/share
 *
 * Vault sharing (team/org vaults) is a Phase 2 feature.
 * These endpoints are secured stubs that require authentication
 * and return a clear not-implemented response.
 */
import { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-error';
import { requireAuthenticatedUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  return apiError(501, 'not_implemented', 'Vault sharing is not available in this release.');
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  return apiError(501, 'not_implemented', 'Vault sharing is not available in this release.');
}
