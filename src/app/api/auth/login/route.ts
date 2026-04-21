import { NextResponse } from 'next/server';

// Authentication is handled client-side via the Firebase Auth SDK.
// This endpoint is no longer in use.
export function POST() {
  return NextResponse.json(
    { error: 'Use Firebase Auth SDK for authentication. See /api/auth/sync-user to sync the user record after sign-in.' },
    { status: 410 },
  );
}
