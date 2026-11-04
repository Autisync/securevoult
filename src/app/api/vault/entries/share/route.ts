import { apiError } from '@/lib/api-error';

// Entry-level sharing is a Phase 2 feature.
// The vault is stored as a single encrypted blob -- see /api/vault.
export function POST() {
  return apiError(501, 'not_implemented', 'Entry-level sharing not yet implemented. Use /api/vault/share for vault-level sharing.');
}

export function GET() {
  return apiError(501, 'not_implemented', 'Entry-level sharing not yet implemented.');
}
