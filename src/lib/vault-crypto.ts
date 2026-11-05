/**
 * Vault encryption, format 2.
 *
 *   master password ──Argon2id──▶ key-encryption key (KEK)
 *   KEK ──AES-256-GCM──▶ unwraps a random 256-bit vault key
 *   vault key ──AES-256-GCM──▶ the vault JSON
 *
 * Why a separate vault key: changing the master password only re-wraps 32
 * bytes instead of re-encrypting everything, and later unlock methods
 * (passkey, phone biometrics, sharing) can wrap the same key their own way.
 *
 * The master password is only used during unlock; after that the app keeps
 * a non-extractable CryptoKey, never the password.
 *
 * Format 1 (PBKDF2-SHA256, 100k iterations, password-derived key, hex) is
 * still read, and is re-saved as format 2 on the next save.
 */
import { argon2id } from 'hash-wasm';

export type KdfParams =
  | { alg: 'argon2id'; salt: string; m: number; t: number; p: number }
  | { alg: 'pbkdf2-sha256'; salt: string; iterations: number };

export interface Sealed { iv: string; ct: string }

/** The vault key wrapped a second time, with the Recovery Kit key. */
export interface RecoveryWrap { kdf: KdfParams; wk: Sealed }

/** Everything needed to turn the master password (or the recovery key) back into the vault key. */
export interface KeyHeader { kdf: KdfParams; wk: Sealed; rk?: RecoveryWrap }

export interface EncryptedVaultV2 { v: 2; kdf: KdfParams; wk: Sealed; rk?: RecoveryWrap; data: Sealed }

export interface VaultKey { key: CryptoKey; header: KeyHeader }

/** Argon2id defaults: 64 MiB, 3 passes. Above OWASP's minimum (19 MiB, 2 passes). */
export const DEFAULT_KDF = { m: 65536, t: 3, p: 1 } as const;

const AAD_KEY = new TextEncoder().encode('securevoult:v2:key');
const AAD_RECOVERY = new TextEncoder().encode('securevoult:v2:recovery');
/** Recovery keys are long random strings, so a lighter Argon2id is enough (OWASP minimum). */
const RECOVERY_KDF = { m: 19456, t: 2, p: 1 } as const;
const AAD_DATA = new TextEncoder().encode('securevoult:v2:vault');

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── base64 / hex ───────────────────────────────────────────────────────────

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

// ── key derivation ─────────────────────────────────────────────────────────

async function deriveKek(password: string, kdf: KdfParams): Promise<CryptoKey> {
  const salt = fromB64(kdf.salt);
  let raw: Uint8Array;
  if (kdf.alg === 'argon2id') {
    raw = await argon2id({
      password: password.normalize('NFKC'),
      salt, parallelism: kdf.p, iterations: kdf.t, memorySize: kdf.m, hashLength: 32, outputType: 'binary',
    });
  } else {
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    raw = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: kdf.iterations, hash: 'SHA-256' }, material, 256));
  }
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  raw.fill(0);
  return key;
}

async function seal(key: CryptoKey, plain: Uint8Array, aad: Uint8Array): Promise<Sealed> {
  const iv = random(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plain));
  return { iv: toB64(iv), ct: toB64(ct) };
}

async function open(key: CryptoKey, s: Sealed, aad: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv), additionalData: aad }, key, fromB64(s.ct)));
}

function newKdf(): KdfParams {
  return { alg: 'argon2id', salt: toB64(random(16)), ...DEFAULT_KDF };
}

async function wrapRaw(password: string, raw: Uint8Array, kdf: KdfParams = newKdf()): Promise<KeyHeader> {
  const kek = await deriveKek(password, kdf);
  return { kdf, wk: await seal(kek, raw, AAD_KEY) };
}

let keysExportable = false;

/**
 * The browser extension keeps the unlocked key in chrome.storage.session
 * (memory only, cleared when the browser closes) so the popup and the
 * autofill menu don't ask for the master password every time. Only the
 * extension calls this; the web app's key can never be read back out.
 */
export function allowKeyExport(): void { keysExportable = true; }

async function importVaultKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', keysExportable, ['encrypt', 'decrypt']);
}

export async function exportRawKey(vk: VaultKey): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.exportKey('raw', vk.key)));
}

export async function importRawKey(rawB64: string, header: KeyHeader): Promise<VaultKey> {
  const raw = fromB64(rawB64);
  try { return { key: await importVaultKey(raw), header }; } finally { raw.fill(0); }
}

// ── public API ─────────────────────────────────────────────────────────────

export class WrongPasswordError extends Error {
  constructor() { super('Wrong master password'); this.name = 'WrongPasswordError'; }
}

