/**
 * Vault encryption, format 2: the same bytes as the web app and the extension
 * (src/lib/vault-crypto.ts in the web project).
 *
 *   master password ──Argon2id──▶ key-encryption key (KEK)
 *   KEK ──AES-256-GCM──▶ unwraps a random 256-bit vault key
 *   vault key ──AES-256-GCM──▶ the vault JSON
 *
 * On the phone there is no WebCrypto, so AES-GCM comes from @noble/ciphers
 * (audited, pure JS) and Argon2id from native libsodium, plugged in with
 * setCryptoProviders() at start-up. The vault key is kept as bytes only while
 * the vault is unlocked and wiped when it locks.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { fromB64, fromHex, fromUtf8, toB64, utf8, wipe } from './bytes';

export type KdfParams =
  | { alg: 'argon2id'; salt: string; m: number; t: number; p: number }
  | { alg: 'pbkdf2-sha256'; salt: string; iterations: number };

export interface Sealed { iv: string; ct: string }
export interface RecoveryWrap { kdf: KdfParams; wk: Sealed }
export interface KeyHeader { kdf: KdfParams; wk: Sealed; rk?: RecoveryWrap }
export interface EncryptedVaultV2 { v: 2; kdf: KdfParams; wk: Sealed; rk?: RecoveryWrap; data: Sealed }

/** The unlocked vault key. `raw` must never be logged or stored unencrypted. */
export interface VaultKey { raw: Uint8Array; header: KeyHeader }

export const DEFAULT_KDF = { m: 65536, t: 3, p: 1 } as const;
const RECOVERY_KDF = { m: 19456, t: 2, p: 1 } as const;

const AAD_KEY = utf8('securevoult:v2:key');
const AAD_RECOVERY = utf8('securevoult:v2:recovery');
const AAD_DATA = utf8('securevoult:v2:vault');

// ── Providers (native on the phone, Node in tests) ─────────────────────────

export interface CryptoProviders {
  /** Argon2id v1.3, raw 32-byte output. `memoryKiB` like hash-wasm's memorySize. */
  argon2id(password: Uint8Array, salt: Uint8Array, iterations: number, memoryKiB: number, parallelism: number): Uint8Array | Promise<Uint8Array>;
  randomBytes(n: number): Uint8Array;
}

let providers: CryptoProviders | null = null;
export function setCryptoProviders(p: CryptoProviders): void { providers = p; }
function need(): CryptoProviders {
  if (!providers) throw new Error('Crypto providers not set');
  return providers;
}
export const randomBytes = (n: number): Uint8Array => need().randomBytes(n);

// ── Primitives ─────────────────────────────────────────────────────────────

async function deriveKek(password: string, kdf: KdfParams): Promise<Uint8Array> {
  const salt = fromB64(kdf.salt);
  if (kdf.alg === 'argon2id') {
    const pw = utf8(password.normalize('NFKC'));
    try {
      return await need().argon2id(pw, salt, kdf.t, kdf.m, kdf.p);
    } finally { wipe(pw); }
  }
  // Format 1 (old vaults only): PBKDF2 over the password as typed.
  return pbkdf2Async(sha256, utf8(password), salt, { c: kdf.iterations, dkLen: 32 });
}

function seal(key: Uint8Array, plain: Uint8Array, aad: Uint8Array): Sealed {
  const iv = randomBytes(12);
  const ct = gcm(key, iv, aad).encrypt(plain);
  return { iv: toB64(iv), ct: toB64(ct) };
}

function open(key: Uint8Array, s: Sealed, aad: Uint8Array): Uint8Array {
  return gcm(key, fromB64(s.iv), aad).decrypt(fromB64(s.ct));
}

function newKdf(): KdfParams {
  return { alg: 'argon2id', salt: toB64(randomBytes(16)), ...DEFAULT_KDF };
}

