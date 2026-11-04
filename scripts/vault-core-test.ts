// ============================================================================
// vault-core-test — encryption, 2FA codes, merging, importers, generator
// ============================================================================
//   node scripts/vault-core-test.ts        (npm run test:core)
// Needs Node 22.18+ (runs TypeScript directly).
// ============================================================================

import { webcrypto } from 'node:crypto';
import {
  createVaultKey, unlockVaultKey, rewrapVaultKey, encryptVaultJson, decryptWithKey, decryptWithPassword,
  headerOf, WrongPasswordError,
} from '../src/lib/vault-crypto.ts';
import { parseTotp, hotp, totpNow, base32Decode } from '../src/lib/totp.ts';
import { mergeVaults } from '../src/lib/vault-merge.ts';
import { parseCsv, importFromCsv, detectSource } from '../src/lib/importers.ts';

if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;

let failures = 0;
const ok = (cond: unknown, label: string, extra?: unknown) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 400) : ''}`);
  if (!cond) failures++;
};
const fast = { alg: 'argon2id' as const, salt: btoa('0123456789abcdef'), m: 1024, t: 1, p: 1 };

console.log('encryption');
{
  const vk = await createVaultKey('correct horse', { ...fast });
  const blob = await encryptVaultJson('{"hello":"world"}', vk);
  const parsed = JSON.parse(blob);
  ok(parsed.v === 2 && parsed.kdf.alg === 'argon2id', 'format 2 with Argon2id');
  ok(!blob.includes('hello'), 'nothing readable in the blob');
  const opened = await decryptWithPassword(blob, 'correct horse');
  ok(opened.json === '{"hello":"world"}' && !opened.upgraded, 'opens with the master password');
  ok(await decryptWithKey(blob, opened.vk) === '{"hello":"world"}', 'opens with the unlocked key');
  let wrong = false;
  try { await decryptWithPassword(blob, 'wrong'); } catch (e) { wrong = e instanceof WrongPasswordError; }
  ok(wrong, 'wrong password is refused');
  const header2 = await rewrapVaultKey('correct horse', 'new password!', headerOf(blob)!);
  const vk2 = await unlockVaultKey('new password!', header2);
  ok(await decryptWithKey(blob, vk2) === '{"hello":"world"}', 'after changing the master password the old data still opens');
  let oldRefused = false;
  try { await unlockVaultKey('correct horse', header2); } catch { oldRefused = true; }
  ok(oldRefused, 'the old master password no longer works');
  const tampered = JSON.parse(blob); tampered.data.ct = tampered.data.ct.replace(/^./, (c: string) => (c === 'A' ? 'B' : 'A'));
  let caught = false;
  try { await decryptWithKey(JSON.stringify(tampered), vk); } catch { caught = true; }
  ok(caught, 'a changed byte is detected');
  const iv1 = JSON.parse(await encryptVaultJson('x', vk)).data.iv, iv2 = JSON.parse(await encryptVaultJson('x', vk)).data.iv;
  ok(iv1 !== iv2, 'fresh IV every save');
  const real = await createVaultKey('pw');
  ok(real.header.kdf.alg === 'argon2id' && (real.header.kdf as any).m === 65536 && (real.header.kdf as any).t === 3, 'default: Argon2id 64 MiB, 3 passes');
}

console.log('format 1 (older vaults)');
{
  // Same steps as the old CryptoService.encrypt: PBKDF2 100k → AES-GCM, hex.
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const mat = await crypto.subtle.importKey('raw', new TextEncoder().encode('legacy pw'), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, mat, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('{"old":true}')));
  const v1 = { data: hex(ct), salt: hex(salt), iv: hex(iv), version: '1.0.0' };
  const opened = await decryptWithPassword(JSON.stringify(v1), 'legacy pw');
  ok(opened.json === '{"old":true}' && opened.upgraded, 'old vault opens and is marked for upgrade');
  ok((await decryptWithPassword(await encryptVaultJson(opened.json, opened.vk), 'legacy pw')).json === '{"old":true}', 'upgraded copy opens with the same password');
}

console.log('2FA codes (RFC 6238 test vectors)');
{
  const ascii = (s: string) => new TextEncoder().encode(s);
  const vectors: [number, string, 'SHA-1' | 'SHA-256' | 'SHA-512', string][] = [
    [59, '12345678901234567890', 'SHA-1', '94287082'],
    [1111111109, '12345678901234567890', 'SHA-1', '07081804'],
    [2000000000, '12345678901234567890', 'SHA-1', '69279037'],
    [59, '12345678901234567890123456789012', 'SHA-256', '46119246'],
    [1234567890, '12345678901234567890123456789012', 'SHA-256', '91819424'],
    [59, '1234567890123456789012345678901234567890123456789012345678901234', 'SHA-512', '90693936'],
    [20000000000, '1234567890123456789012345678901234567890123456789012345678901234', 'SHA-512', '47863826'],
  ];
  for (const [t, secret, algorithm, want] of vectors) {
    const got = await hotp({ secret: ascii(secret), algorithm, digits: 8 }, Math.floor(t / 30));
    ok(got === want, `${algorithm} at ${t} → ${want}`, got);
  }
  ok(Buffer.from(base32Decode('JBSWY3DPEHPK3PXP')).toString() === 'Hello!Þ­¾ï'.slice(0, 6) || base32Decode('JBSWY3DPEHPK3PXP').length === 10, 'base32 decodes');
  const cfg = parseTotp('otpauth://totp/GitHub:helio%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30');
  ok(cfg?.issuer === 'GitHub' && cfg.account === 'helio@example.com' && cfg.digits === 6, 'otpauth link: issuer, account, digits');
  ok(parseTotp('jbsw y3dp ehpk 3pxp')?.secret.length === 10, 'bare secret with spaces, lower case');
  ok(parseTotp('not a secret!') === null && parseTotp('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP') === null, 'junk and HOTP links are refused');
  const now = await totpNow(cfg!, 59_000);
  ok(/^\d{6}$/.test(now.code) && now.remaining === 1, 'current code and seconds left');
}

console.log('merging devices');
{
  const d = (s: string) => new Date(s);
  const e = (id: string, at: string, website = id) => ({ id, type: 'login' as const, website, username: '', password: '', category: 'x', createdAt: d('2026-01-01'), updatedAt: d(at) });
  const base = { version: '2', createdAt: d('2026-01-01'), updatedAt: d('2026-01-01') };
  const phone = { ...base, entries: [e('a', '2026-03-01', 'A phone'), e('b', '2026-01-02'), e('p', '2026-03-05')], deleted: { c: '2026-03-02T00:00:00Z' } };
  const laptop = { ...base, entries: [e('a', '2026-02-01', 'A laptop'), e('b', '2026-03-03', 'B laptop'), e('c', '2026-01-02'), e('l', '2026-03-04')], deleted: {} };
  const m = mergeVaults(laptop, phone, d('2026-03-10').getTime());
  const by = Object.fromEntries(m.entries.map((x) => [x.id, x.website]));
  ok(by.a === 'A phone' && by.b === 'B laptop', 'newer edit of each item wins');
  ok(by.p && by.l, 'items added on either device are kept');
  ok(!('c' in by) && m.deleted?.c, 'item deleted on the phone stays deleted');
  const edited = mergeVaults({ ...laptop, entries: [e('c', '2026-03-09', 'C edited')] }, phone, d('2026-03-10').getTime());
  ok(edited.entries.some((x) => x.id === 'c'), 'edited after the deletion: kept');
  const old = mergeVaults(laptop, { ...phone, deleted: { z: '2025-01-01T00:00:00Z' } }, d('2026-03-10').getTime());
  ok(!old.deleted?.z, 'deletions older than 180 days are forgotten');
}

console.log('importing');
{
  const nord = [
    'name,url,additional_urls,username,password,note,cardholdername,cardnumber,cvc,pin,expirydate,zipcode,folder,full_name,phone_number,email,address1,address2,city,country,state,type,custom_fields',
    'Work,,,,,,,,,,,,,,,,,,,,,folder,',
    'GitHub,https://github.com,"[""https://gist.github.com""]",helio,"p,a""ss",,,,,,,,Work,,,,,,,,,password,"[{""label"":""Recovery"",""type"":""hidden"",""value"":""abc""}]"',
    'Bank card,,,,,"line one',
    'line two",Helio G,4111 1111 1111 1111,123,0000,09/2029,,,,,,,,,,,credit_card,',
    'Me,,,,,,,,,,,1000,,Helio Galhardo,+447700900000,h@x.com,1 Road,,Bath,GB,,identity,',
    'Wi-Fi notes,,,,,router is in the hall,,,,,,,,,,,,,,,,note,',
  ].join('\r\n');
  const rows = parseCsv(nord);
  ok(rows.length === 6 && rows[3][5] === 'line one\r\nline two'.replace('\r\n', '\r\n'), 'CSV: line breaks and quotes inside fields', rows[3]?.[5]);
  ok(detectSource(rows[0]) === 'NordPass', 'NordPass export recognised');
  const r = importFromCsv(rows, []);
  const gh = r.items.find((i) => i.website === 'GitHub')!;
  ok(r.items.length === 4 && r.skipped === 1, '4 items, folder row skipped', { n: r.items.length, s: r.skipped });
  ok(gh.password === 'p,a"ss' && gh.urls?.[0] === 'https://gist.github.com' && gh.category === 'Work', 'login: password, extra URL, folder');
  ok(gh.fields?.[0].label === 'Recovery' && gh.fields[0].hidden, 'custom hidden field');
  const card = r.items.find((i) => i.type === 'card')!;
  ok(card.card?.number === '4111111111111111' && card.card.expiry === '09/29' && card.card.pin === '0000', 'card: number, expiry, PIN');
  ok(card.notes?.includes('line two'), 'card: multi-line note');
  const id = r.items.find((i) => i.type === 'identity')!;
  ok(id.identity?.fullName === 'Helio Galhardo' && id.identity.city === 'Bath', 'identity');
  ok(r.items.some((i) => i.type === 'note' && i.notes === 'router is in the hall'), 'secure note');
  const again = importFromCsv(rows, r.items.map((x, i) => ({ ...x, id: String(i), createdAt: new Date(), updatedAt: new Date() })));
  ok(again.items.length === 0 && again.duplicates === 4, 'importing twice adds nothing');

  const bw = parseCsv('folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\nPersonal,1,login,Google,,,0,https://accounts.google.com,me@gmail.com,pw,otpauth://totp/G?secret=JBSWY3DPEHPK3PXP');
  const b = importFromCsv(bw, []);
  ok(b.source === 'Bitwarden' && b.items[0].totp?.startsWith('otpauth') && b.items[0].isFavorite, 'Bitwarden with 2FA secret');
  const chrome = importFromCsv(parseCsv('name,url,username,password,note\nexample.com,https://example.com/login,u,p,'), []);
  ok(chrome.source === 'Chrome' && chrome.items[0].url === 'https://example.com/login', 'Chrome passwords export');
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
