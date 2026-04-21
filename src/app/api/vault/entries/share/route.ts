import { NextResponse } from 'next/server';

// Entry-level sharing is a Phase 2 feature.
// The vault is stored as a single encrypted blob -- see /api/vault.
export function POST() {
  return NextResponse.json(
    { error: 'Entry-level sharing not yet implemented. Use /api/vault/share for vault-level sharing.' },
    { status: 501 },
  );
}

export function GET() {
  return NextResponse.json(
    { error: 'Entry-level sharing not yet implemented.' },
    { status: 501 },
  );
}
