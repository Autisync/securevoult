// ============================================================================
// vault-sync-test — two devices, one server: saves, conflicts, offline
// ============================================================================
// Bundles src/lib/vault.ts with esbuild, swapping the sign-in and storage
// modules for in-memory stand-ins, and runs it against a fake /api/vault
// that behaves like the real route (compare-and-set on the version).
//
//   node scripts/vault-sync-test.mjs        (npm run test:sync)
// ============================================================================

import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(resolve(tmpdir(), 'sv-sync-'));

// Stand-ins: each "device" gets its own local storage via a global switch.
writeFileSync(resolve(out, 'auth-stub.ts'), `
export const getStoredSessionId = () => null;
export const AuthService = { getIdToken: async () => 'token', currentUid: () => 'user-1' };
`);
writeFileSync(resolve(out, 'storage-stub.ts'), `
const g = globalThis as any;
export const UniversalStorageService = {
  saveVault: async (v: unknown) => { g.__device.local = JSON.parse(JSON.stringify(v)); },
  loadVault: async () => g.__device.local ?? null,
  hasVault: async () => !!g.__device.local,
  clearVault: async () => { g.__device.local = null; },
};
`);

await build({
  entryPoints: [resolve(root, 'src/lib/vault.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: resolve(out, 'vault.mjs'), logLevel: 'error',
  plugins: [{
    name: 'stubs',
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: resolve(out, 'auth-stub.ts') }));
      b.onResolve({ filter: /^\.\/storage$/ }, () => ({ path: resolve(out, 'storage-stub.ts') }));
      b.onResolve({ filter: /^@\// }, (a) => ({ path: resolve(root, 'src', a.path.slice(2)) + (a.path.endsWith('.ts') ? '' : '.ts') }));
    },
  }],
});

const vc = await import(pathToFileURL(resolve(out, 'vault.mjs')).href);

// ── fake server ──────────────────────────────────────────────────────────────
const server = { doc: null, down: false, puts: 0 };
globalThis.fetch = async (url, init = {}) => {
  if (server.down) throw new TypeError('fetch failed');
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (init.method === 'GET') {
    return json(200, { success: true, vault: server.doc ? { encryptedData: server.doc.blob, version: server.doc.version } : { encryptedData: '', version: 0 } });
  }
  const body = JSON.parse(init.body);
  server.puts++;
  const current = server.doc?.version ?? 0;
  if (body.baseVersion !== current) return json(409, { error: true, serverVersion: current });
  server.doc = { blob: body.encryptedVault, version: current + 1 };
  return json(200, { success: true, version: current + 1 });
};

let failures = 0;
const ok = (cond, label, extra) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 300) : ''}`);
  if (!cond) failures++;
};
const laptop = { local: null }, phone = { local: null };
const on = (d) => { globalThis.__device = d; };
const names = (v) => v.entries.map((e) => e.website).sort().join(',');
const PW = 'master password 1';

console.log('create and unlock');
on(laptop);
let L = await vc.createVault(PW);
ok(server.doc?.version === 1 && L.serverVersion === 1, 'new vault lands on the server as version 1');
ok(JSON.parse(server.doc.blob).v === 2, 'server holds format 2 ciphertext only');
on(phone);
let P = await vc.openVault(PW);
ok(P.vault.entries.length === 0 && P.serverVersion === 1, 'second device opens it');
let wrong = '';
try { await vc.openVault('nope'); } catch (e) { wrong = e.name; }
ok(wrong === 'WrongPasswordError', 'wrong master password refused');

console.log('both devices edit at once');
on(laptop);
L = await vc.saveVault(vc.VaultService.addEntry(L.vault, { type: 'login', website: 'GitHub', username: 'h', password: '1', category: 'Work' }), L.key, L.serverVersion);
on(phone);
P = await vc.saveVault(vc.VaultService.addEntry(P.vault, { type: 'login', website: 'Bank', username: 'h', password: '2', category: 'Money' }), P.key, P.serverVersion);
ok(names(P.vault) === 'Bank,GitHub', 'phone save hit a conflict and merged the laptop\'s item', names(P.vault));
ok(server.doc.version === 3, 'server at version 3');
on(laptop);
const pulled = await vc.pullVault(L.vault, L.key, L.serverVersion);
ok(pulled && names(pulled.vault) === 'Bank,GitHub', 'laptop pulls the phone\'s item');
L = pulled;

console.log('delete on one, edit on the other');
const gh = L.vault.entries.find((e) => e.website === 'GitHub');
on(laptop);
L = await vc.saveVault(vc.VaultService.deleteEntry(L.vault, gh.id), L.key, L.serverVersion);
on(phone);
const bank = P.vault.entries.find((e) => e.website === 'Bank');
await new Promise((r) => setTimeout(r, 5));
P = await vc.saveVault(vc.VaultService.updateEntry(P.vault, bank.id, { password: '3' }), P.key, P.serverVersion);
ok(names(P.vault) === 'Bank', 'deleted item does not come back from the phone\'s older copy', names(P.vault));
ok(P.vault.entries[0].password === '3' && P.vault.entries[0].passwordHistory?.[0]?.password === '2', 'password change kept, old one in history');

console.log('offline');
server.down = true;
on(phone);
P = await vc.saveVault(vc.VaultService.addEntry(P.vault, { type: 'note', website: 'Offline note', username: '', password: '', category: 'x' }), P.key, P.serverVersion);
ok(P.offline && phone.local.dirty, 'saved on the device while offline');
let offlineOpen = await vc.openVault(PW);
ok(offlineOpen.offline && names(offlineOpen.vault).includes('Offline note'), 'unlocks offline from the device copy');
server.down = false;
on(laptop);
L = await vc.saveVault(vc.VaultService.addEntry(L.vault, { type: 'login', website: 'Laptop item', username: '', password: 'x', category: 'x' }), L.key, L.serverVersion);
on(phone);
P = await vc.openVault(PW);
ok(names(P.vault) === 'Bank,Laptop item,Offline note' && !phone.local.dirty, 'back online: unlock merges and uploads the offline change', names(P.vault));

console.log('master password changed on another device');
const { rewrapVaultKey } = await import(pathToFileURL(resolve(root, 'src/lib/vault-crypto.ts')).href);
on(laptop);
L = await vc.openVault(PW);
const newHeader = await rewrapVaultKey(PW, 'master password 2', L.key.header);
L = await vc.saveVault({ ...L.vault, updatedAt: new Date() }, { key: L.key.key, header: newHeader }, L.serverVersion);
on(phone);
P = await vc.saveVault(vc.VaultService.addEntry(P.vault, { type: 'login', website: 'After change', username: '', password: 'y', category: 'x' }), P.key, P.serverVersion);
let oldWorks = true;
try { on(laptop); await vc.openVault(PW); } catch { oldWorks = false; }
ok(!oldWorks, 'phone\'s save did not bring the old master password back');
on(laptop);
const reopened = await vc.openVault('master password 2');
ok(names(reopened.vault).includes('After change'), 'new master password opens everything');

console.log('backup');
const backup = await vc.exportBackup(reopened.vault, reopened.key);
const restored = await vc.readBackup(backup, 'master password 2');
ok(restored.entries.length === reopened.vault.entries.length, 'backup restores with the master password');
let badBackup = false;
try { await vc.readBackup(backup, 'wrong'); } catch { badBackup = true; }
ok(badBackup, 'backup refuses the wrong password');

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