async function wrapRaw(password: string, raw: Uint8Array, kdf: KdfParams = newKdf()): Promise<KeyHeader> {
  const kek = await deriveKek(password, kdf);
  try { return { kdf, wk: seal(kek, raw, AAD_KEY) }; } finally { wipe(kek); }
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class WrongPasswordError extends Error {
  constructor() { super('Wrong master password'); this.name = 'WrongPasswordError'; }
}

// ── Vault key ──────────────────────────────────────────────────────────────

export async function unlockVaultKey(password: string, header: KeyHeader): Promise<VaultKey> {
  const kek = await deriveKek(password, header.kdf);
  try {
    return { raw: open(kek, header.wk, AAD_KEY), header };
  } catch {
    throw new WrongPasswordError();
  } finally { wipe(kek); }
}

const RK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRecoveryKey(): string {
  const bytes = randomBytes(32);
  const chars = Array.from(bytes, (b) => RK_ALPHABET[b & 31]).join('');
  wipe(bytes);
  return chars.match(/.{4}/g)!.join('-');
}
export const normaliseRecoveryKey = (input: string): string => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function wrapForRecovery(raw: Uint8Array, recoveryKey: string): Promise<RecoveryWrap> {
  const kdf: KdfParams = { alg: 'argon2id', salt: toB64(randomBytes(16)), ...RECOVERY_KDF };
  const kek = await deriveKek(normaliseRecoveryKey(recoveryKey), kdf);
  try { return { kdf, wk: seal(kek, raw, AAD_RECOVERY) }; } finally { wipe(kek); }
}

/** A brand-new vault key with its Recovery Kit key (first sign-in on the phone). */
export async function createVaultKeyWithRecovery(password: string): Promise<{ vk: VaultKey; recoveryKey: string }> {
  const raw = randomBytes(32);
  const recoveryKey = newRecoveryKey();
  const header: KeyHeader = { ...(await wrapRaw(password, raw)), rk: await wrapForRecovery(raw, recoveryKey) };
  return { vk: { raw, header }, recoveryKey };
}

// ── Blobs ──────────────────────────────────────────────────────────────────

type V1Blob = { v: 1; data: string; salt: string; iv: string };

export function parseBlob(blob: string | object): V1Blob | EncryptedVaultV2 {
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

export function sameKeyHeader(a: KeyHeader, b: KeyHeader | null): boolean {
  return !!b && a.wk.ct === b.wk.ct && a.kdf.salt === b.kdf.salt && a.rk?.wk.ct === b.rk?.wk.ct;
}

export function encryptVaultJson(json: string, vk: VaultKey): string {
  const blob: EncryptedVaultV2 = {
    v: 2, kdf: vk.header.kdf, wk: vk.header.wk, ...(vk.header.rk ? { rk: vk.header.rk } : {}),
    data: seal(vk.raw, utf8(json), AAD_DATA),
  };
  return JSON.stringify(blob);
}

export function decryptWithKey(blob: string | object, vk: VaultKey): string {
  const p = parseBlob(blob);
  if (p.v !== 2) throw new Error('This vault was saved in the old format; unlock again with the master password');
  return fromUtf8(open(vk.raw, p.data, AAD_DATA));
}

/** Opens either format with the master password. Format 1 gets a fresh format-2 key to re-save with. */
export async function decryptWithPassword(blob: string | object, password: string): Promise<{ json: string; vk: VaultKey; upgraded: boolean }> {
  const p = parseBlob(blob);
  if (p.v === 2) {
    const vk = await unlockVaultKey(password, { kdf: p.kdf, wk: p.wk, ...(p.rk ? { rk: p.rk } : {}) });
    return { json: fromUtf8(open(vk.raw, p.data, AAD_DATA)), vk, upgraded: false };
  }
  const kek = await deriveKek(password, { alg: 'pbkdf2-sha256', salt: toB64(fromHex(p.salt)), iterations: 100_000 });
  let json: string;
  try {
    json = fromUtf8(gcm(kek, fromHex(p.iv)).decrypt(fromHex(p.data)));
  } catch { throw new WrongPasswordError(); } finally { wipe(kek); }
  const raw = randomBytes(32);
  return { json, vk: { raw, header: await wrapRaw(password, raw) }, upgraded: true };
}
