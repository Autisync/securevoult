/**
 * SecureVoult extension — background worker.
 *
 * Holds nothing decrypted between messages. While the vault is unlocked the
 * vault key sits in chrome.storage.session (memory only, cleared when the
 * browser closes or the auto-lock timer fires, never readable by web pages
 * or content scripts). Each request decrypts this device's copy, answers,
 * and lets go.
 *
 * Pages only ever get logins for their own site: the site is taken from
 * Chrome's sender.url, never from what the page says.
 */
import { authReady } from '@/lib/auth';
import { VaultService, readLocalVault, saveVault } from '@/lib/vault';
import { baseDomain } from '@/lib/domain';
import { importRawKey, type KeyHeader, type VaultKey } from '@/lib/vault-crypto';
import { parseTotp, totpNow } from '@/lib/totp';
import type { PasswordEntry } from '@/types/vault';

interface Session { key: string; header: KeyHeader; autoLockMinutes: number }
interface Pending { token: string; site: string; url: string; title: string; username: string; password: string; entryId?: string; at: number }

const SESSION = 'sv_session';
const PENDING = 'sv_pending';
const LOCK_ALARM = 'sv-autolock';
const PENDING_TTL = 2 * 60 * 1000;

chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});

// ── session (unlocked key) ───────────────────────────────────────────────────

async function getSession(): Promise<Session | null> {
  return ((await chrome.storage.session.get(SESSION))[SESSION] as Session | undefined) ?? null;
}

async function touch(minutes?: number) {
  const s = minutes ?? (await getSession())?.autoLockMinutes ?? 15;
  if (s > 0) await chrome.alarms.create(LOCK_ALARM, { delayInMinutes: s });
  else await chrome.alarms.clear(LOCK_ALARM);
}

async function lock() {
  await chrome.storage.session.remove([SESSION, PENDING]);
  await chrome.alarms.clear(LOCK_ALARM);
  void setBadge(false);
}

async function setBadge(unlocked: boolean) {
  await chrome.action.setTitle({ title: unlocked ? 'SecureVoult: unlocked' : 'SecureVoult: locked' }).catch(() => {});
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === LOCK_ALARM) void lock(); });

async function unlockedVault(): Promise<{ key: VaultKey; entries: PasswordEntry[]; vault: Awaited<ReturnType<typeof readLocalVault>> } | null> {
  const s = await getSession();
  if (!s) return null;
  const key = await importRawKey(s.key, s.header);
  const vault = await readLocalVault(key).catch(() => null);
  if (!vault) return null;
  await touch(s.autoLockMinutes);
  return { key, entries: vault.vault.entries, vault };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function siteOf(url: string | undefined): string {
  try {
    const u = new URL(url ?? '');
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) return '';
    return baseDomain(u.hostname);
  } catch { return ''; }
}

const forSite = (entries: PasswordEntry[], site: string) =>
  site ? VaultService.findEntriesForDomain({ entries, version: '', createdAt: new Date(), updatedAt: new Date() }, site) : [];

const summary = (e: PasswordEntry) => ({ id: e.id, title: e.website, username: e.username, hasTotp: !!parseTotp(e.totp) });

async function totpFor(e: PasswordEntry): Promise<string | null> {
  const cfg = parseTotp(e.totp);
  return cfg ? (await totpNow(cfg)).code : null;
}

async function pendingList(): Promise<Pending[]> {
  const list = ((await chrome.storage.session.get(PENDING))[PENDING] as Pending[] | undefined) ?? [];
  return list.filter((p) => Date.now() - p.at < PENDING_TTL);
}

async function setPending(list: Pending[]) {
  await chrome.storage.session.set({ [PENDING]: list.slice(-5) });
}

async function openUnlock() {
  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.windows.create({ url: chrome.runtime.getURL('popup.html'), type: 'popup', width: 380, height: 620 });
  }
}

// ── messages ─────────────────────────────────────────────────────────────────

type Msg = { action: string; [k: string]: unknown };
const fromExtensionPage = (sender: chrome.runtime.MessageSender) =>
  sender.id === chrome.runtime.id && !sender.tab && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
const fromPage = (sender: chrome.runtime.MessageSender) => sender.id === chrome.runtime.id && !!sender.tab;

