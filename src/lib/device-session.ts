/**
 * "Keep me unlocked on this device" for the web app.
 *
 * The unlocked vault key is stored in this browser's IndexedDB, encrypted with
 * a device key that the browser itself holds as non-extractable: script can
 * use it here, but it can never be copied off the device. The copy expires
 * after the chosen number of days, and Lock / sign-out / auto-lock delete it.
 *
 * Off by default. While it's off, keys can't be exported at all.
 */
import type { KeyHeader } from './vault-crypto';
import { allowKeyExport, fromB64, toB64 } from './vault-crypto';

const DB = 'securevoult-device';
const STORE = 'kv';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const q = d.transaction(STORE).objectStore(STORE).get(key);
    q.onsuccess = () => resolve(q.result as T | undefined);
    q.onerror = () => reject(q.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, 'readwrite');
    value === undefined ? t.objectStore(STORE).delete(key) : t.objectStore(STORE).put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

async function deviceKey(): Promise<CryptoKey> {
  const existing = await get<CryptoKey>('device-key');
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await put('device-key', key);
  return key;
}

interface Stored { iv: string; ct: string; expiresAt: number; uid: string | null }

/** Turns key export on for this page when the user chose to stay unlocked. */
export function enableRememberIfChosen(days: number): void {
  if (days > 0) allowKeyExport();
}

/**
 * A VaultSession (see VaultContext) that survives reloads. `getDays` is read
 * each time, so turning the option on takes effect at the very next unlock.
 */
export function deviceSession(getDays: () => number, uid: () => string | null) {
  return {
    async load(): Promise<{ key: string; header: KeyHeader } | null> {
      const days = getDays();
      if (days <= 0 || typeof indexedDB === 'undefined') return null;
      const s = await get<Stored>('session').catch(() => undefined);
      if (!s) return null;
      if (Date.now() > s.expiresAt || (s.uid && s.uid !== uid())) { await put('session', undefined).catch(() => {}); return null; }
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv) }, await deviceKey(), fromB64(s.ct));
      return JSON.parse(new TextDecoder().decode(plain));
    },
    async save(v: { key: string; header: KeyHeader }): Promise<void> {
      const days = getDays();
      if (days <= 0 || typeof indexedDB === 'undefined') return;
      const prev = await get<Stored>('session').catch(() => undefined);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), new TextEncoder().encode(JSON.stringify({ key: v.key, header: v.header }))));
      // Keep the original expiry when only the header changed (e.g. a new Recovery Kit).
      const expiresAt = prev && prev.uid === uid() && Date.now() < prev.expiresAt ? prev.expiresAt : Date.now() + days * 86400_000;
      await put('session', { iv: toB64(iv), ct: toB64(ct), expiresAt, uid: uid() } satisfies Stored);
    },
    async clear(): Promise<void> {
      if (typeof indexedDB === 'undefined') return;
      await put('session', undefined).catch(() => {});
    },
  };
}

/** For Settings: forget any kept unlock on this device now. */
export async function forgetDevice(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await put('session', undefined).catch(() => {});
}
