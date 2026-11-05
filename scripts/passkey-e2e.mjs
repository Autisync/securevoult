// ============================================================================
// passkey-e2e — website passkeys kept in SecureVoult, in a real Chromium
// ============================================================================
// Loads the built extension, unlocks a vault, then on a fake https site:
// saves a passkey (the site checks the attestation), signs in with it (the
// site verifies the signature), checks the passkey sits in the encrypted
// vault, and that a look-alike site can't use it.
//
//   npm run extension:build && node scripts/passkey-e2e.mjs
// ============================================================================
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ext = resolve(root, 'extension-package');
const vc = await import(pathToFileURL(resolve(root, 'src/lib/vault-crypto.ts')).href);

let failures = 0;
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 300) : ''}`);
  if (!cond) failures++;
};

vc.allowKeyExport();
const vk = await vc.createVaultKey('master', { alg: 'argon2id', salt: btoa('0123456789abcdef'), m: 1024, t: 1, p: 1 });
const now = new Date().toISOString();
const vault = { version: '2.0.0', createdAt: now, updatedAt: now, deleted: {}, entries: [
  { id: 'e1', type: 'login', website: 'Example', url: 'https://login.example.test/', username: 'helio@example.test', password: 'pw', category: 'Work', createdAt: now, updatedAt: now },
] };
const blob = await vc.encryptVaultJson(JSON.stringify(vault), vk);
const rawKey = await vc.exportRawKey(vk);

// The website side: a tiny relying party that checks what it gets.
const SITE = `<!doctype html><html><body><h1>Example</h1><script>
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
const sha = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-256', b));
const derToRaw = (d) => { d = new Uint8Array(d); let i = 2; const rl = d[i+1]; let r = d.slice(i+2, i+2+rl); i += 2+rl; const sl = d[i+1]; let s = d.slice(i+2, i+2+sl);
  const pad = (x) => { while (x.length > 32 && x[0] === 0) x = x.slice(1); const o = new Uint8Array(32); o.set(x, 32 - x.length); return o; };
  const o = new Uint8Array(64); o.set(pad(r)); o.set(pad(s), 32); return o; };
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
window.register = async () => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { id: 'example.test', name: 'Example' },
    user: { id: new TextEncoder().encode('user-123'), name: 'helio@example.test', displayName: 'Helio' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    extensions: { credProps: true } } });
  const cd = JSON.parse(new TextDecoder().decode(cred.response.clientDataJSON));
  const authData = new Uint8Array(cred.response.getAuthenticatorData());
  window.__pk = { id: cred.id, spki: cred.response.getPublicKey() };
  return { isPKC: cred instanceof PublicKeyCredential, type: cd.type, origin: cd.origin, challengeOk: cd.challenge === b64(challenge),
    rpIdHashOk: eq(authData.slice(0, 32), await sha(new TextEncoder().encode('example.test'))), flags: authData[32], alg: cred.response.getPublicKeyAlgorithm(),
    credProps: cred.getClientExtensionResults().credProps, json: !!cred.toJSON().response.attestationObject };
};
window.signIn = async (allow) => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.get({ publicKey: { challenge, rpId: 'example.test', userVerification: 'required',
    allowCredentials: allow ? [{ type: 'public-key', id: Uint8Array.from(atob(window.__pk.id.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)) }] : [] } });
  const key = await crypto.subtle.importKey('spki', window.__pk.spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ad = new Uint8Array(cred.response.authenticatorData), cdRaw = new Uint8Array(cred.response.clientDataJSON);
  const signed = new Uint8Array(ad.length + 32); signed.set(ad); signed.set(await sha(cdRaw), ad.length);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(cred.response.signature), signed);
  const cd = JSON.parse(new TextDecoder().decode(cdRaw));
  return { valid, sameId: cred.id === window.__pk.id, type: cd.type, challengeOk: cd.challenge === b64(challenge),
    user: new TextDecoder().decode(cred.response.userHandle) };
};
window.tryOther = async () => {
  try { await navigator.credentials.get({ publicKey: { challenge: new Uint8Array(32), rpId: 'example.test', timeout: 1500 } }); return 'got credential'; }
  catch (e) { return e.name; }
};
</script></body></html>`;

const context = await chromium.launchPersistentContext(mkdtempSync(resolve(tmpdir(), 'sv-pk-')), {
  headless: true, channel: 'chromium', args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`], ignoreHTTPSErrors: true,
});
await context.route('**/*', (route) => {
  const h = new URL(route.request().url()).hostname;
  if (h === 'login.example.test' || h === 'example-login.test') return route.fulfill({ contentType: 'text/html', body: SITE });
  return route.fulfill({ status: 404, body: '' });
});
let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker');
// The worker can be reported before its chrome.* APIs are ready.
for (let i = 0; i < 50 && !(await worker.evaluate(() => !!globalThis.chrome?.storage?.local)); i++) await new Promise((r) => setTimeout(r, 100));
await worker.evaluate(async ({ blob, rawKey, header }) => {
  await chrome.storage.local.set({ securevoult_encrypted_vault: { blob, serverVersion: 1, dirty: false, uid: null } });
  await chrome.storage.session.set({ sv_session: { key: rawKey, header, autoLockMinutes: 15 } });
}, { blob, rawKey, header: vk.header });

