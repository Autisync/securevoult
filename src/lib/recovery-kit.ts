/**
 * recovery-kit.ts — generates the SecureVoult Emergency Recovery Kit HTML document.
 * Extracts the generation logic from Settings.tsx so it can be tested or reused.
 */

export interface RecoveryKitOptions {
  email?: string | null;
  displayName?: string | null;
  entryCount?: number;
}

export function generateRecoveryKit({ email, displayName, entryCount = 0 }: RecoveryKitOptions): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SecureVoult Emergency Recovery Kit</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 20mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #ffffff;
    color: #111827;
    padding: 48px;
    max-width: 740px;
    margin: 0 auto;
    line-height: 1.5;
  }
  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #111827; }
  .logo span { color: #2563eb; }
  .version { font-size: 11px; color: #9ca3af; background: #f3f4f6; border-radius: 6px; padding: 3px 10px; font-family: monospace; }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
  .tagline { font-size: 13px; color: #6b7280; margin-bottom: 6px; }
  .generated { display: inline-flex; align-items: center; gap: 6px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 5px 12px; font-size: 12px; color: #6b7280; margin-bottom: 28px; }
  .divider { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
  /* Sections */
  section { border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
  section > h2 {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: #6b7280; padding: 10px 16px; background: #f9fafb;
    border-bottom: 1px solid #e5e7eb; font-weight: 700;
  }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f3f4f6; gap: 16px; }
  .row:last-child { border-bottom: none; }
  .row .label { font-size: 13px; color: #6b7280; flex-shrink: 0; }
  .row .value { font-size: 13px; font-weight: 600; color: #111827; text-align: right; }
  /* Warning */
  .warning {
    background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px;
    padding: 18px 20px; margin-bottom: 20px;
  }
  .warning-title { font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
  .warning p { font-size: 13px; color: #78350f; line-height: 1.6; }
  /* Master password field */
  .pw-field {
    margin-top: 16px; border: 2px dashed #d97706; border-radius: 10px;
    padding: 20px 16px; min-height: 70px;
  }
  .pw-field-label { font-size: 11px; color: #b45309; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 12px; }
  /* Steps */
  .steps { padding: 14px 16px 16px; }
  .steps ol { padding-left: 18px; }
  .steps li { font-size: 13px; color: #374151; line-height: 1.8; }
  .steps li + li { margin-top: 4px; }
  /* Checklist */
  .checklist { padding: 14px 16px; }
  .checklist-item {
    display: flex; align-items: center; gap: 10px; padding: 8px 0;
    border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151;
  }
  .checklist-item:last-child { border-bottom: none; }
  .checkbox {
    width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px;
    flex-shrink: 0; background: #fff;
  }
  /* Footer */
  .footer {
    margin-top: 36px; padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; color: #9ca3af;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">Secure<span>Voult</span></div>
    <span class="version">v1.0.0</span>
  </div>
  <h1>&#x1F512; Emergency Recovery Kit</h1>
  <p class="tagline">Store this document in a safe, offline location — print it or save it to an encrypted USB drive.</p>
  <div class="generated">
    &#x1F4C5; Generated: ${dateStr} at ${timeStr}
  </div>

  <section>
    <h2>Account information</h2>
    <div class="row">
      <span class="label">Email address</span>
      <span class="value">${email ?? 'Not available'}</span>
    </div>
    <div class="row">
      <span class="label">Display name</span>
      <span class="value">${displayName ?? '—'}</span>
    </div>
    <div class="row">
      <span class="label">Vault entries at time of generation</span>
      <span class="value">${entryCount}</span>
    </div>
    <div class="row">
      <span class="label">Document generated</span>
      <span class="value">${dateStr}</span>
    </div>
  </section>

  <section>
    <h2>Encryption &amp; security details</h2>
    <div class="row"><span class="label">Encryption algorithm</span><span class="value">AES-256-GCM</span></div>
    <div class="row"><span class="label">Key derivation</span><span class="value">PBKDF2-SHA-256 · 100,000 rounds</span></div>
    <div class="row"><span class="label">Architecture</span><span class="value">Zero-knowledge · client-side only</span></div>
    <div class="row"><span class="label">Master password stored server-side</span><span class="value">&#x274C; Never — not even hashed</span></div>
    <div class="row"><span class="label">Vault data on server</span><span class="value">Encrypted ciphertext only</span></div>
  </section>

  <div class="warning">
    <div class="warning-title">&#x26A0;&#xFE0F; Your master password cannot be recovered</div>
    <p>
      Because SecureVoult uses zero-knowledge encryption, your master password is <strong>never transmitted to or stored by our servers</strong>.
      If you forget it, your encrypted vault cannot be decrypted by anyone — including us. This is a deliberate security guarantee, not a limitation.
    </p>
    <p style="margin-top: 10px;"><strong>Write or print your master password in the space below and keep this sheet locked away:</strong></p>
    <div class="pw-field">
      <div class="pw-field-label">Master password (write here by hand):</div>
    </div>
  </div>

  <section>
    <h2>Recovery steps — if you lose your master password</h2>
    <div class="steps">
      <ol>
        <li>Your encrypted vault data remains on our servers. It <em>cannot</em> be decrypted without the master password.</li>
        <li>If you have an encrypted backup (.json file), keep it — it can be imported to a new account once you remember the password.</li>
        <li>Without the master password, there is <strong>no automated recovery path</strong>. This protects you against server breaches.</li>
        <li>If you cannot recover the password: create a new SecureVoult account, then manually re-add critical passwords.</li>
        <li>To avoid future lockout: store this kit in a fireproof safe or a trusted password manager controlled by a family member.</li>
        <li>Always enable 2FA on important accounts (banking, email, SSO) using a separate authenticator app.</li>
      </ol>
    </div>
  </section>

  <section>
    <h2>Before-you-need-it checklist</h2>
    <div class="checklist">
      <div class="checklist-item"><div class="checkbox"></div>I have printed or securely saved this recovery kit</div>
      <div class="checklist-item"><div class="checkbox"></div>I have written my master password in the field above</div>
      <div class="checklist-item"><div class="checkbox"></div>I have downloaded an encrypted vault backup (.json)</div>
      <div class="checklist-item"><div class="checkbox"></div>I have stored the backup in a separate, secure location</div>
      <div class="checklist-item"><div class="checkbox"></div>A trusted person knows where this document is stored</div>
    </div>
  </section>

  <section>
    <h2>Emergency contacts</h2>
    <div class="row"><span class="label">Customer support</span><span class="value">support@securevoult.app</span></div>
    <div class="row"><span class="label">Security disclosure</span><span class="value">security@securevoult.app</span></div>
    <div class="row"><span class="label">Website</span><span class="value">https://securevoult.app</span></div>
  </section>

  <div class="footer">
    <span>SecureVoult Recovery Kit &mdash; ${dateStr}</span>
    <span>Keep this document confidential. Store it offline.</span>
  </div>
</body>
</html>`;
}
