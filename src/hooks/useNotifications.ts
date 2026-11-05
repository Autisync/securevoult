'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVault } from '@/contexts/VaultContext';
import { api } from '@/lib/api-client';
import { expiryOf, reminderDays, ITEM_TYPE, typeOf } from '@/lib/item-types';

export interface AppNote {
  id: string;
  kind: 'breach' | 'expiry' | string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  /** Where "View" goes: 'breach', or an item id for 'expiry'. */
  link: string;
}

const READ_KEY = 'sv_notes_read';
const readLocal = (): string[] => { try { return JSON.parse(localStorage.getItem(READ_KEY) ?? '[]'); } catch { return []; } };
const saveLocal = (ids: string[]) => { try { localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-300))); } catch { /* private window */ } };

/**
 * The bell: reminders worked out on this device from the vault (a document or
 * card about to expire), plus what the server found (new data breaches).
 */
export function useNotifications() {
  const { vault, isUnlocked } = useVault();
  const [server, setServer] = useState<AppNote[]>([]);
  const [localRead, setLocalRead] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readLocal()));

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: AppNote[] }>('/api/notifications');
      setServer(r.items.map((n) => ({ ...n, at: String(n.at) })));
    } catch { /* offline: local reminders still show */ }
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 5 * 60_000);
    return () => window.clearInterval(t);
  }, [isUnlocked, load]);

  const reminders = useMemo<AppNote[]>(() => {
    const out: AppNote[] = [];
    const now = Date.now();
    for (const e of vault?.entries ?? []) {
      const exp = expiryOf(e);
      const days = reminderDays(e);
      if (!exp || !days) continue;
      const left = Math.ceil((exp.getTime() - now) / 86400000);
      if (left > days || left < -60) continue;
      const id = `exp:${e.id}:${exp.toISOString().slice(0, 10)}`;
      const what = `${ITEM_TYPE[typeOf(e)].label} "${e.website || 'Untitled'}"`;
      out.push({
        id, kind: 'expiry', link: e.id, read: localRead.includes(id),
        title: left < 0 ? `${what} has expired` : left === 0 ? `${what} expires today` : `${what} expires in ${left} day${left === 1 ? '' : 's'}`,
        body: left < 0 ? 'Renew it, then update the item with the new details.' : `Expiry date: ${exp.toLocaleDateString()}.`,
        at: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      });
    }
    return out;
  }, [vault, localRead]);

  const items = useMemo(
    () => [...reminders, ...server].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [reminders, server],
  );
  const unread = items.filter((n) => !n.read).length;

  const markRead = useCallback(async (ids?: string[]) => {
    const all = ids ?? items.filter((n) => !n.read).map((n) => n.id);
    const local = all.filter((id) => id.startsWith('exp:'));
    const remote = all.filter((id) => !id.startsWith('exp:'));
    if (local.length) setLocalRead((prev) => { const next = Array.from(new Set([...prev, ...local])); saveLocal(next); return next; });
    if (remote.length) {
      setServer((prev) => prev.map((n) => (remote.includes(n.id) ? { ...n, read: true } : n)));
      try { await api('/api/notifications', { action: 'read', ids: remote }); } catch { /* next load shows them again */ }
    }
  }, [items]);

  return { items, unread, markRead, reload: load };
}
