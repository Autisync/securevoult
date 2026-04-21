import { NextResponse } from 'next/server';

// User registration is handled client-side via the Firebase Auth SDK.
// This endpoint is no longer in use.
export function POST() {
  return NextResponse.json(
    { error: 'Use Firebase Auth SDK to create accounts. See /api/auth/sync-user to sync the user record after registration.' },
    { status: 410 },
  );
}