/** A brand-new random vault key, wrapped with the master password. */
export async function createVaultKey(password: string, kdf?: KdfParams): Promise<VaultKey> {
  const raw = random(32);
  try {
    const header = await wrapRaw(password, raw, kdf);
    return { key: await importVaultKey(raw), header };
  } finally { raw.fill(0); }
}

/**
 * The vault key's bytes, opened with the master password, for wrapping it a
 * third way (Windows Hello / fingerprint). The caller must zero them after use.
 */
export async function vaultKeyBytes(password: string, header: KeyHeader): Promise<Uint8Array> {
  const kek = await deriveKek(password, header.kdf);
  try { return await open(kek, header.wk, AAD_KEY); } catch { throw new WrongPasswordError(); }
}

/** Wraps/unwraps the vault key bytes with a key derived from an authenticator's PRF output. */
export async function sealWithSecret(secret: Uint8Array, raw: Uint8Array, info: string): Promise<Sealed> {
  const k = await secretKey(secret, info);
  return seal(k, raw, AAD_KEY);
}

export async function vaultKeyFromSecret(secret: Uint8Array, sealed: Sealed, info: string, header: KeyHeader): Promise<VaultKey> {
  const k = await secretKey(secret, info);
  let raw: Uint8Array;
  try { raw = await open(k, sealed, AAD_KEY); } catch { throw new Error('This device unlock no longer matches the vault. Set it up again.'); }
  try { return { key: await importVaultKey(raw), header }; } finally { raw.fill(0); }
}

async function secretKey(secret: Uint8Array, info: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('securevoult:prf'), info: new TextEncoder().encode(info) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** A new vault key with its Recovery Kit key made at the same time. */
export async function createVaultKeyWithRecovery(password: string, kdf?: KdfParams): Promise<{ vk: VaultKey; recoveryKey: string }> {
  const raw = random(32);
  try {
    const recoveryKey = newRecoveryKey();
    const header: KeyHeader = { ...(await wrapRaw(password, raw, kdf)), rk: await wrapForRecovery(raw, recoveryKey) };
    return { vk: { key: await importVaultKey(raw), header }, recoveryKey };
  } finally { raw.fill(0); }
}

/** Unwraps the vault key. Throws WrongPasswordError when the password is wrong. */
export async function unlockVaultKey(password: string, header: KeyHeader): Promise<VaultKey> {
  const kek = await deriveKek(password, header.kdf);
  let raw: Uint8Array;
  try { raw = await open(kek, header.wk, AAD_KEY); } catch { throw new WrongPasswordError(); }
  try { return { key: await importVaultKey(raw), header }; } finally { raw.fill(0); }
}

/** New master password, same vault key: existing ciphertext stays valid. The Recovery Kit keeps working. */
export async function rewrapVaultKey(oldPassword: string, newPassword: string, header: KeyHeader): Promise<KeyHeader> {
  const kek = await deriveKek(oldPassword, header.kdf);
  let raw: Uint8Array;
  try { raw = await open(kek, header.wk, AAD_KEY); } catch { throw new WrongPasswordError(); }
  try { return { ...(await wrapRaw(newPassword, raw)), ...(header.rk ? { rk: header.rk } : {}) }; } finally { raw.fill(0); }
}

// ── Recovery Kit ───────────────────────────────────────────────────────────

const RK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

/** 32 characters from a 32-letter alphabet = 160 random bits, shown as 8 groups of 4. */
export function newRecoveryKey(): string {
  const bytes = random(32);
  const chars = Array.from(bytes, (b) => RK_ALPHABET[b & 31]).join('');
  bytes.fill(0);
  return chars.match(/.{4}/g)!.join('-');
}

/** Accepts the key with or without dashes/spaces, any case. */
export function normaliseRecoveryKey(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function wrapForRecovery(raw: Uint8Array, recoveryKey: string): Promise<RecoveryWrap> {
  const kdf: KdfParams = { alg: 'argon2id', salt: toB64(random(16)), ...RECOVERY_KDF };
  const kek = await deriveKek(normaliseRecoveryKey(recoveryKey), kdf);
  return { kdf, wk: await seal(kek, raw, AAD_RECOVERY) };
}

export class WrongRecoveryKeyError extends Error {
  constructor() { super('That recovery key does not match this vault'); this.name = 'WrongRecoveryKeyError'; }
}

/**
 * Makes (or replaces) the Recovery Kit key. Needs the master password once,
 * because the vault key itself is never kept in a readable form.
 */
export async function createRecoveryKey(password: string, header: KeyHeader): Promise<{ header: KeyHeader; recoveryKey: string }> {
  const kek = await deriveKek(password, header.kdf);
  let raw: Uint8Array;
  try { raw = await open(kek, header.wk, AAD_KEY); } catch { throw new WrongPasswordError(); }
  try {
    const recoveryKey = newRecoveryKey();
    return { header: { kdf: header.kdf, wk: header.wk, rk: await wrapForRecovery(raw, recoveryKey) }, recoveryKey };
  } finally { raw.fill(0); }
}

/**
 * Forgot the master password: opens the vault key with the recovery key, locks
 * it with a new master password, and issues a fresh recovery key (the old one
 * has been typed somewhere and is retired).
 */
export async function recoverVaultKey(recoveryKey: string, newPassword: string, header: KeyHeader): Promise<{ vk: VaultKey; recoveryKey: string }> {
  if (!header.rk) throw new Error('This vault has no Recovery Kit');
  const kek = await deriveKek(normaliseRecoveryKey(recoveryKey), header.rk.kdf);
  let raw: Uint8Array;
  try { raw = await open(kek, header.rk.wk, AAD_RECOVERY); } catch { throw new WrongRecoveryKeyError(); }
  try {
    const fresh = newRecoveryKey();
    const next: KeyHeader = { ...(await wrapRaw(newPassword, raw)), rk: await wrapForRecovery(raw, fresh) };
    return { vk: { key: await importVaultKey(raw), header: next }, recoveryKey: fresh };
  } finally { raw.fill(0); }
}

export async function encryptVaultJson(json: string, vk: VaultKey): Promise<string> {
  const blob: EncryptedVaultV2 = {
    v: 2, kdf: vk.header.kdf, wk: vk.header.wk, ...(vk.header.rk ? { rk: vk.header.rk } : {}),
    data: await seal(vk.key, enc.encode(json), AAD_DATA),
  };
  return JSON.stringify(blob);
}

// ── File attachments ───────────────────────────────────────────────────────
// Encrypted with the vault key before upload; the file id is bound in as AAD
// so the server can't swap one file for another. Layout: iv(12) || ciphertext.

const fileAad = (id: string) => enc.encode(`securevoult:v2:file:${id}`);

export async function encryptFile(vk: VaultKey, id: string, plain: Uint8Array): Promise<Uint8Array> {
  const iv = random(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: fileAad(id) }, vk.key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return out;
}

export async function decryptFile(vk: VaultKey, id: string, data: Uint8Array): Promise<Uint8Array> {
  if (data.length < 28) throw new Error('This file is damaged');
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12), additionalData: fileAad(id) }, vk.key, data.slice(12)));
}

