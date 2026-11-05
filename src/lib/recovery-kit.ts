/**
 * The Recovery Kit: a one-page document with the recovery key, made in the
 * browser and downloaded. SecureVoult never stores or sees the key.
 */

export interface RecoveryKitOptions {
  email?: string | null;
  displayName?: string | null;
  /** The recovery key. Without it this is just an information sheet. */
  recoveryKey?: string | null;
  appUrl?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function generateRecoveryKit({ email, displayName, recoveryKey, appUrl }: RecoveryKitOptions): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const url = appUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://vault.autisync.com');
  const groups = (recoveryKey ?? '').split('-');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SecureVoult Recovery Kit${email ? ` — ${esc(email)}` : ''}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; max-width: 720px; margin: 0 auto; padding: 40px 28px; background: #fff; }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; letter-spacing: -.3px; font-size: 18px; }
  .brand span { color: #B2862F; }
  h1 { font-size: 28px; margin: 18px 0 4px; letter-spacing: -.5px; }
  .sub { color: #475569; margin: 0 0 24px; }
  .who { display: grid; grid-template-columns: 160px 1fr; gap: 6px 16px; font-size: 14px; margin-bottom: 26px; }
  .who dt { color: #64748b; }
  .who dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  .key { border: 2px solid #0f172a; border-radius: 14px; padding: 20px; margin-bottom: 26px; }
  .key h2 { margin: 0 0 12px; font-size: 15px; text-transform: none; }
  .groups { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .groups span { font: 700 22px/1.2 "SFMono-Regular", Consolas, "Liberation Mono", monospace; letter-spacing: 3px; text-align: center; padding: 10px 0; background: #f1f5f9; border-radius: 8px; }
  .blank { height: 54px; border-bottom: 1px solid #94a3b8; }
  ol { padding-left: 20px; }
  li { margin-bottom: 6px; }
  .note { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 16px; font-size: 14px; }
  .foot { color: #64748b; font-size: 12px; margin-top: 28px; }
  @media (max-width: 560px) { .groups { grid-template-columns: repeat(2, 1fr); } .who { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="brand"><svg width="26" height="28" viewBox="8 6 48 52" aria-hidden="true"><path d="M22 26.5V20a10 10 0 0 1 20 0v6.5" fill="none" stroke="#B2862F" stroke-width="5.2" stroke-linecap="round"/><path fill-rule="evenodd" d="M13.5 26.5h37a1.6 1.6 0 0 1 1.35 2.45L33.4 56.1a1.65 1.65 0 0 1-2.8 0L12.15 28.95a1.6 1.6 0 0 1 1.35-2.45zM25 32.5h14L32 44.2z" fill="#B2862F"/></svg>Secure<span>Voult</span></div>
  <h1>Recovery Kit</h1>
  <p class="sub">Keep this somewhere safe and offline: printed in a drawer, or with your important papers.</p>

  <dl class="who">
    <dt>Account</dt><dd>${esc(email ?? '—')}</dd>
    ${displayName ? `<dt>Name</dt><dd>${esc(displayName)}</dd>` : ''}
    <dt>Sign in at</dt><dd>${esc(url)}</dd>
    <dt>Made on</dt><dd>${date}</dd>
  </dl>

  <div class="key">
    <h2>Recovery key</h2>
    ${recoveryKey
      ? `<div class="groups">${groups.map((g) => `<span>${esc(g)}</span>`).join('')}</div>`
      : '<p>No recovery key on this sheet. Create one in Settings → Security → Recovery Kit.</p>'}
  </div>

  <h2>If you forget your master password</h2>
  <ol>
    <li>Sign in at ${esc(url)} with your email and account password.</li>
    <li>On the unlock screen, choose <b>Forgot master password?</b></li>
    <li>Type the recovery key above, then choose a new master password.</li>
    <li>SecureVoult then gives you a new recovery key. Print the new kit and destroy this one.</li>
  </ol>

  <div class="note">
    Anyone with this key and your account sign-in can open your vault, so treat it like a house key.
    Autisync cannot see it, store it, or give you another copy: if you lose both the master password
    and this key, the vault cannot be opened by anyone.
  </div>

  <p style="margin-top:22px">Master password hint (optional, by hand):</p>
  <div class="blank"></div>

  <p class="foot">SecureVoult by Autisync · Encryption: AES-256-GCM, Argon2id · Zero-knowledge</p>
</body>
</html>`;
}
