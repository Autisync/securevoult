/**
 * SecureVoult — content script.
 *
 * - A small menu under login fields lists this site's logins; picking one fills it.
 * - 2FA code fields get the matching code.
 * - After a sign-in, offers to save the login or update a changed password.
 *
 * Nothing is filled without a click, only into visible fields, and only
 * logins for this frame's own site are ever sent here (the background
 * checks the frame address Chrome reports, not anything the page says).
 * The UI lives in a closed shadow root so the page can't read or restyle it.
 */
import { baseDomain } from '@/lib/domain';

(() => {
  if ((window as any).__svLoaded) return;
  (window as any).__svLoaded = true;
  // Not on SecureVoult itself: its master-password box must never get a login menu.
  try {
    const app = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://vault.autisync.com');
    if (location.hostname === app.hostname) return;
  } catch { /* no app address configured */ }

  type Item = { id: string; title: string; username: string; hasTotp: boolean };
  type Kind = 'login' | 'otp';

  const send = <T = any>(msg: Record<string, unknown>): Promise<T | null> =>
    new Promise((res) => {
      try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res((r ?? null) as T | null); }); }
      catch { res(null); }
    });

  // ── field detection ────────────────────────────────────────────────────────

  const visible = (el: HTMLElement) => {
    if (!el.isConnected || (el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 10) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && parseFloat(st.opacity || '1') > 0.1;
  };

  const attr = (el: Element) => `${el.getAttribute('name') ?? ''} ${el.id} ${el.getAttribute('autocomplete') ?? ''} ${el.getAttribute('placeholder') ?? ''} ${el.getAttribute('aria-label') ?? ''}`.toLowerCase();
  const OTP_RE = /one-time-code|\botp\b|totp|2fa|mfa|one.?time|verification.?code|security.?code|auth.?code|two.?factor|token/;
  const USER_RE = /user|email|login|account|identifier|phone|e-mail/;

  const isPassword = (el: Element): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'password';
  const isOtp = (el: Element): boolean => {
    if (!(el instanceof HTMLInputElement) || !['text', 'tel', 'number', ''].includes(el.type)) return false;
    if (el.autocomplete === 'one-time-code') return true;
    const max = el.maxLength;
    return OTP_RE.test(attr(el)) && (max <= 0 || max <= 10);
  };
  const scopeOf = (el: Element): ParentNode => el.closest('form') ?? el.getRootNode() as ParentNode ?? document;
  const passwordsIn = (scope: ParentNode) => Array.from(scope.querySelectorAll('input[type="password"]')).filter((x) => visible(x as HTMLElement)) as HTMLInputElement[];

  const isUsername = (el: Element): el is HTMLInputElement => {
    if (!(el instanceof HTMLInputElement) || !['text', 'email', 'tel', ''].includes(el.type) || isOtp(el)) return false;
    const a = attr(el);
    if (/search|captcha|coupon|promo/.test(a)) return false;
    if (el.type === 'email' || /username|email/.test(el.autocomplete)) return true;
    // A text field next to a password field, or one named like a username (two-step sign-ins).
    return passwordsIn(scopeOf(el)).length > 0 || USER_RE.test(a);
  };

  function usernameFor(scope: ParentNode, pw?: HTMLInputElement | null): HTMLInputElement | null {
    const inputs = Array.from(scope.querySelectorAll('input')).filter((x) => visible(x) && isUsername(x)) as HTMLInputElement[];
    if (!inputs.length) return null;
    if (!pw) return inputs.find((x) => x.type === 'email' || /username|email/.test(x.autocomplete)) ?? inputs[0];
    // The last username-like field before the password field.
    const before = inputs.filter((x) => x.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before[before.length - 1] ?? inputs[0];
  }

  // ── filling ────────────────────────────────────────────────────────────────

  function setValue(el: HTMLInputElement, value: string) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillLogin(anchor: HTMLInputElement | null, username: string, password: string): boolean {
    const scope: ParentNode = anchor ? scopeOf(anchor) : document;
    const pws = passwordsIn(scope);
    // Sign-up / change-password forms have 2+ password boxes: fill only the current one.
    const pw = pws.find((p) => p.autocomplete !== 'new-password') ?? (pws.length === 1 ? pws[0] : null);
    const user = usernameFor(scope, pw);
    let done = false;
    if (user && username) { setValue(user, username); done = true; }
    if (pw && password) { setValue(pw, password); done = true; }
    if (!pw && !user && anchor && isUsername(anchor) && username) { setValue(anchor, username); done = true; }
    return done;
  }

  // ── UI (closed shadow root) ────────────────────────────────────────────────

  const host = document.createElement('sv-securevoult');
  host.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font: 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .menu { position: absolute; min-width: 240px; max-width: 340px; background: #1A1B1B; color: #F4F1EA; border: 1px solid #333434;
      border-radius: 12px; box-shadow: 0 14px 34px rgba(0,0,0,.45); padding: 6px; }
    .head { display: flex; align-items: center; gap: 6px; padding: 4px 8px 6px; color: #A8A196; font-size: 11px; }
    .head b { color: #F4F1EA; font-weight: 600; font-size: 11px; }
    button.item { all: unset; display: flex; flex-direction: column; gap: 1px; width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
    button.item:hover, button.item:focus-visible { background: #2A2B2B; outline: none; }
    .t { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .u { color: #A8A196; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card { position: fixed; right: 18px; top: 18px; width: 320px; background: #1A1B1B; color: #F4F1EA; border: 1px solid #333434;
      border-radius: 14px; box-shadow: 0 14px 34px rgba(0,0,0,.5); padding: 14px; }
    .card p { margin: 0 0 10px; color: #CFC8BA; overflow-wrap: anywhere; }
    .card h2 { margin: 0 0 6px; font-weight: 600; font-size: 14px; color: #F4F1EA; }
    .row { display: flex; gap: 8px; }
    .row button { all: unset; flex: 1; text-align: center; padding: 8px; border-radius: 9px; cursor: pointer; font-weight: 600; }
    .row button.primary { background: #C9A04A; color: #1A1B1B; }
    .row button.primary:hover { background: #B28228; }
    .row button.ghost { border: 1px solid #333434; color: #CFC8BA; }
    .row button:focus-visible { outline: 2px solid #E3C27A; outline-offset: 2px; }
    .card .head { padding: 0 0 8px; }
    .card button.item { margin: 0 0 6px; background: #232424; }
    .row button.ghost:hover { background: #232424; }
    .toast { position: fixed; right: 18px; bottom: 18px; background: #1A1B1B; color: #F4F1EA; border: 1px solid #333434;
      border-radius: 12px; padding: 10px 14px; box-shadow: 0 10px 26px rgba(0,0,0,.45); }
    svg { flex-shrink: 0; }
  </style>`;
  let attached = false;
  const attach = () => { if (!attached && document.documentElement) { document.documentElement.appendChild(host); attached = true; } };

  const lockIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D1A94C" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  let menu: HTMLElement | null = null;
  let menuFor: HTMLInputElement | null = null;

  function closeMenu() { menu?.remove(); menu = null; menuFor = null; }

  function toast(text: string) {
    attach();
    const t = el('div', 'toast', text);
    root.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  async function openMenu(field: HTMLInputElement, kind: Kind, force = false) {
    const res = await send<{ locked?: boolean; items: Item[] }>({ action: 'sv:matches', kind });
    if (!res || document.activeElement !== field && !force) return;
    if (!res.locked && !res.items.length) { if (force) toast('SecureVoult has no logins for this site yet.'); return; }
    if (res.locked && kind === 'otp') return;
    if (res.locked && !force && !isPassword(field)) return;
    closeMenu();
    attach();
    menu = el('div', 'menu');
    menuFor = field;
    const head = el('div', 'head');
    head.innerHTML = lockIcon;
    head.appendChild(el('b', '', 'SecureVoult'));
    menu.appendChild(head);

    if (res.locked) {
      const b = el('button', 'item') as HTMLButtonElement;
      b.appendChild(el('span', 't', 'Unlock SecureVoult'));
      b.appendChild(el('span', 'u', 'Then pick a login for this site'));
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { closeMenu(); void send({ action: 'sv:unlock' }); });
      menu.appendChild(b);
    } else {
      for (const item of res.items.slice(0, 8)) {
        const b = el('button', 'item') as HTMLButtonElement;
        b.appendChild(el('span', 't', kind === 'otp' ? `2FA code · ${item.title}` : item.title));
        b.appendChild(el('span', 'u', item.username || (kind === 'otp' ? 'Fill the current code' : 'No username')));
        b.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the field
        b.addEventListener('click', () => void pick(item, field, kind));
        menu.appendChild(b);
      }
    }
    root.appendChild(menu);
    place();
  }

  function place() {
    if (!menu || !menuFor) return;
    const r = menuFor.getBoundingClientRect();
    menu.style.left = `${Math.max(4, r.left + window.scrollX)}px`;
    menu.style.top = `${r.bottom + window.scrollY + 4}px`;
    menu.style.minWidth = `${Math.max(240, Math.min(340, r.width))}px`;
  }

  async function pick(item: Item, field: HTMLInputElement, kind: Kind) {
    closeMenu();
    if (kind === 'otp') {
      const r = await send<{ totp?: string | null }>({ action: 'sv:totp', id: item.id });
      if (r?.totp) setValue(field, r.totp);
      return;
    }
    const r = await send<{ username?: string; password?: string; totp?: string | null; locked?: boolean }>({ action: 'sv:fill', id: item.id });
    if (!r || r.locked || r.password === undefined) { toast('Could not fill. Open SecureVoult and try again.'); return; }
    const ok = fillLogin(field, r.username ?? '', r.password ?? '');
    if (r.totp) {
      // Clipboard write is allowed here: we're still inside the user's click.
      navigator.clipboard?.writeText(r.totp).then(() => toast('Filled. 2FA code copied too.'), () => toast('Filled.'));
    } else if (ok) toast('Filled by SecureVoult');
  }

  // ── save / update prompt ───────────────────────────────────────────────────

  type Offer = { status: 'new' | 'update' | 'locked' | 'known' | 'ignore'; token?: string; site?: string; username?: string };

  function showOffer(o: Offer) {
    if (!o.token || !['new', 'update', 'locked'].includes(o.status)) return;
    attach();
    root.querySelector('.card')?.remove();
    const card = el('div', 'card');
    card.appendChild(el('h2', '', o.status === 'update' ? 'Update the saved password?' : 'Save this login?'));
    const who = o.username ? `${o.username} on ${o.site}` : o.site ?? '';
    card.appendChild(el('p', '', o.status === 'update' ? `SecureVoult has a different password for ${who}.` : who));
    if (o.status === 'locked') card.appendChild(el('p', '', 'SecureVoult is locked. Unlock it to save.'));
    const row = el('div', 'row');
    const no = el('button', 'ghost', 'Not now');
    const yes = el('button', 'primary', o.status === 'update' ? 'Update' : o.status === 'locked' ? 'Unlock' : 'Save');
    no.addEventListener('click', () => { card.remove(); void send({ action: 'sv:dismiss', token: o.token }); });
    yes.addEventListener('click', async () => {
      card.remove();
      if (o.status === 'locked') { void send({ action: 'sv:unlock' }); return; }
      const r = await send<{ ok?: boolean; synced?: boolean; updated?: boolean; status?: string }>({ action: 'sv:confirm', token: o.token });
      if (r?.ok) toast(r.updated ? 'Password updated in SecureVoult' : 'Saved to SecureVoult');
      else if (r?.status === 'locked') toast('Unlock SecureVoult, then save from the popup.');
      else toast('Could not save. Try again from the SecureVoult popup.');
    });
    row.append(no, yes);
    card.appendChild(row);
    root.appendChild(card);
    setTimeout(() => card.remove(), 45_000);
  }

  let lastOffered = '';
  async function captured(scope: ParentNode) {
    const pws = passwordsIn(scope).filter((p) => p.value);
    if (!pws.length) return;
    // Change-password forms: the last box is the new password.
    const pw = pws.length > 1 ? pws[pws.length - 1] : pws[0];
    const user = usernameFor(scope, pws[0]);
    const username = user?.value?.trim() || sessionStorage.getItem('sv_last_user') || '';
    const key = `${username}\u0000${pw.value}`;
    if (key === lastOffered) return;
    lastOffered = key;
    const o = await send<Offer>({ action: 'sv:submitted', username, password: pw.value });
    if (o) showOffer(o);
  }

  // Two-step sign-ins (username first, password on the next screen): remember the username for this tab.
  document.addEventListener('change', (e) => {
    const t = e.target as Element;
    if (isUsername(t) && t.value.trim() && passwordsIn(scopeOf(t)).length === 0) {
      try { sessionStorage.setItem('sv_last_user', t.value.trim()); } catch { /* storage blocked */ }
    }
  }, true);

  document.addEventListener('submit', (e) => { void captured(e.target as HTMLFormElement); }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Enter' && isPassword(e.target as Element)) void captured(scopeOf(e.target as Element));
  }, true);
  document.addEventListener('click', (e) => {
    const t = (e.target as Element)?.closest?.('button, input[type="submit"], [role="button"]');
    if (!t) return;
    const scope = scopeOf(t);
    if (passwordsIn(scope).some((p) => p.value)) void captured(scope);
  }, true);

  // ── passkeys (asked by the page bridge, passkey-page.ts) ──────────────────

  const PK = 'securevoult-passkey';
  type PkResult = { fallback?: boolean; error?: { name: string; message?: string }; credential?: unknown };
  const markIcon = '<svg width="18" height="20" viewBox="8 6 48 52" aria-hidden="true"><path d="M22 26.5V20a10 10 0 0 1 20 0v6.5" fill="none" stroke="#CDA24C" stroke-width="5.2" stroke-linecap="round"/><path fill-rule="evenodd" d="M13.5 26.5h37a1.6 1.6 0 0 1 1.35 2.45L33.4 56.1a1.65 1.65 0 0 1-2.8 0L12.15 28.95a1.6 1.6 0 0 1 1.35-2.45zM25 32.5h14L32 44.2z" fill="#CDA24C"/></svg>';
  let pkBusy = false;

  /** A trusted (real) click only: pages can't press SecureVoult's buttons for you. */
  const onTrusted = (b: HTMLElement, fn: () => void) => b.addEventListener('click', (e) => { if (e.isTrusted) fn(); });

  function pkCard(title: string, lines: string[]): { card: HTMLElement; row: HTMLElement } {
    attach();
    root.querySelector('.card')?.remove();
    const card = el('div', 'card');
    const h = el('div', 'head');
    h.innerHTML = markIcon;
    h.appendChild(el('b', '', 'SecureVoult'));
    card.appendChild(h);
    card.appendChild(el('h2', '', title));
    for (const l of lines) card.appendChild(el('p', '', l));
    const row = el('div', 'row');
    card.appendChild(row);
    root.appendChild(card);
    return { card, row };
  }

  async function waitForUnlock(kind: string, publicKey: unknown): Promise<any> {
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const c = await send<any>({ action: 'sv:pkCheck', kind, publicKey });
      if (c && !c.locked) return c;
    }
    return null;
  }

  function passkeyFlow(kind: 'create' | 'get', publicKey: Record<string, any>): Promise<PkResult> {
    return new Promise((done) => {
      let finished = false;
      const finish = (r: PkResult) => { if (finished) return; finished = true; root.querySelector('.card')?.remove(); pkBusy = false; done(r); };
      const cancel = () => finish({ error: { name: 'NotAllowedError', message: 'The request was cancelled.' } });
      setTimeout(cancel, 3 * 60 * 1000);

      const render = (c: any) => {
        const site = c.rpName && c.rpName !== c.rpId ? `${c.rpName} (${c.rpId})` : c.rpId;
        if (c.locked) {
          const { row } = pkCard(kind === 'create' ? 'Save a passkey in SecureVoult?' : 'Sign in with a SecureVoult passkey?', [`${site}`, 'SecureVoult is locked. Unlock it to continue.']);
          const other = el('button', 'ghost', 'Use another device'); const unlock = el('button', 'primary', 'Unlock');
          onTrusted(other, () => finish({ fallback: true }));
          onTrusted(unlock, async () => {
            unlock.textContent = 'Waiting…';
            void send({ action: 'sv:unlock' });
            const next = await waitForUnlock(kind, publicKey);
            if (finished) return;
            if (!next) cancel(); else render(next);
          });
          row.append(other, unlock);
          return;
        }
        if (kind === 'create') {
          if (c.exists) { toast('This passkey is already saved in SecureVoult.'); finish({ error: { name: 'InvalidStateError', message: 'Already saved.' } }); return; }
          const { row } = pkCard('Save a passkey?', [`For ${site}`, `${c.userName ? `${c.userName} · ` : ''}kept in your encrypted vault and synced to your devices.`]);
          const other = el('button', 'ghost', 'Use another device'); const save = el('button', 'primary', 'Save passkey');
          onTrusted(other, () => finish({ fallback: true }));
          onTrusted(save, async () => {
            save.textContent = 'Saving…';
            const r = await send<PkResult>({ action: 'sv:pkCreate', publicKey });
            if (r?.credential) toast('Passkey saved in SecureVoult');
            finish(r ?? { error: { name: 'NotAllowedError', message: 'SecureVoult did not answer.' } });
          });
          row.append(other, save);
          return;
        }
        // Sign in
        const items: { id: string; userName: string; title: string }[] = c.items ?? [];
        if (!items.length) { finish({ fallback: true }); return; }
        const { card, row } = pkCard('Sign in with a passkey', [`${site}`]);
        for (const it of items.slice(0, 6)) {
          const b = el('button', 'item') as HTMLButtonElement;
          b.appendChild(el('span', 't', it.userName || it.title));
          b.appendChild(el('span', 'u', `Passkey · ${it.title}`));
          onTrusted(b, async () => {
            const r = await send<PkResult>({ action: 'sv:pkGet', publicKey, credentialId: it.id });
            finish(r ?? { error: { name: 'NotAllowedError', message: 'SecureVoult did not answer.' } });
          });
          card.insertBefore(b, row);
        }
        const other = el('button', 'ghost', 'Use another device');
        onTrusted(other, () => finish({ fallback: true }));
        row.append(other);
      };

      void send<any>({ action: 'sv:pkCheck', kind, publicKey }).then((c) => {
        if (!c || c.fallback) { finish({ fallback: true }); return; }
        render(c);
      });
    });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.channel !== PK || e.data.dir !== 'ask' || typeof e.data.id !== 'string') return;
    const { id, kind, publicKey } = e.data;
    window.postMessage({ channel: PK, dir: 'ack', id }, location.origin);
    if (pkBusy) { window.postMessage({ channel: PK, dir: 'reply', id, result: { error: { name: 'NotAllowedError', message: 'Another passkey request is open.' } } }, location.origin); return; }
    pkBusy = true;
    void passkeyFlow(kind === 'create' ? 'create' : 'get', publicKey ?? {}).then((result) => window.postMessage({ channel: PK, dir: 'reply', id, result }, location.origin));
  });

  // ── wiring ─────────────────────────────────────────────────────────────────

  document.addEventListener('focusin', (e) => {
    const t = e.target as Element;
    if (!(t instanceof HTMLInputElement) || t === menuFor) return;
    if (isOtp(t)) void openMenu(t, 'otp');
    else if (isPassword(t) || isUsername(t)) void openMenu(t, 'login');
    else closeMenu();
  }, true);
  document.addEventListener('focusout', () => setTimeout(() => { if (menuFor && document.activeElement !== menuFor) closeMenu(); }, 150), true);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === 'sv:showMenu') {
      const a = document.activeElement;
      if (document.hasFocus() && a instanceof HTMLInputElement) void openMenu(a, isOtp(a) ? 'otp' : 'login', true);
      sendResponse({ ok: true });
    } else if (msg?.action === 'fillCredentials') {
      // From the popup. Every frame gets this; only one on the login's own site fills.
      const mine = baseDomain(location.hostname);
      if (!msg.site || msg.site !== mine || window !== window.top && !document.hasFocus() && passwordsIn(document).length === 0) {
        sendResponse({ success: false });
        return;
      }
      const a = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
      sendResponse({ success: fillLogin(a, msg.username ?? '', msg.password ?? '') });
    }
    return false;
  });

  // A save/update offer from the previous page (the sign-in navigated away first).
  if (window === window.top) {
    setTimeout(async () => {
      const o = await send<Offer>({ action: 'sv:promptFor' });
      if (o) showOffer(o);
    }, 600);
  }
})();