async function handle(msg: Msg, sender: chrome.runtime.MessageSender): Promise<unknown> {
  // Popup ↔ background: keeping the unlocked key.
  if (fromExtensionPage(sender)) {
    switch (msg.action) {
      case 'session:get': {
        const s = await getSession();
        return s ? { key: s.key, header: s.header } : null;
      }
      case 'session:set': {
        const s = msg.session as Session;
        await chrome.storage.session.set({ [SESSION]: s });
        await touch(s.autoLockMinutes);
        void setBadge(true);
        return { ok: true };
      }
      case 'session:clear':
        await lock();
        return { ok: true };
      case 'pending:take': {
        // Logins seen while locked, handed to the popup after unlock.
        const list = await pendingList();
        await setPending([]);
        return list.map(({ token: _t, ...rest }) => rest);
      }
    }
    return { error: 'unknown action' };
  }

  if (!fromPage(sender)) return { error: 'Unauthorized sender' };
  const site = siteOf(sender.url);
  const tabId = sender.tab!.id!;

  switch (msg.action) {
    case 'sv:matches': {
      if (!site) return { items: [] };
      const v = await unlockedVault();
      if (!v) return { locked: true, items: [] };
      const items = forSite(v.entries, site);
      return { items: (msg.kind === 'otp' ? items.filter((e) => parseTotp(e.totp)) : items).map(summary) };
    }

    case 'sv:fill': {
      const v = await unlockedVault();
      if (!v) return { locked: true };
      const e = forSite(v.entries, site).find((x) => x.id === msg.id);
      if (!e) return { error: 'not for this site' };
      return { username: e.username, password: e.password, totp: await totpFor(e) };
    }

    case 'sv:totp': {
      const v = await unlockedVault();
      if (!v) return { locked: true };
      const e = forSite(v.entries, site).find((x) => x.id === msg.id);
      return e ? { totp: await totpFor(e) } : { error: 'not for this site' };
    }

    case 'sv:submitted': {
      const username = String(msg.username ?? '').trim();
      const password = String(msg.password ?? '');
      if (!site || !password) return { status: 'ignore' };
      const v = await unlockedVault();
      const same = v ? forSite(v.entries, site).filter((e) => e.username.toLowerCase() === username.toLowerCase()) : [];
      if (same.some((e) => e.password === password)) return { status: 'known' };
      const token = crypto.randomUUID();
      const pending: Pending = {
        token, site, url: String(sender.url), title: sender.tab?.title || site, username, password,
        entryId: same[0]?.id, at: Date.now(),
      };
      await setPending([...(await pendingList()).filter((p) => p.site !== site), pending]);
      // Shown again on the next page if the login navigates away first.
      await chrome.storage.session.set({ [`sv_prompt_${tabId}`]: token });
      return { status: v ? (same[0] ? 'update' : 'new') : 'locked', token, site, username };
    }

    case 'sv:promptFor': {
      const token = (await chrome.storage.session.get(`sv_prompt_${tabId}`))[`sv_prompt_${tabId}`] as string | undefined;
      if (!token) return null;
      const p = (await pendingList()).find((x) => x.token === token && x.site === site);
      if (!p) return null;
      const v = await unlockedVault();
      return { status: v ? (p.entryId ? 'update' : 'new') : 'locked', token: p.token, site: p.site, username: p.username };
    }

    case 'sv:dismiss': {
      await chrome.storage.session.remove(`sv_prompt_${tabId}`);
      if (msg.token) await setPending((await pendingList()).filter((p) => p.token !== msg.token));
      return { ok: true };
    }

    case 'sv:confirm': {
      await chrome.storage.session.remove(`sv_prompt_${tabId}`);
      const p = (await pendingList()).find((x) => x.token === msg.token && x.site === site);
      if (!p) return { error: 'expired' };
      const v = await unlockedVault();
      if (!v || !v.vault) { await openUnlock(); return { status: 'locked' }; }
      const vault = p.entryId && v.entries.some((e) => e.id === p.entryId)
        ? VaultService.updateEntry(v.vault.vault, p.entryId, { password: p.password })
        : VaultService.addEntry(v.vault.vault, {
          type: 'login', website: p.title.slice(0, 80) || p.site, url: new URL(p.url).origin,
          username: p.username, password: p.password, category: 'Other',
        });
      await authReady().catch(() => {});
      const saved = await saveVault(vault, v.key, v.vault.serverVersion);
      await setPending((await pendingList()).filter((x) => x.token !== p.token));
      return { ok: true, synced: !saved.offline, updated: !!p.entryId };
    }

    case 'sv:unlock':
      await openUnlock();
      return { ok: true };
  }
  return { error: 'unknown action' };
}

chrome.runtime.onMessage.addListener((msg: Msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (e) => sendResponse({ error: e instanceof Error ? e.message : 'failed' }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => { void chrome.storage.session.remove(`sv_prompt_${tabId}`); });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'sv-fill', title: 'Fill with SecureVoult', contexts: ['editable'] }, () => void chrome.runtime.lastError);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sv-fill' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'sv:showMenu' }, { frameId: info.frameId }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'fill-password' && tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'sv:showMenu' }).catch(() => {});
});
