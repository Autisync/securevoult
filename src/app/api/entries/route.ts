/**
 * /api/entries
 *
 * NOTE: With the zero-knowledge vault architecture the server stores only an
 * encrypted blob per user (see /api/vault). Individual plaintext entry fields
 * (title, url, tags) are therefore NOT stored separately on the server —
 * decryption happens client-side.
 *
 * These endpoints are intentionally minimal stubs kept for extension/mobile
 * compatibility. Full search/filter is performed client-side after vault
 * decryption.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  // Zero-knowledge architecture: entries are stored only as an encrypted blob.
  // Client-side decryption handles search/filter after fetching from /api/vault.
  return NextResponse.json(
    { error: 'Use GET /api/vault to retrieve the encrypted vault for client-side decryption. Individual entries are not stored in plaintext on the server.' },
    { status: 303, headers: { Location: '/api/vault' } },
  );
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if ('error' in authResult) return authResult.error;

  // Individual entry creation is handled by saving the full encrypted vault.
  // Use POST /api/vault to persist the encrypted blob.
  return NextResponse.json(
    { error: 'Use POST /api/vault to save the full encrypted vault. Individual entry writes are not supported.' },
    { status: 303, headers: { Location: '/api/vault' } },
  );
}
