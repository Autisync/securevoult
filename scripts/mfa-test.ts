// ============================================================================
// mfa-test — two-step sign-in on the server: codes, replay, backup codes, proof
//   node scripts/mfa-test.ts        (npm run test:mfa)
// ============================================================================
process.env.SECUREVOULT_SERVER_SECRET = 'test-secret-test-secret-test-secret-42';
const m = await import('../src/lib/mfa.ts');
const { parseTotp, totpNow } = await import('../src/lib/totp.ts');

let failures = 0;
const ok = (c: unknown, l: string, x?: unknown) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${!c && x !== undefined ? '  ' + JSON.stringify(x) : ''}`); if (!c) failures++; };

console.log('codes');
const secret = m.newTotpSecret();
ok(/^[A-Z2-7]{32}$/.test(secret), '160-bit base32 secret', secret);
const now = Date.UTC(2026, 10, 4, 12, 0, 15);
const step = Math.floor(now / 30000);
const code = m.totpAt(secret, step);
const appCode = (await totpNow(parseTotp(secret)!, now)).code;
ok(code === appCode, 'server and authenticator-app maths agree', { code, appCode });
ok(m.checkTotp(secret, code, null, now) === step, 'current code accepted');
ok(m.checkTotp(secret, m.totpAt(secret, step - 1), null, now) === step - 1, 'previous 30 s accepted (clock drift)');
ok(m.checkTotp(secret, m.totpAt(secret, step - 3), null, now) === null, 'old code refused');
ok(m.checkTotp(secret, code, step, now) === null, 'same code twice refused (replay)');
ok(m.checkTotp(secret, '12345', null, now) === null && m.checkTotp(secret, 'abcdef', null, now) === null, 'malformed refused');
ok(m.otpauthUri(secret, 'a@b.com').startsWith('otpauth://totp/SecureVoult%3Aa%40b.com?secret='), 'otpauth link for the QR code');

console.log('secrets at rest');
const sealed = m.sealSecret(secret);
ok(!sealed.includes(secret) && m.openSecret(sealed) === secret, 'stored encrypted, opens back');
let tampered = false; try { m.openSecret(sealed.slice(0, -2) + 'AA'); } catch { tampered = true; }
ok(tampered, 'tampering detected');

console.log('backup codes');
const b = m.newBackupCodes();
ok(b.plain.length === 10 && new Set(b.plain).size === 10 && b.plain.every((c) => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(c)), '10 distinct codes');
ok(!b.hashed.some((h) => b.plain.includes(h)), 'only hashes stored');
ok(m.matchBackupCode(b.plain[3].toLowerCase().replace('-', ' '), b.hashed) === 3, 'typed loosely still matches');
ok(m.matchBackupCode('AAAAA-AAAAA', b.hashed) === -1, 'unknown code refused');

console.log('proof of second step');
const t = m.issueMfaToken('uid1', 1000, now);
ok(m.checkMfaToken(t, 'uid1', 1000, now + 1000), 'valid for this sign-in');
ok(!m.checkMfaToken(t, 'uid1', 2000, now), 'a new sign-in needs a new code');
ok(!m.checkMfaToken(t, 'uid2', 1000, now), 'not usable by another account');
ok(!m.checkMfaToken(t, 'uid1', 1000, now + m.MFA_TOKEN_TTL_MS + 1), 'expires after 30 days');
const [body, sig] = t.split('.');
const forged = Buffer.from(Buffer.from(body, 'base64url').toString().replace('uid1', 'uid9')).toString('base64url') + '.' + sig;
ok(!m.checkMfaToken(forged, 'uid9', 1000, now), 'forged token refused');
ok(!m.checkMfaToken(null, 'uid1', 1000, now) && !m.checkMfaToken(t, 'uid1', undefined, now), 'missing token or sign-in time refused');

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
