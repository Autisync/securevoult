// Firebase-based authentication service with MongoDB backend sync
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { User, SignUpData, SignInData } from '@/types/auth';

const SESSION_ID_KEY = 'sv_session_id';

/** Retrieve the session ID stored in sessionStorage (client-only, safe). */
export function getStoredSessionId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(SESSION_ID_KEY);
}

/** Persist the session ID returned by sync-user into sessionStorage. */
function storeSessionId(id: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_ID_KEY, id);
}

export class AuthService {
  private static baseUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

  private static convertFirebaseUser(firebaseUser: FirebaseUser): User {
    return {
      id: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? undefined,
      photoURL: firebaseUser.photoURL ?? undefined,
      provider: firebaseUser.providerData[0]?.providerId ?? 'password',
      emailVerified: firebaseUser.emailVerified,
      createdAt: new Date(firebaseUser.metadata.creationTime ?? Date.now()),
    };
  }

  // Sync verified Firebase user identity to MongoDB.
  private static async syncUserToMongoDB(firebaseUser: FirebaseUser): Promise<void> {
    try {
      const idToken = await firebaseUser.getIdToken();
      const existingSessionId = getStoredSessionId();
      const res = await fetch(`${this.baseUrl}/api/auth/sync-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          provider: firebaseUser.providerData[0]?.providerId ?? 'password',
          emailVerified: firebaseUser.emailVerified,
          clientType: 'web',
          // Send existing session ID so the server reuses the same session record
          ...(existingSessionId ? { sessionId: existingSessionId } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) storeSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('[AuthService] sync-user failed:', error);
    }
  }

  static async signUp(data: SignUpData): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    if (data.displayName) {
      await updateProfile(userCredential.user, { displayName: data.displayName });
    }

    await this.syncUserToMongoDB(userCredential.user);
    return this.convertFirebaseUser(userCredential.user);
  }

  static async signIn(data: SignInData): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );
    await this.syncUserToMongoDB(userCredential.user);
    return this.convertFirebaseUser(userCredential.user);
  }

  static async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider);
    await this.syncUserToMongoDB(result.user);
    return this.convertFirebaseUser(result.user);
  }

  static async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  static async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  static onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Best-effort sync; errors are non-fatal
        this.syncUserToMongoDB(firebaseUser).catch(() => {});
        callback(this.convertFirebaseUser(firebaseUser));
      } else {
        callback(null);
      }
    });
  }

  static async getIdToken(): Promise<string | null> {
    try {
      return auth.currentUser ? await auth.currentUser.getIdToken() : null;
    } catch {
      return null;
    }
  }
}
