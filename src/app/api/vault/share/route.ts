/**
 * /api/vault/share
 *
 * Vault sharing (team/org vaults) is a Phase 2 feature.
 * These endpoints are secured stubs that require authentication
 * and return a clear not-implemented response.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  return NextResponse.json(
    { error: 'Vault sharing is not available in this release.' },
    { status: 501 }
  );
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  return NextResponse.json(
    { error: 'Vault sharing is not available in this release.' },
    { status: 501 }
  );
}
