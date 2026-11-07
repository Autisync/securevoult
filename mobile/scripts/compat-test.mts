/**
 * Proves the phone app reads and writes exactly the same vault as the web app:
 * runs the web code (../src/lib) and the phone core (src/core) against each other.
 * libsodium-wrappers-sumo stands in for the native libsodium the phone uses.
 *
 *   npm run test:compat
 */
import assert from 'node:assert/strict';
import { randomBytes as nodeRandom } from 'node:crypto';
import _sodium from 'libsodium-wrappers-sumo';
import * as web from '../../src/lib/vault-crypto.ts';
import * as mob from '../src/core/vault-crypto.ts';
import { totpNow, parseTotp } from '../src/core/totp.ts';
import * as webTotp from '../../src/lib/totp.ts';

await _sodium.ready;
const sodium = _sodium;
mob.setCryptoProviders({
  argon2id: (pw, salt, t, mKiB, p) => {
    assert.equal(p, 1, 'libsodium Argon2id runs with one lane');
    return sodium.crypto_pwhash(32, pw, salt, t, mKiB * 1024, sodium.crypto_pwhash_ALG_ARGON2ID13);
  },
  randomBytes: (n) => new Uint8Array(nodeRandom(n)),
});

const pw = 'Correct horse ✓ çãé battery';
const json = JSON.stringify({ entries: [{ id: '1', website: 'Example', username: 'a@b.c', password: 'p@ss', type: 'login' }], version: '1' });

// 1. Web makes a vault (with Recovery Kit), phone opens it.
const { vk: wvk, recoveryKey } = await web.createVaultKeyWithRecovery(pw);
const webBlob = await web.encryptVaultJson(json, wvk);
const opened = await mob.decryptWithPassword(webBlob, pw);
assert.equal(opened.json, json); assert.equal(opened.upgraded, false);
console.log('web → phone: ok');

// 2. Phone re-saves with the same key; web opens it with the password and with its key.
const phoneBlob = mob.encryptVaultJson(json.replace('p@ss', 'n3w'), opened.vk);
assert.equal((await web.decryptWithPassword(phoneBlob, pw)).json, json.replace('p@ss', 'n3w'));
assert.equal(await web.decryptWithKey(phoneBlob, wvk), json.replace('p@ss', 'n3w'));
console.log('phone → web: ok');

// 3. Wrong password is reported as such.
await assert.rejects(mob.decryptWithPassword(webBlob, 'nope'), mob.WrongPasswordError);
console.log('wrong password: ok');

// 4. Phone-created vault (with recovery) opens on the web, recovery key works there.
const { vk: pvk, recoveryKey: prk } = await mob.createVaultKeyWithRecovery(pw);
const pBlob = mob.encryptVaultJson(json, pvk);
assert.equal((await web.decryptWithPassword(pBlob, pw)).json, json);
const rec = await web.recoverVaultKey(prk, 'another pw', web.headerOf(pBlob)!);
assert.equal(await web.decryptWithKey(pBlob, rec.vk), json);
console.log('phone vault + recovery on web: ok', recoveryKey.length);

// 5. Format 1 (PBKDF2) vaults open on the phone and upgrade.
const salt = nodeRandom(16), iv = nodeRandom(12);
const { pbkdf2Sync, createCipheriv } = await import('node:crypto');
const k1 = pbkdf2Sync(pw, salt, 100000, 32, 'sha256');
const c = createCipheriv('aes-256-gcm', k1, iv); const ct = Buffer.concat([c.update(json), c.final(), c.getAuthTag()]);
const v1 = JSON.stringify({ data: ct.toString('hex'), salt: salt.toString('hex'), iv: iv.toString('hex') });
const up = await mob.decryptWithPassword(v1, pw);
assert.equal(up.json, json); assert.equal(up.upgraded, true);
assert.equal((await web.decryptWithPassword(mob.encryptVaultJson(json, up.vk), pw)).json, json);
console.log('format 1 upgrade: ok');

// 6. TOTP matches the web implementation.
for (const s of ['JBSWY3DPEHPK3PXP', 'otpauth://totp/ACME:jo@x.com?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&period=60&issuer=ACME']) {
  const t = 1_790_000_000_000;
  assert.equal(totpNow(parseTotp(s)!, t).code, (await webTotp.totpNow(webTotp.parseTotp(s)!, t)).code);
}
console.log('totp: ok');
