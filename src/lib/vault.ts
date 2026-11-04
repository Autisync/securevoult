import { VaultData, PasswordEntry } from '@/types/vault';
import { UniversalStorageService } from './storage';
import { AuthService, getStoredSessionId } from '@/lib/auth';
import {
  createVaultKeyWithRecovery, createRecoveryKey, decryptWithKey, decryptWithPassword, encryptVaultJson, headerOf,
  parseBlob, recoverVaultKey, sameKeyHeader, type VaultKey,
} from './vault-crypto';
import { mergeVaults, reviveVault } from './vault-merge';
import { getMfaToken, MfaRequiredError } from './mfa-client';

export { MfaRequiredError };
import { baseDomain } from './domain';

export { baseDomain };

export class NoVaultError extends Error {
  constructor() {
    super('No vault found. Set up your vault first.');
    this.name = 'NoVaultError';
  }
}

/** Kept for callers that still import it; conflicts are now merged automatically. */
export class VaultVersionConflictError extends Error {
  serverVersion: number;
  constructor(serverVersion: number) {
    super('Your vault changed on another device.');
    this.name = 'VaultVersionConflictError';
    this.serverVersion = serverVersion;
  }
}

class OfflineError extends Error {
  constructor(cause?: unknown) { super('Server unreachable'); this.name = 'OfflineError'; this.cause = cause; }
}

// ── Server API ───────────────────────────────────────────────────────────────

interface ServerVault { encryptedData: string; version: number }

class DatabaseService {
  private baseUrl: string;

