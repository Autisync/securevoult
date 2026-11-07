/**
 * Firebase sign-in on the phone. The sign-in survives restarts (kept in
 * AsyncStorage by Firebase itself); the vault stays locked until the master
 * password or the fingerprint opens it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from '@firebase/app';
import {
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type Auth,
  type User,
} from '@firebase/auth';
import { loadAppConfig } from './config';

let auth: Auth | null = null;

export async function getAuthInstance(): Promise<Auth> {
  if (auth) return auth;
  const { firebase } = await loadAppConfig();
  const app = getApps().length ? getApp() : initializeApp(firebase);
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  return auth;
}

/** Resolves with the restored user (or null) once Firebase has read its saved sign-in. */
export async function restoredUser(): Promise<User | null> {
  const a = await getAuthInstance();
  await a.authStateReady();
  return a.currentUser;
}

export async function watchUser(cb: (u: User | null) => void): Promise<() => void> {
  const a = await getAuthInstance();
  return onAuthStateChanged(a, cb);
}

export async function signInEmail(email: string, password: string): Promise<User> {
  const a = await getAuthInstance();
  try {
    const cred = await signInWithEmailAndPassword(a, email.trim(), password);
    return cred.user;
  } catch (e) {
    throw new Error(friendlyAuthError(e));
  }
}

export async function resetPassword(email: string): Promise<void> {
  const a = await getAuthInstance();
  await sendPasswordResetEmail(a, email.trim());
}

export async function signOutFirebase(): Promise<void> {
  const a = await getAuthInstance();
  await fbSignOut(a);
}

export async function idToken(): Promise<string | null> {
  const a = await getAuthInstance();
  return a.currentUser ? a.currentUser.getIdToken() : null;
}

export const currentUid = (): string | null => auth?.currentUser?.uid ?? null;

function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don\'t match an account.';
    case 'auth/invalid-email':
      return 'Check the email address.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes, or reset your password.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/user-disabled':
      return 'This account has been switched off. Contact support.';
    default:
      return 'Couldn\'t sign in. Try again.';
  }
}
