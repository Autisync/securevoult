/**
 * Firebase Admin SDK — server-side only.
 * Initializes once per process and exports a verified token decoder.
 * Never import this file from client-side code.
 */
import admin from 'firebase-admin';

function getFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in your environment.'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

/**
 * Cryptographically verify a Firebase ID token and return the decoded claims.
 * Throws if the token is invalid, expired, or from a different project.
 */
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  const app = getFirebaseAdmin();
  return app.auth().verifyIdToken(idToken, /* checkRevoked= */ true);
}

/**
 * Returns the Firebase Admin Auth instance.
 * Use this for server-side operations such as minting custom tokens.
 */
export function getAdminAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}
