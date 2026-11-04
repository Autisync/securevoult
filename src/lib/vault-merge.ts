/**
 * Merging two copies of a vault (this device and the server), item by item.
 *
 * The newer edit of each item wins. A deletion is remembered for 180 days
 * (`deleted`), so a device that was offline can't bring a deleted item back,
 * and an item edited after it was deleted elsewhere is kept.
 */
import type { PasswordEntry, VaultData } from '@/types/vault';

const KEEP_TOMBSTONES_MS = 180 * 24 * 3600 * 1000;

const ms = (d: Date | string | undefined) => (d ? new Date(d).getTime() || 0 : 0);

export function reviveVault(raw: VaultData): VaultData {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    deleted: raw.deleted ?? {},
    entries: (raw.entries ?? []).map((e: PasswordEntry) => ({
      ...e,
      type: e.type ?? 'login',
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      ...(e.lastUsed ? { lastUsed: new Date(e.lastUsed) } : {}),
    })),
  };
}

export function mergeVaults(local: VaultData, remote: VaultData, now = Date.now()): VaultData {
  const deleted: Record<string, string> = {};
  for (const src of [remote.deleted ?? {}, local.deleted ?? {}]) {
    for (const [id, at] of Object.entries(src)) {
      if (now - ms(at) > KEEP_TOMBSTONES_MS) continue;
      if (!deleted[id] || ms(at) > ms(deleted[id])) deleted[id] = at;
    }
  }

  const byId = new Map<string, PasswordEntry>();
  for (const e of remote.entries) byId.set(e.id, e);
  for (const e of local.entries) {
    const other = byId.get(e.id);
    if (!other || ms(e.updatedAt) >= ms(other.updatedAt)) byId.set(e.id, e);
  }

  const entries: PasswordEntry[] = [];
  for (const e of byId.values()) {
    const gone = deleted[e.id];
    if (gone && ms(gone) >= ms(e.updatedAt)) continue;
    if (gone) delete deleted[e.id]; // edited after the deletion: keep it
    entries.push(e);
  }

  // Keep the order of the remote copy, then anything new from this device.
  const order = new Map<string, number>();
  [...remote.entries, ...local.entries].forEach((e, i) => { if (!order.has(e.id)) order.set(e.id, i); });
  entries.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return {
    ...remote,
    ...local,
    createdAt: ms(local.createdAt) && ms(local.createdAt) < ms(remote.createdAt) ? local.createdAt : remote.createdAt,
    updatedAt: new Date(Math.max(ms(local.updatedAt), ms(remote.updatedAt))),
    entries,
    deleted,
  };
}

/** Same items with the same edit times: nothing to upload. */
export function sameContent(a: VaultData, b: VaultData): boolean {
  if (a.entries.length !== b.entries.length) return false;
  const m = new Map(a.entries.map((e) => [e.id, ms(e.updatedAt)]));
  return b.entries.every((e) => m.get(e.id) === ms(e.updatedAt))
    && Object.keys(a.deleted ?? {}).length === Object.keys(b.deleted ?? {}).length;
}
