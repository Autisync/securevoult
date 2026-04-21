/**
 * Client-side Passkey / WebAuthn helpers.
 *
 * Wraps navigator.credentials.create / get and communicates with our API.
 * Only works in the browser — never import from server-side code.
 */
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { AuthService } from '@/lib/auth';

// ── Encoding helpers (browser-safe) ─────────────────────────────────────────

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlToBuffer(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + '='.repeat(padding));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ── Passkey registration ─────────────────────────────────────────────────────

export interface RegisterPasskeyOptions {
  deviceName?: string;
}

export interface RegisterPasskeyResult {
  credentialId: string;
  deviceName: string;
}

export async function registerPasskey(
  opts: RegisterPasskeyOptions = {}
): Promise<RegisterPasskeyResult> {
  if (!window.PublicKeyCredential) {
    throw new Error('Passkeys are not supported in this browser.');
  }

  const idToken = await AuthService.getIdToken();

  // 1. Get challenge from server
  const challengeRes = await fetch('/api/auth/passkey/register/challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ deviceName: opts.deviceName }),
  });
  if (!challengeRes.ok) {
    const err = await challengeRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get registration challenge.');
  }
  const challengeData = await challengeRes.json();

  // 2. Call navigator.credentials.create
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: base64urlToBuffer(challengeData.challenge),
      rp: { id: challengeData.rpId, name: challengeData.rpName },
      user: {
        id: base64urlToBuffer(challengeData.userIdBytes),
        name: challengeData.userName,
        displayName: challengeData.userDisplayName,
      },
      pubKeyCredParams: challengeData.pubKeyCredParams,
      excludeCredentials: (challengeData.excludeCredentials ?? []).map(
        (c: { id: string; type: string; transports: AuthenticatorTransport[] }) => ({
          id: base64urlToBuffer(c.id),
          type: c.type,
          transports: c.transports,
        })
      ),
      authenticatorSelection: challengeData.authenticatorSelection,
      timeout: challengeData.timeout,
      attestation: challengeData.attestation ?? 'none',
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('Registration was cancelled or failed.');

  const response = credential.response as AuthenticatorAttestationResponse;

  // 3. Verify with server
  const deviceName = opts.deviceName || getDeviceName();
  const verifyRes = await fetch('/api/auth/passkey/register/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      credentialId:      bufferToBase64url(credential.rawId),
      clientDataJSON:    bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
      transports:        response.getTransports?.() ?? [],
      deviceName,
    }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Passkey registration verification failed.');
  }

  const verifyData = await verifyRes.json();
  return { credentialId: verifyData.credentialId, deviceName };
}

// ── Passkey authentication ───────────────────────────────────────────────────

export interface PasskeyLoginOptions {
  /** Pre-fill if email is known. Enables targeted credential hint. */
  email?: string;
}

export interface PasskeyLoginResult {
  email: string;
}

export async function loginWithPasskey(opts: PasskeyLoginOptions = {}): Promise<PasskeyLoginResult> {
  if (!window.PublicKeyCredential) {
    throw new Error('Passkeys are not supported in this browser.');
  }

  // 1. Get authentication challenge
  const challengeRes = await fetch('/api/auth/passkey/login/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: opts.email }),
  });
  if (!challengeRes.ok) {
    const err = await challengeRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get authentication challenge.');
  }
  const challengeData = await challengeRes.json();

  // 2. Call navigator.credentials.get
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToBuffer(challengeData.challenge),
      rpId: challengeData.rpId,
      allowCredentials: (challengeData.allowCredentials ?? []).map(
        (c: { id: string; type: string; transports: AuthenticatorTransport[] }) => ({
          id: base64urlToBuffer(c.id),
          type: c.type,
          transports: c.transports,
        })
      ),
      userVerification: challengeData.userVerification,
      timeout: challengeData.timeout,
    },
  }) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey authentication was cancelled.');

  const response = assertion.response as AuthenticatorAssertionResponse;

  // 3. Verify with server — get Firebase custom token
  const verifyRes = await fetch('/api/auth/passkey/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialId:      bufferToBase64url(assertion.rawId),
      clientDataJSON:    bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature:         bufferToBase64url(response.signature),
      userHandle:        response.userHandle ? bufferToBase64url(response.userHandle) : undefined,
    }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    throw new Error(err.error ?? 'Passkey authentication failed.');
  }

  const verifyData = await verifyRes.json();

  // 4. Exchange custom token for Firebase session
  await signInWithCustomToken(auth, verifyData.firebaseCustomToken);

  return { email: verifyData.email };
}

// ── Passkey credential management ────────────────────────────────────────────

export interface StoredPasskey {
  credentialId: string;
  deviceName: string;
  transports: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export async function listPasskeys(): Promise<StoredPasskey[]> {
  const idToken = await AuthService.getIdToken();
  const res = await fetch('/api/auth/passkey/credentials', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error('Failed to list passkeys.');
  const data = await res.json();
  return data.credentials ?? [];
}

export async function deletePasskey(credentialId: string): Promise<void> {
  const idToken = await AuthService.getIdToken();
  const res = await fetch('/api/auth/passkey/credentials', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ credentialId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to remove passkey.');
  }
}

/** Check if passkeys are available in this browser/device. */
export async function isPasskeyAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows Device';
  if (/Linux/i.test(ua)) return 'Linux Device';
  return 'Unknown Device';
}
