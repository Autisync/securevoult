import { NextResponse } from 'next/server';

/**
 * Public settings the phone and desktop apps read at start-up, so the apps
 * ship without anything copied from the server's environment.
 *
 * Only values that are public anyway: a Firebase web config is already in
 * every page this site serves. Nothing secret belongs here.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const firebase = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  };
  return NextResponse.json(
    {
      firebase,
      // Raise to make older app versions ask to be updated (vault format changes).
      minAppVersion: '1.0.0',
      webUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://vault.autisync.com',
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