const page = await context.newPage();
await page.goto('https://login.example.test/');
await page.waitForTimeout(800);
const cdp = await context.newCDPSession(page);

/** Clicks a button inside SecureVoult's closed shadow root, by its text, with a real mouse click. */
async function clickSv(text, timeout = 8000, shot = '') {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    let found = null;
    const walk = (n, parent) => {
      if (found) return;
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim() === text) found = parent;
      for (const c of [...(n.children ?? []), ...(n.shadowRoots ?? [])]) walk(c, n);
    };
    walk(doc, null);
    if (found) {
      let id = found.nodeId;
      const box = await cdp.send('DOM.getBoxModel', { nodeId: id }).catch(() => null);
      if (box) {
        const q = box.model.border; const x = (q[0] + q[2]) / 2, y = (q[1] + q[5]) / 2;
        if (shot) await page.screenshot({ path: shot }).catch(() => {});
        await page.mouse.click(x, y);
        return true;
      }
    }
    await page.waitForTimeout(250);
  }
  return false;
}

console.log('saving a passkey');
const reg = page.evaluate(() => window.register());
ok(await clickSv('Save passkey', 8000, resolve(root, 'scripts/.e2e-passkey.png')), 'SecureVoult asks before saving');
const r = await reg;
ok(r.isPKC && r.type === 'webauthn.create' && r.origin === 'https://login.example.test' && r.challengeOk, 'site gets a normal passkey for its own origin', r);
ok(r.rpIdHashOk && (r.flags & 0x45) === 0x45 && r.alg === -7, 'attestation: right site, user present + verified, ES256', r);
ok(r.credProps?.rk === true && r.json, 'credProps and toJSON work (common libraries use them)', r);

const stored = await worker.evaluate(async () => (await chrome.storage.local.get('securevoult_encrypted_vault')).securevoult_encrypted_vault);
const opened = JSON.parse(await vc.decryptWithKey(stored.blob, vk));
const pk = opened.entries.flatMap((e) => (e.passkeys ?? []).map((p) => ({ e, p })))[0];
ok(pk && pk.e.id === 'e1' && pk.p.rpId === 'example.test' && pk.p.privateKey.length > 100, 'kept with the existing login, inside the encrypted vault', pk && { entry: pk.e.id, rp: pk.p.rpId });
ok(!stored.blob.includes(pk?.p.privateKey ?? '###'), 'private key not readable in stored data');

console.log('signing in');
for (const allow of [true, false]) {
  const s = page.evaluate((a) => window.signIn(a), allow);
  ok(await clickSv('helio@example.test', 8000, allow ? resolve(root, 'scripts/.e2e-passkey-signin.png') : ''), `SecureVoult offers the passkey (${allow ? 'listed credential' : 'discoverable'})`);
  const res = await s;
  ok(res.valid && res.sameId && res.type === 'webauthn.get' && res.challengeOk && res.user === 'user-123', 'site verifies the signature', res);
}

console.log('look-alike site');
const phish = await context.newPage();
await phish.goto('https://example-login.test/');
await phish.waitForTimeout(600);
const other = await phish.evaluate(() => window.tryOther());
ok(other !== 'got credential', 'a different site cannot use the passkey', other);

await context.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
