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
import type { PasswordEntry, PasskeyCredential } from '@/types/vault';
import { createPasskey, signAssertion, clientDataJSON, rpIdAllowed, fromB64url, b64url } from '@/lib/vault-passkeys';

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

const hostOf = (u?: string) => { try { return new URL(/^[a-z]+:\/\//i.test(u ?? '') ? u! : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** This site's logins; ones saved for this exact address (e.g. crm.autisync.com) first. */
const forSite = (entries: PasswordEntry[], site: string, pageUrl?: string) => {
  if (!site) return [];
  const list = VaultService.findEntriesForDomain({ entries, version: '', createdAt: new Date(), updatedAt: new Date() }, site);
  const host = hostOf(pageUrl);
  const exact = (e: PasswordEntry) => [e.url, ...(e.urls ?? [])].some((u) => u && hostOf(u) === host);
  return [...list.filter(exact), ...list.filter((e) => !exact(e))];
};

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

// ── passkeys ─────────────────────────────────────────────────────────────────

type Plain = Record<string, any>;
const bin = (v: unknown): Uint8Array | null => (v && typeof v === 'object' && typeof (v as Plain).$b === 'string' ? fromB64url((v as Plain).$b) : null);

/** The passkey request's site, checked against the frame Chrome says made it. */
function passkeyContext(sender: chrome.runtime.MessageSender, publicKey: Plain, kind: 'create' | 'get') {
  let url: URL;
  try { url = new URL(sender.url ?? ''); } catch { return null; }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;
  const host = url.hostname;
  const rpId = String((kind === 'create' ? publicKey.rp?.id : publicKey.rpId) ?? host).toLowerCase();
  if (!rpIdAllowed(rpId, host, baseDomain(host))) return null;
  let top: string | undefined;
  try { top = sender.tab?.url ? new URL(sender.tab.url).origin : undefined; } catch { /* ignore */ }
  return { rpId, origin: url.origin, top };
}

function passkeysFor(entries: PasswordEntry[], rpId: string): { entry: PasswordEntry; pk: PasskeyCredential }[] {
  return entries.flatMap((entry) => (entry.passkeys ?? []).filter((pk) => pk.rpId === rpId).map((pk) => ({ entry, pk })));
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
      const items = forSite(v.entries, site, sender.url);
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

    // What to show for a passkey request (nothing is created or signed here).
    case 'sv:pkCheck': {
      const kind = msg.kind === 'create' ? 'create' : 'get';
      const pkOpts = (msg.publicKey ?? {}) as Plain;
      const ctx = passkeyContext(sender, pkOpts, kind);
      if (!ctx) return { fallback: true };
      if (kind === 'create' && !(pkOpts.pubKeyCredParams ?? []).some((p: Plain) => p?.alg === -7)) return { fallback: true };
      const v = await unlockedVault();
      if (!v) return { locked: true, rpId: ctx.rpId, userName: pkOpts.user?.name ?? '' };
      const mine = passkeysFor(v.entries, ctx.rpId);
      if (kind === 'create') {
        const excluded = new Set((pkOpts.excludeCredentials ?? []).map((c: Plain) => bin(c.id)).filter(Boolean).map((b: Uint8Array) => b64url(b)));
        return { rpId: ctx.rpId, rpName: pkOpts.rp?.name ?? ctx.rpId, userName: pkOpts.user?.name ?? '', exists: mine.some(({ pk }) => excluded.has(pk.credentialId)) };
      }
      const allow = new Set((pkOpts.allowCredentials ?? []).map((c: Plain) => bin(c.id)).filter(Boolean).map((b: Uint8Array) => b64url(b)));
      const items = mine.filter(({ pk }) => !allow.size || allow.has(pk.credentialId))
        .map(({ entry, pk }) => ({ id: pk.credentialId, userName: pk.userName || entry.username, title: entry.website }));
      return { rpId: ctx.rpId, items };
    }

    case 'sv:pkCreate': {
      const pkOpts = (msg.publicKey ?? {}) as Plain;
      const ctx = passkeyContext(sender, pkOpts, 'create');
      if (!ctx) return { fallback: true };
      const v = await unlockedVault();
      if (!v || !v.vault) return { error: { name: 'NotAllowedError', message: 'SecureVoult is locked.' } };
      const challenge = bin(pkOpts.challenge), userHandle = bin(pkOpts.user?.id);
      if (!challenge || !userHandle) return { error: { name: 'TypeError', message: 'The passkey request is incomplete.' } };
      const excluded = new Set((pkOpts.excludeCredentials ?? []).map((c: Plain) => bin(c.id)).filter(Boolean).map((b: Uint8Array) => b64url(b)));
      if (passkeysFor(v.entries, ctx.rpId).some(({ pk }) => excluded.has(pk.credentialId))) {
        return { error: { name: 'InvalidStateError', message: 'This passkey is already saved in SecureVoult.' } };
      }
      const userName = String(pkOpts.user?.name ?? '');
      const made = await createPasskey({ rpId: ctx.rpId, rpName: pkOpts.rp?.name, userHandle, userName, userDisplayName: pkOpts.user?.displayName });
      const cd = clientDataJSON('webauthn.create', challenge, ctx.origin, ctx.top);

      // Kept with this site's login for the same account, or as a new item.
      const site = baseDomain(ctx.rpId);
      const same = forSite(v.entries, site).find((e) => e.username.toLowerCase() === userName.toLowerCase())
        ?? v.entries.find((e) => (e.passkeys ?? []).some((pk) => pk.rpId === ctx.rpId && pk.userName === userName));
      const vault = same
        ? VaultService.updateEntry(v.vault.vault, same.id, { passkeys: [...(same.passkeys ?? []), made.passkey] })
        : VaultService.addEntry(v.vault.vault, {
          type: 'login', website: String(pkOpts.rp?.name || ctx.rpId).slice(0, 80), url: `https://${ctx.rpId}`,
          username: userName, password: '', category: 'Other', passkeys: [made.passkey],
        });
      await authReady().catch(() => {});
      await saveVault(vault, v.key, v.vault.serverVersion);
      return {
        credential: {
          id: made.passkey.credentialId, clientDataJSON: b64url(cd), attestationObject: b64url(made.attestationObject),
          authenticatorData: b64url(made.authenticatorData), publicKey: b64url(made.publicKeySpki),
          extensions: pkOpts.extensions?.credProps ? { credProps: { rk: true } } : {},
        },
      };
    }

    case 'sv:pkGet': {
      const pkOpts = (msg.publicKey ?? {}) as Plain;
      const ctx = passkeyContext(sender, pkOpts, 'get');
      if (!ctx) return { fallback: true };
      const v = await unlockedVault();
      if (!v) return { error: { name: 'NotAllowedError', message: 'SecureVoult is locked.' } };
      const challenge = bin(pkOpts.challenge);
      if (!challenge) return { error: { name: 'TypeError', message: 'The passkey request is incomplete.' } };
      const found = passkeysFor(v.entries, ctx.rpId).find(({ pk }) => pk.credentialId === msg.credentialId);
      if (!found) return { error: { name: 'NotAllowedError', message: 'That passkey is not in SecureVoult.' } };
      const cd = clientDataJSON('webauthn.get', challenge, ctx.origin, ctx.top);
      const signed = await signAssertion(found.pk, cd);
      return {
        credential: {
          id: found.pk.credentialId, clientDataJSON: b64url(cd), authenticatorData: b64url(signed.authenticatorData),
          signature: b64url(signed.signature), userHandle: found.pk.userHandle, extensions: {},
        },
      };
    }
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
