// ============================================================================
// extension-e2e — the built extension in a real Chromium
// ============================================================================
// Loads extension-package/, puts an encrypted vault and an unlocked session in
// place (as the popup would), then on a fake https site checks: the menu,
// filling, refusing other sites, 2FA fields, and saving a new login.
//
//   npm run extension:build && node scripts/extension-e2e.mjs
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
const { parseTotp, totpNow } = await import(pathToFileURL(resolve(root, 'src/lib/totp.ts')).href);

let failures = 0;
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 300) : ''}`);
  if (!cond) failures++;
};

// A vault with two logins, encrypted exactly as the app does.
vc.allowKeyExport();
const vk = await vc.createVaultKey('master', { alg: 'argon2id', salt: btoa('0123456789abcdef'), m: 1024, t: 1, p: 1 });
const now = new Date().toISOString();
const SECRET = 'JBSWY3DPEHPK3PXP';
const vault = {
  version: '2.0.0', createdAt: now, updatedAt: now, deleted: {},
  entries: [
    { id: 'e1', type: 'login', website: 'Example', url: 'https://login.example.test/', username: 'helio@example.test', password: 'S3cret!pw', totp: SECRET, category: 'Work', createdAt: now, updatedAt: now },
    { id: 'e2', type: 'login', website: 'Other site', url: 'https://other.test/', username: 'x', password: 'other-pw', category: 'Work', createdAt: now, updatedAt: now },
  ],
};
const blob = await vc.encryptVaultJson(JSON.stringify(vault), vk);
const rawKey = await vc.exportRawKey(vk);

const LOGIN = `<!doctype html><html><body>
  <form id="f" action="/after" method="post">
    <input id="user" name="email" type="email" autocomplete="username" style="width:260px">
    <input id="pw" name="password" type="password" autocomplete="current-password" style="width:260px">
    <button id="go" type="submit">Sign in</button>
  </form>
  <iframe id="ad" src="https://ads.evil.test/frame" style="width:300px;height:120px"></iframe>
</body></html>`;
const AD = `<!doctype html><html><body><input id="adpw" type="password"></body></html>`;
const OTP = `<!doctype html><html><body><input id="code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" style="width:200px"></body></html>`;

const context = await chromium.launchPersistentContext(mkdtempSync(resolve(tmpdir(), 'sv-ext-')), {
  headless: true, channel: 'chromium',
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  ignoreHTTPSErrors: true,
});
await context.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === 'login.example.test' && u.pathname === '/otp') return route.fulfill({ contentType: 'text/html', body: OTP });
  if (u.hostname === 'login.example.test') return route.fulfill({ contentType: 'text/html', body: route.request().method() === 'POST' ? '<p>Welcome</p>' : LOGIN });
  if (u.hostname === 'ads.evil.test') return route.fulfill({ contentType: 'text/html', body: AD });
  if (u.hostname === 'phish.test') return route.fulfill({ contentType: 'text/html', body: LOGIN });
  return route.fulfill({ status: 404, body: '' });
});

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker');
ok(!!worker, 'background worker starts');

console.log('locked');
const page = await context.newPage();
await page.goto('https://login.example.test/');
const locked = await worker.evaluate(() => chrome.storage.session.get('sv_session'));
ok(!locked.sv_session, 'no key kept before unlocking');

console.log('unlocked (as the popup leaves it)');
await worker.evaluate(async ({ blob, rawKey, header }) => {
  await chrome.storage.local.set({ securevoult_encrypted_vault: { blob, serverVersion: 1, dirty: false, uid: null } });
  await chrome.storage.session.set({ sv_session: { key: rawKey, header, autoLockMinutes: 15 } });
}, { blob, rawKey, header: vk.header });
const alarmsBefore = await worker.evaluate(() => chrome.alarms.getAll());

await page.reload();
await page.click('#user');
await page.waitForTimeout(600);
const box = await page.locator('#user').boundingBox();
await page.screenshot({ path: resolve(root, 'scripts/.e2e-menu.png') });
// Menu sits 4px under the field: header (~26px), then the first login.
await page.mouse.click(box.x + 40, box.y + box.height + 4 + 26 + 18);
await page.waitForTimeout(400);
ok(await page.inputValue('#user') === 'helio@example.test', 'picking from the menu fills the username', await page.inputValue('#user'));
ok(await page.inputValue('#pw') === 'S3cret!pw', 'and the password');
const ad = page.frameLocator('#ad');
ok(await ad.locator('#adpw').inputValue() === '', 'the third-party frame got nothing');
ok((await worker.evaluate(() => chrome.alarms.getAll())).some((a) => a.name === 'sv-autolock'), 'auto-lock timer running', alarmsBefore);

console.log('other sites');
const phish = await context.newPage();
await phish.goto('https://phish.test/');
const res = await phish.evaluate(() => new Promise((r) => {
  // A page can't talk to the extension; only its content script can. Ask that script's world indirectly:
  r(document.querySelector('sv-securevoult') ? 'ui-present' : 'none');
}));
await phish.click('#user');
await phish.waitForTimeout(600);
const pbox = await phish.locator('#user').boundingBox();
await phish.mouse.click(pbox.x + 40, pbox.y + pbox.height + 4 + 26 + 18);
await phish.waitForTimeout(300);
ok(await phish.inputValue('#pw') === '' && await phish.inputValue('#user') === '', 'a different site gets no menu and no fill', res);

console.log('2FA code field');
const otp = await context.newPage();
await otp.goto('https://login.example.test/otp');
await otp.click('#code');
await otp.waitForTimeout(600);
const obox = await otp.locator('#code').boundingBox();
await otp.mouse.click(obox.x + 40, obox.y + obox.height + 4 + 26 + 18);
await otp.waitForTimeout(300);
const want = (await totpNow(parseTotp(SECRET))).code;
const got = await otp.inputValue('#code');
ok(got === want || got === (await totpNow(parseTotp(SECRET), Date.now() - 30000)).code, 'current 2FA code filled', { got, want });

console.log('saving a new login');
await page.fill('#user', 'second@example.test');
await page.fill('#pw', 'Brand-new-pw-1');
await page.click('#go');
await page.waitForTimeout(1200);
await page.screenshot({ path: resolve(root, 'scripts/.e2e-save.png') });
// Prompt card: top-right, 320px wide; "Save" is the right-hand button at its bottom.
const vp = page.viewportSize();
const card = { right: vp.width - 18, top: 18 };
await page.mouse.click(card.right - 70, card.top + 100);
await page.waitForTimeout(1500);
const stored = await worker.evaluate(() => chrome.storage.local.get('securevoult_encrypted_vault'));
const copy = stored.securevoult_encrypted_vault;
const after = JSON.parse(await vc.decryptWithKey(copy.blob, vk));
ok(after.entries.some((e) => e.username === 'second@example.test' && e.password === 'Brand-new-pw-1'), 'new login saved into the encrypted vault', after.entries.map((e) => e.username));
ok(copy.dirty === true, 'marked for upload (no server in this test)');

console.log('lock');
await worker.evaluate(() => chrome.alarms.create('sv-autolock', { when: Date.now() + 10 }));
await page.waitForTimeout(1500);
const gone = await worker.evaluate(() => chrome.storage.session.get('sv_session'));
ok(!gone.sv_session, 'auto-lock forgets the key');

await context.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
