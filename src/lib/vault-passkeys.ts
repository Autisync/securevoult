/**
 * Passkeys kept in the vault (WebAuthn, ES256 / P-256).
 *
 * The extension answers a website's passkey request itself: it makes the key
 * pair here, keeps the private key inside the encrypted vault, and signs
 * sign-in challenges with it. Websites see a normal passkey ("none"
 * attestation, backup-eligible, synced), the same as from NordPass,
 * 1Password or Bitwarden.
 */
import type { PasskeyCredential } from '@/types/vault';

// ── base64url ────────────────────────────────────────────────────────────────

export function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const sha256 = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', b as BufferSource));
const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n: number) => new Uint8Array([(n >>> 8) & 255, n & 255]);

// ── minimal CBOR (what WebAuthn needs) ──────────────────────────────────────

type Cbor = number | string | Uint8Array | CborMap;
export class CborMap { constructor(public entries: [Cbor, Cbor][]) {} }

function head(major: number, n: number): Uint8Array {
  if (n < 24) return new Uint8Array([(major << 5) | n]);
  if (n < 256) return new Uint8Array([(major << 5) | 24, n]);
  if (n < 65536) return new Uint8Array([(major << 5) | 25, n >> 8, n & 255]);
  return concat(new Uint8Array([(major << 5) | 26]), u32(n));
}

export function cbor(v: Cbor): Uint8Array {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') { const b = new TextEncoder().encode(v); return concat(head(3, b.length), b); }
  if (v instanceof Uint8Array) return concat(head(2, v.length), v);
  return concat(head(5, v.entries.length), ...v.entries.flatMap(([k, x]) => [cbor(k), cbor(x)]));
}

// ── signatures ──────────────────────────────────────────────────────────────

/** WebCrypto gives r||s; WebAuthn wants ASN.1 DER. */
export function rawToDer(raw: Uint8Array): Uint8Array {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = b.slice(i);
    if (v[0] & 0x80) v = concat(new Uint8Array([0]), v);
    return concat(new Uint8Array([0x02, v.length]), v);
  };
  const r = int(raw.slice(0, 32)), s = int(raw.slice(32, 64));
  return concat(new Uint8Array([0x30, r.length + s.length]), r, s);
}

/** SecureVoult's authenticator ID (AAGUID), so sites can show "SecureVoult" as the passkey provider. */
export const AAGUID = new Uint8Array([0x5e, 0xc7, 0x0a, 0x17, 0x7c, 0x3b, 0x4d, 0x2e, 0x9a, 0x51, 0xa7, 0x15, 0x5c, 0x40, 0x7a, 0x01]);

const FLAG_UP = 0x01, FLAG_UV = 0x04, FLAG_BE = 0x08, FLAG_BS = 0x10, FLAG_AT = 0x40;

/** Origin rules: the rpId must be this page's host or a parent domain of it (never another site). */
export function rpIdAllowed(rpId: string, host: string, base: string): boolean {
  const r = rpId.toLowerCase().replace(/\.$/, ''), h = host.toLowerCase();
  if (!r || !(h === r || h.endsWith(`.${r}`))) return false;
  // Not wider than the site itself (e.g. never "co.uk" for example.co.uk).
  return r === base || r.endsWith(`.${base}`);
}

export function clientDataJSON(type: 'webauthn.create' | 'webauthn.get', challenge: Uint8Array, origin: string, topOrigin?: string): Uint8Array {
  const cross = !!topOrigin && topOrigin !== origin;
  const obj: Record<string, unknown> = { type, challenge: b64url(challenge), origin, crossOrigin: cross };
  if (cross) obj.topOrigin = topOrigin;
  return new TextEncoder().encode(JSON.stringify(obj));
}

export interface CreateResult {
  passkey: PasskeyCredential;
  attestationObject: Uint8Array;
  authenticatorData: Uint8Array;
  publicKeySpki: Uint8Array;
}

/** Makes a new passkey for `rpId` and the attestation the website stores. */
export async function createPasskey(opts: { rpId: string; rpName?: string; userHandle: Uint8Array; userName: string; userDisplayName?: string }): Promise<CreateResult> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const credId = crypto.getRandomValues(new Uint8Array(32));
  const cose = cbor(new CborMap([[1, 2], [3, -7], [-1, 1], [-2, raw.slice(1, 33)], [-3, raw.slice(33, 65)]]));
  const authData = concat(
    await sha256(new TextEncoder().encode(opts.rpId)),
    new Uint8Array([FLAG_UP | FLAG_UV | FLAG_BE | FLAG_BS | FLAG_AT]),
    u32(0), AAGUID, u16(credId.length), credId, cose,
  );
  const attestationObject = cbor(new CborMap([['fmt', 'none'], ['attStmt', new CborMap([])], ['authData', authData]]));
  return {
    passkey: {
      credentialId: b64url(credId), rpId: opts.rpId, rpName: opts.rpName, userHandle: b64url(opts.userHandle),
      userName: opts.userName, userDisplayName: opts.userDisplayName, privateKey: b64url(pkcs8), alg: -7,
      counter: 0, createdAt: new Date().toISOString(),
    },
    attestationObject, authenticatorData: authData, publicKeySpki: spki,
  };
}

/** Signs a sign-in challenge with a stored passkey. */
export async function signAssertion(pk: PasskeyCredential, clientData: Uint8Array): Promise<{ authenticatorData: Uint8Array; signature: Uint8Array }> {
  const key = await crypto.subtle.importKey('pkcs8', fromB64url(pk.privateKey) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // Counter stays 0: the passkey is synced between devices, so a counter can't be kept in step (spec: 0 = not used).
  const authenticatorData = concat(await sha256(new TextEncoder().encode(pk.rpId)), new Uint8Array([FLAG_UP | FLAG_UV | FLAG_BE | FLAG_BS]), u32(0));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, concat(authenticatorData, await sha256(clientData)) as BufferSource));
  return { authenticatorData, signature: rawToDer(sig) };
}