export function parseBlob(blob: string | object): { v: 1; data: string; salt: string; iv: string } | EncryptedVaultV2 {
  const o = (typeof blob === 'string' ? JSON.parse(blob) : blob) as Record<string, unknown>;
  if (o && o.v === 2) return o as unknown as EncryptedVaultV2;
  if (o && typeof o.data === 'string' && typeof o.salt === 'string' && typeof o.iv === 'string') {
    return { v: 1, data: o.data, salt: o.salt, iv: o.iv };
  }
  throw new Error('Unrecognised vault format');
}

export function headerOf(blob: string | object): KeyHeader | null {
  const p = parseBlob(blob);
  return p.v === 2 ? { kdf: p.kdf, wk: p.wk, ...(p.rk ? { rk: p.rk } : {}) } : null;
}

/**
 * Opens a vault blob of either format with the master password.
 * For a format-1 blob a fresh format-2 key is made, so the caller can re-save it.
 */
export async function decryptWithPassword(blob: string | object, password: string): Promise<{ json: string; vk: VaultKey; upgraded: boolean }> {
  const p = parseBlob(blob);
  if (p.v === 2) {
    const vk = await unlockVaultKey(password, { kdf: p.kdf, wk: p.wk, ...(p.rk ? { rk: p.rk } : {}) });
    return { json: dec.decode(await open(vk.key, p.data, AAD_DATA)), vk, upgraded: false };
  }
  // Format 1: the AES key was derived straight from the password.
  const kek = await deriveKek(password, { alg: 'pbkdf2-sha256', salt: toB64(fromHex(p.salt)), iterations: 100_000 });
  let json: string;
  try {
    json = dec.decode(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromHex(p.iv) }, kek, fromHex(p.data))));
  } catch { throw new WrongPasswordError(); }
  return { json, vk: await createVaultKey(password), upgraded: true };
}

/** Opens a format-2 blob with an already unlocked key (sync, other devices' saves). */
export async function decryptWithKey(blob: string | object, vk: VaultKey): Promise<string> {
  const p = parseBlob(blob);
  if (p.v !== 2) throw new Error('This vault was saved in the old format; unlock again with the master password');
  return dec.decode(await open(vk.key, p.data, AAD_DATA));
}

/** True when the blob's key header differs from ours (master password changed elsewhere). */
export function sameKeyHeader(a: KeyHeader, b: KeyHeader | null): boolean {
  return !!b && a.wk.ct === b.wk.ct && a.kdf.salt === b.kdf.salt && a.rk?.wk.ct === b.rk?.wk.ct;
}
