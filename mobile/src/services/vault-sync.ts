/**
 * Opening, saving and syncing the vault: the phone's version of the web
 * app's src/lib/vault.ts, with the same rules:
 *  - the server only accepts a save based on its latest version (409 otherwise),
 *    and then the two copies are merged item by item and saved again;
 *  - a change made offline stays on the phone (dirty) and is uploaded later.
 */
import {
  createVaultKeyWithRecovery, decryptWithKey, decryptWithPassword, encryptVaultJson, headerOf, parseBlob,
  sameKeyHeader, type VaultKey,
} from '../core/vault-crypto';
import { mergeVaults, reviveVault } from '../core/merge';
import type { VaultData } from '../core/types';
import { OfflineError, request } from './api';
import { readLocal, writeLocal } from './local-store';

export interface OpenVault {
  vault: VaultData;
  key: VaultKey;
  serverVersion: number;
  offline: boolean;
}

export class NoVaultError extends Error {
  constructor() { super('There is no vault on this account yet.'); this.name = 'NoVaultError'; }
}

interface ServerVault { encryptedData: string; version: number }

async function getServerVault(): Promise<ServerVault> {
  const res = await request('/vault', { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? 'Could not load your vault.');
  return { encryptedData: data.vault?.encryptedData ?? '', version: Number(data.vault?.version ?? 0) };
}

async function putServerVault(blob: string, baseVersion: number, entryCount: number): Promise<{ ok: true; version: number } | { ok: false }> {
  const res = await request('/vault', { method: 'POST', body: JSON.stringify({ encryptedVault: blob, baseVersion, entryCount }) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) return { ok: false };
  if (!res.ok) throw new Error(data.message ?? 'Could not save your vault.');
  return { ok: true, version: Number(data.version) };
}

const decode = (json: string) => reviveVault(JSON.parse(json) as VaultData);

export function emptyVault(): VaultData {
  const now = new Date();
  return { entries: [], version: '1.0.0', createdAt: now, updatedAt: now, deleted: {}, trash: [], purged: {} };
}

/** Unlock with the master password: the server copy, merged with anything not yet uploaded from here. */
export async function openWithPassword(uid: string, password: string): Promise<OpenVault> {
  const local = await readLocal(uid);
  let server: ServerVault | null = null;
  try {
    server = await getServerVault();
  } catch (e) {
    if (!(e instanceof OfflineError)) throw e;
  }

  if (!server) {
    if (!local) throw new Error('Can\'t reach SecureVoult and this phone has no copy of the vault yet. Connect once to download it.');
    const { json, vk, upgraded } = await decryptWithPassword(local.blob, password);
    const vault = decode(json);
    if (upgraded) await writeLocal({ uid, blob: encryptVaultJson(JSON.stringify(vault), vk), serverVersion: local.serverVersion, dirty: true });
    return { vault, key: vk, serverVersion: local.serverVersion, offline: true };
  }

  if (!server.encryptedData) {
    if (!local) throw new NoVaultError();
    const { json, vk } = await decryptWithPassword(local.blob, password);
    return saveVault(uid, decode(json), vk, 0);
  }

  const opened = await decryptWithPassword(server.encryptedData, password);
  let vault = decode(opened.json);
  let needsUpload = opened.upgraded;
  if (local?.dirty) {
    try {
      const mine = parseBlob(local.blob).v === 2
        ? decode(decryptWithKey(local.blob, opened.vk))
        : decode((await decryptWithPassword(local.blob, password)).json);
      vault = mergeVaults(mine, vault);
      needsUpload = true;
    } catch { /* made with another key (vault reset elsewhere): the server wins */ }
  }
  if (needsUpload) return saveVault(uid, vault, opened.vk, server.version);
  await writeLocal({ uid, blob: server.encryptedData, serverVersion: server.version, dirty: false });
  return { vault, key: opened.vk, serverVersion: server.version, offline: false };
}

/** Unlock with a key kept from an earlier unlock (fingerprint): this phone's copy, then the server's changes. */
export async function openWithKey(uid: string, raw: Uint8Array): Promise<OpenVault> {
  const local = await readLocal(uid);
  if (!local) throw new NoVaultError();
  const header = headerOf(local.blob);
  if (!header) throw new Error('Unlock once with your master password.');
  let vk: VaultKey = { raw, header };
  const vault = decode(decryptWithKey(local.blob, vk));
  if (local.dirty) return saveVault(uid, vault, vk, local.serverVersion);
  const pulled = await pullVault(uid, vault, vk, local.serverVersion).catch(() => null);
  if (pulled) return pulled;
  vk = { raw, header };
  return { vault, key: vk, serverVersion: local.serverVersion, offline: false };
}

/** First vault for a new account, made on the phone. Returns the Recovery Kit key to show once. */
export async function createVault(uid: string, password: string): Promise<OpenVault & { recoveryKey: string }> {
  const { vk, recoveryKey } = await createVaultKeyWithRecovery(password);
  return { ...(await saveVault(uid, emptyVault(), vk, 0)), recoveryKey };
}

/**
 * Encrypts and uploads. If another device saved first, merges its copy in and
 * tries again. A network problem never loses the change: it stays here, dirty.
 */
export async function saveVault(uid: string, vault: VaultData, key: VaultKey, baseVersion: number): Promise<OpenVault> {
  let current = vault;
  let base = baseVersion;
  let vk = key;
  for (let attempt = 0; attempt < 4; attempt++) {
    const blob = encryptVaultJson(JSON.stringify(current), vk);
    await writeLocal({ uid, blob, serverVersion: base, dirty: true });
    let result;
    try {
      result = await putServerVault(blob, base, current.entries.length);
    } catch (e) {
      if (e instanceof OfflineError) return { vault: current, key: vk, serverVersion: base, offline: true };
      throw e;
    }
    if (result.ok) {
      await writeLocal({ uid, blob, serverVersion: result.version, dirty: false });
      return { vault: current, key: vk, serverVersion: result.version, offline: false };
    }
    const server = await getServerVault();
    if (!server.encryptedData) { base = 0; continue; }
    const theirHeader = headerOf(server.encryptedData);
    if (theirHeader && !sameKeyHeader(vk.header, theirHeader)) vk = { raw: vk.raw, header: theirHeader };
    current = mergeVaults(current, decode(decryptWithKey(server.encryptedData, vk)));
    base = server.version;
  }
  throw new Error('Your vault keeps changing on another device. Try again in a moment.');
}

/** Other devices' changes, merged in. Null when nothing changed or the server can't be reached. */
export async function pullVault(uid: string, local: VaultData, key: VaultKey, knownVersion: number): Promise<OpenVault | null> {
  let server: ServerVault;
  try { server = await getServerVault(); } catch { return null; }
  if (!server.encryptedData || server.version === knownVersion) return null;
  const theirHeader = headerOf(server.encryptedData);
  const vk = theirHeader && !sameKeyHeader(key.header, theirHeader) ? { raw: key.raw, header: theirHeader } : key;
  const merged = mergeVaults(local, decode(decryptWithKey(server.encryptedData, vk)));
  await writeLocal({ uid, blob: server.encryptedData, serverVersion: server.version, dirty: false });
  return { vault: merged, key: vk, serverVersion: server.version, offline: false };
}
