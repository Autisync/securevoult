/**
 * Sign-in for the extension's background worker. Stands in for src/lib/auth
 * when background.ts is bundled. Firebase's web-extension build reads the
 * same saved sign-in the popup uses (IndexedDB in the extension's origin).
 *
 * Started lazily and never allowed to throw at load: a worker that fails to
 * start would take autofill down with it.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth/web-extension';

let auth: Auth | null | undefined;

function getAuthSafe(): Auth | null {
  if (auth !== undefined) return auth;
  try {
    const app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
    auth = getAuth(app);
  } catch {
    auth = null;
  }
  return auth;
}

export const getStoredSessionId = (): string | null => null;

export const authReady = async (): Promise<void> => {
  await getAuthSafe()?.authStateReady();
};

export const AuthService = {
  async getIdToken(): Promise<string | null> {
    try {
      const a = getAuthSafe();
      if (!a) return null;
      await a.authStateReady();
      return a.currentUser ? await a.currentUser.getIdToken() : null;
    } catch {
      return null;
    }
  },
  currentUid(): string | null {
    return getAuthSafe()?.currentUser?.uid ?? null;
  },
};
