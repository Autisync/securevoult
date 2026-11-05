/**
 * Unlock with Windows Hello, Touch ID, a fingerprint or a phone passkey.
 *
 * Uses the WebAuthn PRF extension: the authenticator (Windows Hello, a
 * security key, a phone) turns a fixed salt into a secret only it can
 * produce, after your PIN/fingerprint/face. That secret locks a copy of the
 * vault key on this device. No master password and no vault key is stored in
 * the clear, and the server is not involved.
 *
 * Set up per device (Settings → Security). Changing the master password keeps
 * it working; making a new vault or removing it here stops it.
 */
import { fromB64, sealWithSecret, toB64, vaultKeyBytes, vaultKeyFromSecret, type KeyHeader, type Sealed, type VaultKey } from './vault-crypto';

const STORE = 'sv_device_unlock';
const INFO = 'securevoult:device-unlock:v1';

interface Stored { uid: string; credId: string; salt: string; wk: Sealed; header: KeyHeader; label: string; createdAt: string }

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

function read(uid: string | null): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Stored | null;
    return s && (!uid || s.uid === uid) ? s : null;
  } catch { return null; }
}

/** Whether this browser can do WebAuthn with a built-in authenticator at all. */
export async function deviceUnlockSupported(): Promise<boolean> {
  try {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export function deviceUnlockInfo(uid: string | null): { label: string; createdAt: string } | null {
  const s = read(uid);
  return s ? { label: s.label, createdAt: s.createdAt } : null;
}

export function removeDeviceUnlock(): void {
  try { localStorage.removeItem(STORE); } catch { /* storage blocked */ }
}

function platformLabel(): string {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'Windows Hello';
  if (/Mac OS X/.test(ua) && !/Mobile/.test(ua)) return 'Touch ID';
  if (/iPhone|iPad/.test(ua)) return 'Face ID';
  if (/Android/.test(ua)) return 'fingerprint';
  return 'this device';
}

async function prfSecret(credId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null;
  const out = (assertion?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first;
  if (!out) throw new Error(`${platformLabel()} on this computer can't be used to unlock yet. Use "Keep me unlocked" instead, or a phone passkey.`);
  return new Uint8Array(out);
}

/**
 * Sets it up: asks for Windows Hello (or similar) once to create the
 * credential and once to get its secret, then locks a copy of the vault key.
 */
export async function setUpDeviceUnlock(opts: { uid: string; email: string; password: string; header: KeyHeader }): Promise<string> {
  const raw = await vaultKeyBytes(opts.password, opts.header);
  try {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'SecureVoult', id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: opts.email, displayName: `${opts.email} (vault unlock)` },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
        extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
      },
    }) as PublicKeyCredential | null;
    if (!cred) throw new Error('Cancelled');
    const credId = new Uint8Array(cred.rawId);
    const created = cred.getClientExtensionResults() as PrfResults;
    if (created.prf?.enabled === false) {
      throw new Error(`${platformLabel()} here doesn't support unlocking apps yet. Use "Keep me unlocked" instead.`);
    }
    const secret = created.prf?.results?.first ? new Uint8Array(created.prf.results.first) : await prfSecret(credId, salt);
    const wk = await sealWithSecret(secret, raw, INFO);
    secret.fill(0);
    const label = platformLabel();
    const stored: Stored = { uid: opts.uid, credId: toB64(credId), salt: toB64(salt), wk, header: opts.header, label, createdAt: new Date().toISOString() };
    localStorage.setItem(STORE, JSON.stringify(stored));
    return label;
  } finally {
    raw.fill(0);
  }
}

/** Unlocks: one Windows Hello / fingerprint prompt, returns the vault key. */
export async function unlockWithDevice(uid: string | null): Promise<VaultKey> {
  const s = read(uid);
  if (!s) throw new Error('Not set up on this device');
  const secret = await prfSecret(fromB64(s.credId), fromB64(s.salt));
  try { return await vaultKeyFromSecret(secret, s.wk, INFO, s.header); } finally { secret.fill(0); }
}
