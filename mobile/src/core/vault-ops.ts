/**
 * Changes to a vault, with the same rules as the web app's VaultService:
 * edit times move on so merges pick the newest edit, deleted items go to
 * Trash for 30 days, and old passwords are kept in a short history.
 */
import { toB64 } from './bytes';
import type { PasswordEntry, VaultData } from './types';
import { randomBytes } from './vault-crypto';

export type NewEntry = Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>;

/** RFC 4122 v4 id from the secure random source (no crypto.randomUUID in Hermes). */
export function newId(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function addEntry(vault: VaultData, entry: NewEntry): { vault: VaultData; id: string } {
  const now = new Date();
  const id = newId();
  return { id, vault: { ...vault, entries: [...vault.entries, { ...entry, id, createdAt: now, updatedAt: now } as PasswordEntry], updatedAt: now } };
}

export function updateEntry(vault: VaultData, id: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>): VaultData {
  const now = new Date();
  return {
    ...vault,
    updatedAt: now,
    entries: vault.entries.map((e) => {
      if (e.id !== id) return e;
      const next: PasswordEntry = { ...e, ...updates, updatedAt: now };
      if (updates.password !== undefined && e.password && updates.password !== e.password) {
        next.passwordHistory = [{ password: e.password, changedAt: now.toISOString() }, ...(e.passwordHistory ?? [])].slice(0, 10);
      }
      return next;
    }),
  };
}

export function trashEntry(vault: VaultData, id: string): VaultData {
  const now = new Date();
  const entry = vault.entries.find((e) => e.id === id);
  return {
    ...vault,
    entries: vault.entries.filter((e) => e.id !== id),
    deleted: { ...(vault.deleted ?? {}), [id]: now.toISOString() },
    trash: entry ? [...(vault.trash ?? []).filter((t) => t.entry.id !== id), { entry, trashedAt: now.toISOString() }] : vault.trash,
    updatedAt: now,
  };
}

export function restoreEntry(vault: VaultData, id: string): VaultData {
  const t = (vault.trash ?? []).find((x) => x.entry.id === id);
  if (!t) return vault;
  const now = new Date();
  const deleted = { ...(vault.deleted ?? {}) };
  delete deleted[id];
  return {
    ...vault,
    entries: [...vault.entries.filter((e) => e.id !== id), { ...t.entry, updatedAt: now }],
    trash: (vault.trash ?? []).filter((x) => x.entry.id !== id),
    deleted,
    updatedAt: now,
  };
}

export function searchEntries(entries: PasswordEntry[], query: string): PasswordEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    [e.website, e.username, e.category, e.notes, e.url, ...(e.urls ?? []), e.card?.holder, e.identity?.fullName,
      e.identity?.email, e.bank?.bankName, e.bank?.accountName, e.document?.fullName, e.document?.issuedBy, e.wifi?.ssid, ...(e.tags ?? [])]
      .some((v) => v?.toLowerCase().includes(q)),
  );
}

/** Stable short fingerprint of the vault's contents, to skip re-sending autofill data that hasn't changed. */
export function contentStamp(vault: VaultData): string {
  let h = 0;
  for (const e of vault.entries) {
    const s = `${e.id}:${new Date(e.updatedAt).getTime()}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `${vault.entries.length}:${h}`;
}

export const randomToken = (n = 16) => toB64(randomBytes(n));