  constructor() {
    // In the extension window.location.origin is chrome-extension://[id]; use the app URL.
    const isExtension = typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' && !!chrome.runtime.id;
    this.baseUrl = isExtension
      ? (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.securevoult.co.uk')
      : (typeof window !== 'undefined' ? window.location.origin : '');
  }

  private async request(endpoint: string, init: RequestInit = {}): Promise<Response> {
    const token = await AuthService.getIdToken();
    if (!token) throw new OfflineError('not signed in');
    const sessionId = getStoredSessionId();
    const mfa = await getMfaToken().catch(() => null);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api${endpoint}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
          ...(mfa ? { 'X-MFA-Token': mfa } : {}),
          ...init.headers,
        },
      });
    } catch (e) {
      throw new OfflineError(e);
    }
    if (res.status === 401) {
      const body = await res.clone().json().catch(() => ({}));
      if (body?.code === 'mfa_required') throw new MfaRequiredError();
    }
    return res;
  }

  async getVault(): Promise<ServerVault> {
    const res = await this.request('/vault', { method: 'GET' });
    if (res.status >= 500) throw new OfflineError(res.status);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? 'Could not load your vault');
    return { encryptedData: data.vault?.encryptedData ?? '', version: Number(data.vault?.version ?? 0) };
  }

  /** Compare-and-set: succeeds only if the server is still at `baseVersion`. */
  async putVault(encryptedVault: string, baseVersion: number, entryCount: number): Promise<{ ok: true; version: number } | { ok: false; serverVersion: number }> {
    const res = await this.request('/vault', {
      method: 'POST',
      body: JSON.stringify({ encryptedVault, baseVersion, entryCount }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) return { ok: false, serverVersion: Number(data.serverVersion ?? 0) };
    if (res.status >= 500) throw new OfflineError(res.status);
    if (!res.ok) throw new Error(data.message ?? 'Could not save your vault');
    return { ok: true, version: Number(data.version) };
  }
}

export const databaseAPI = new DatabaseService();

// ── Local copy (offline use) ─────────────────────────────────────────────────

/**
 * What this device keeps: the same encrypted blob the server has, which
 * server version it was based on, and whether it has changes not yet uploaded.
 */
interface LocalCopy { blob: string; serverVersion: number; dirty: boolean; uid: string | null }

async function readLocal(): Promise<LocalCopy | null> {
  const stored = await UniversalStorageService.loadVault().catch(() => null);
  if (!stored) return null;
  if (typeof stored === 'object' && 'blob' in stored) return stored as LocalCopy;
  // Older builds stored the format-1 blob itself.
  return { blob: JSON.stringify(stored), serverVersion: 0, dirty: true, uid: null };
}

async function writeLocal(copy: LocalCopy): Promise<void> {
  await UniversalStorageService.saveVault(copy);
}

export async function forgetLocalCopy(): Promise<void> {
  await UniversalStorageService.clearVault().catch(() => {});
}

// ── Open / create / save ─────────────────────────────────────────────────────

export interface OpenVault {
  vault: VaultData;
  key: VaultKey;
  /** Server version this copy matches. */
  serverVersion: number;
  /** True when the server couldn't be reached; changes are kept here and uploaded later. */
  offline: boolean;
}

const decode = (json: string) => reviveVault(JSON.parse(json) as VaultData);

/** Unlock with the master password: the server copy, merged with anything this device hadn't uploaded. */
export async function openVault(password: string): Promise<OpenVault> {
  const uid = AuthService.currentUid();
  const local = await readLocal();
  const localUsable = local && (local.uid === null || local.uid === uid) ? local : null;

  let server: ServerVault | null = null;
  try {
    server = await databaseAPI.getVault();
  } catch (e) {
    if (!(e instanceof OfflineError)) throw e;
  }

  if (!server) {
    if (!localUsable) throw new Error('Can\'t reach SecureVoult and there is no copy on this device yet.');
    const { json, vk, upgraded } = await decryptWithPassword(localUsable.blob, password);
    const vault = decode(json);
    if (upgraded) await writeLocal({ blob: await encryptVaultJson(JSON.stringify(vault), vk), serverVersion: localUsable.serverVersion, dirty: true, uid });
    return { vault, key: vk, serverVersion: localUsable.serverVersion, offline: true };
  }

  if (!server.encryptedData) {
    // Nothing on the server. A vault that only ever lived on this device gets uploaded.
    if (!localUsable) throw new NoVaultError();
    const { json, vk } = await decryptWithPassword(localUsable.blob, password);
    return saveVault(decode(json), vk, 0);
  }

  const opened = await decryptWithPassword(server.encryptedData, password);
  let vault = decode(opened.json);
  let needsUpload = opened.upgraded;

  if (localUsable?.dirty) {
    try {
      const mine = parseBlob(localUsable.blob).v === 2
        ? decode(await decryptWithKey(localUsable.blob, opened.vk))
        : decode((await decryptWithPassword(localUsable.blob, password)).json);
      vault = mergeVaults(mine, vault);
      needsUpload = true;
    } catch {
      // Local copy made with a different key (e.g. vault reset elsewhere): the server wins.
    }
  }

  if (needsUpload) return saveVault(vault, opened.vk, server.version);
  await writeLocal({ blob: server.encryptedData, serverVersion: server.version, dirty: false, uid });
  return { vault, key: opened.vk, serverVersion: server.version, offline: false };
}

/**
 * Re-opens with a key kept from an earlier unlock (browser extension):
 * this device's copy first, then whatever changed on the server.
 */
export async function openWithKey(key: VaultKey): Promise<OpenVault> {
  const uid = AuthService.currentUid();
  const local = await readLocal();
  if (!local || (local.uid !== null && local.uid !== uid)) throw new NoVaultError();
  const vault = decode(await decryptWithKey(local.blob, key));
  let vk = key;
  const localHeader = headerOf(local.blob);
  if (localHeader && !sameKeyHeader(vk.header, localHeader)) vk = { key: vk.key, header: localHeader };
  if (local.dirty) return saveVault(vault, vk, local.serverVersion);
  const pulled = await pullVault(vault, vk, local.serverVersion).catch(() => null);
  if (pulled) return pulled;
  return { vault, key: vk, serverVersion: local.serverVersion, offline: false };
}

/** The copy on this device without contacting the server (extension background). */
export async function readLocalVault(key: VaultKey): Promise<{ vault: VaultData; serverVersion: number } | null> {
  const local = await readLocal();
  if (!local) return null;
  const vault = decode(await decryptWithKey(local.blob, key));
  return { vault, serverVersion: local.serverVersion };
}

/** A new vault, with its Recovery Kit key (shown once to the user, never stored). */
export async function createVault(password: string): Promise<OpenVault & { recoveryKey: string }> {
  const { vk, recoveryKey } = await createVaultKeyWithRecovery(password);
  return { ...(await saveVault(VaultService.createEmptyVault(), vk, 0)), recoveryKey };
}

/** Makes or replaces the Recovery Kit for an open vault (needs the master password once). */
export async function addRecoveryKit(vault: VaultData, key: VaultKey, baseVersion: number, password: string): Promise<OpenVault & { recoveryKey: string }> {
  const { header, recoveryKey } = await createRecoveryKey(password, key.header);
  return { ...(await saveVault(vault, { key: key.key, header }, baseVersion)), recoveryKey };
}

/**
 * Forgot the master password: the Recovery Kit key opens the vault, a new
 * master password locks it, and a fresh recovery key replaces the used one.
 */
export async function recoverVault(recoveryKey: string, newPassword: string): Promise<OpenVault & { recoveryKey: string }> {
  let blob = '';
  let version = 0;
  try {
    const server = await databaseAPI.getVault();
    blob = server.encryptedData;
    version = server.version;
  } catch (e) {
    if (!(e instanceof OfflineError)) throw e;
    throw new Error('Recovering needs a connection to SecureVoult. Try again when you are online.');
  }
  if (!blob) throw new NoVaultError();
  const header = headerOf(blob);
  if (!header?.rk) throw new Error('This vault has no Recovery Kit yet, so it can only be opened with the master password.');
  const { vk, recoveryKey: fresh } = await recoverVaultKey(recoveryKey, newPassword, header);
  const vault = decode(await decryptWithKey(blob, vk));
  return { ...(await saveVault(vault, vk, version)), recoveryKey: fresh };
}

/** Whether this vault has a Recovery Kit. */
export function hasRecoveryKit(key: VaultKey | null): boolean {
  return !!key?.header.rk;
}

/**
 * Encrypts and uploads. If another device saved first, its copy is fetched,
 * merged item by item, and the merge is uploaded instead.
 * Never throws for a network problem: the change stays on this device.
 */
export async function saveVault(vault: VaultData, key: VaultKey, baseVersion: number): Promise<OpenVault> {
  const uid = AuthService.currentUid();
  let current = vault;
  let base = baseVersion;
  let vk = key;

  for (let attempt = 0; attempt < 4; attempt++) {
    const blob = await encryptVaultJson(JSON.stringify(current), vk);
    await writeLocal({ blob, serverVersion: base, dirty: true, uid });

    let result;
    try {
      result = await databaseAPI.putVault(blob, base, current.entries.length);
    } catch (e) {
      if (e instanceof OfflineError) return { vault: current, key: vk, serverVersion: base, offline: true };
      throw e;
    }

    if (result.ok) {
      await writeLocal({ blob, serverVersion: result.version, dirty: false, uid });
      return { vault: current, key: vk, serverVersion: result.version, offline: false };
    }

    // Someone else saved first: take their copy and merge.
    const server = await databaseAPI.getVault();
    if (!server.encryptedData) { base = 0; continue; }
    const theirs = decode(await decryptWithKey(server.encryptedData, vk));
    // Master password changed on another device: same vault key, new wrapping. Adopt it.
    const theirHeader = headerOf(server.encryptedData);
    if (theirHeader && !sameKeyHeader(vk.header, theirHeader)) vk = { key: vk.key, header: theirHeader };
    current = mergeVaults(current, theirs);
    base = server.version;
  }
  throw new Error('Your vault keeps changing on another device. Try again in a moment.');
}

/** Fetches the server copy and merges it in (other devices' changes). */
export async function pullVault(local: VaultData, key: VaultKey, knownVersion: number): Promise<OpenVault | null> {
  let server: ServerVault;
  try { server = await databaseAPI.getVault(); } catch { return null; }
  if (!server.encryptedData || server.version === knownVersion) return null;
  const theirs = decode(await decryptWithKey(server.encryptedData, key));
  const theirHeader = headerOf(server.encryptedData);
  const vk = theirHeader && !sameKeyHeader(key.header, theirHeader) ? { key: key.key, header: theirHeader } : key;
  const merged = mergeVaults(local, theirs);
  await writeLocal({ blob: server.encryptedData, serverVersion: server.version, dirty: false, uid: AuthService.currentUid() });
  return { vault: merged, key: vk, serverVersion: server.version, offline: false };
}

/** Is there a vault for this account (server first, then this device)? */
export async function vaultExists(): Promise<boolean> {
  try {
    const server = await databaseAPI.getVault();
    if (server.encryptedData) return true;
  } catch (e) {
    // Two-step sign-in is only offered once a vault exists.
    if (e instanceof MfaRequiredError) return true;
  }
  const local = await readLocal();
  const uid = AuthService.currentUid();
  return !!local && (local.uid === null || local.uid === uid);
}

// ── Backups ──────────────────────────────────────────────────────────────────

/** An encrypted backup file. It opens with the master password in use when it was made. */
export async function exportBackup(vault: VaultData, vk: VaultKey): Promise<string> {
  const blob = JSON.parse(await encryptVaultJson(JSON.stringify({ ...vault, exportedAt: new Date().toISOString() }), vk));
  return JSON.stringify({ type: 'password_manager_backup', app: 'SecureVoult', ...blob }, null, 2);
}

export async function readBackup(fileText: string, password: string): Promise<VaultData> {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(fileText); } catch { throw new Error('This isn\'t a SecureVoult backup file'); }
  if (parsed.type !== 'password_manager_backup') throw new Error('This isn\'t a SecureVoult backup file');
  try {
    return decode((await decryptWithPassword(parsed, password)).json);
  } catch {
    throw new Error('Wrong password for this backup, or the file is damaged');
  }
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

export type NewEntry = Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>;

export class VaultService {
  private static readonly VERSION = '2.0.0';

  static createEmptyVault(): VaultData {
    return { entries: [], version: this.VERSION, createdAt: new Date(), updatedAt: new Date(), deleted: {} };
  }

  static addEntry(vault: VaultData, entry: NewEntry): VaultData {
    return this.addEntries(vault, [entry]);
  }

  static addEntries(vault: VaultData, list: NewEntry[]): VaultData {
    const now = new Date();
    const added = list.map((entry) => ({ ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now }) as PasswordEntry);
    return { ...vault, entries: [...vault.entries, ...added], updatedAt: now };
  }

  static updateEntry(vault: VaultData, entryId: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>): VaultData {
    const now = new Date();
    const entries = vault.entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const next = { ...entry, ...updates, updatedAt: now };
      if (updates.password !== undefined && entry.password && updates.password !== entry.password) {
        next.passwordHistory = [{ password: entry.password, changedAt: now.toISOString() }, ...(entry.passwordHistory ?? [])].slice(0, 10);
      }
      return next;
    });
    return { ...vault, entries, updatedAt: now };
  }

  static deleteEntry(vault: VaultData, entryId: string): VaultData {
    const now = new Date();
    return {
      ...vault,
      entries: vault.entries.filter((entry) => entry.id !== entryId),
      deleted: { ...(vault.deleted ?? {}), [entryId]: now.toISOString() },
      updatedAt: now,
    };
  }

  static searchEntries(vault: VaultData, query: string): PasswordEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return vault.entries;
    return vault.entries.filter((e) =>
      [e.website, e.username, e.category, e.notes, e.url, ...(e.urls ?? []), e.card?.holder, e.identity?.fullName, e.identity?.email, ...(e.tags ?? [])]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }

  static filterByCategory(vault: VaultData, category: string): PasswordEntry[] {
    if (category === 'all') return vault.entries;
    return vault.entries.filter((entry) => entry.category === category);
  }

  static getCategories(vault: VaultData): string[] {
    return Array.from(new Set(vault.entries.map((entry) => entry.category).filter(Boolean))).sort();
  }

  /** Logins for a site: same registrable domain, or any of the item's extra addresses. */
  static findEntriesForDomain(vault: VaultData, domain: string): PasswordEntry[] {
    const site = baseDomain(domain);
    if (!site) return [];
    return vault.entries.filter((e) => {
      if (e.type && e.type !== 'login') return false;
      const addresses = [e.url, ...(e.urls ?? [])].filter(Boolean) as string[];
      if (!addresses.length && /\.[a-z]{2,}$/i.test(e.website.trim())) addresses.push(e.website.trim());
      return addresses.some((u) => baseDomain(hostOf(u)) === site);
    });
  }
}

function hostOf(url: string): string {
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname; } catch { return ''; }
}

