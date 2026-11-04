/**
 * Two-step sign-in (authenticator app), checked by SecureVoult's own server.
 *
 * After a Firebase sign-in, an account with 2FA on must also enter the
 * 6-digit code before the server hands out the (encrypted) vault. A correct
 * code earns a token tied to that sign-in (Firebase `auth_time`), so a new
 * sign-in anywhere asks again, while refreshing the ID token doesn't.
 *
 * Server-side only. Secrets at rest are AES-256-GCM encrypted with a key from
 * SECUREVOULT_SERVER_SECRET (or, if unset, derived from the Firebase Admin key).
 */
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const MFA_TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;
export const BACKUP_CODE_COUNT = 10;

let cachedKey: Buffer | null = null;
let warned = false;

function serverKey(purpose: string): Buffer {
  if (!cachedKey) {
    const configured = process.env.SECUREVOULT_SERVER_SECRET?.trim();
    if (configured && configured.length >= 32) {
      cachedKey = Buffer.from(configured);
    } else {
      const fallback = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      if (!fallback) throw new Error('SECUREVOULT_SERVER_SECRET is not set');
      if (!warned) { console.warn('[mfa] SECUREVOULT_SERVER_SECRET not set; deriving from the Firebase Admin key'); warned = true; }
      cachedKey = Buffer.from(fallback);
    }
  }
  return Buffer.from(crypto.hkdfSync('sha256', cachedKey, Buffer.from('securevoult'), Buffer.from(purpose), 32));
}

// ── secrets at rest ──────────────────────────────────────────────────────────

export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', serverKey('mfa-secret'), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), ct.toString('base64url'), c.getAuthTag().toString('base64url')].join('.');
}

export function openSecret(sealed: string): string {
  const [v, iv, ct, tag] = sealed.split('.');
  if (v !== 'v1') throw new Error('Unknown secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', serverKey('mfa-secret'), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

// ── TOTP (RFC 6238, SHA-1, 6 digits, 30 s — what every authenticator app does) ──

export function newTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32ToBuffer(s: string): Buffer {
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

export function totpAt(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', base32ToBuffer(secret)).update(msg).digest();
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

/**
 * Checks a code against the current 30-second step and one either side
 * (phone clocks drift). Returns the step used, so the caller can refuse the
 * same code twice; null when it doesn't match or was already used.
 */
export function checkTotp(secret: string, code: string, lastUsedStep: number | null | undefined, now = Date.now()): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const step = Math.floor(now / 30_000);
  for (const s of [step, step - 1, step + 1]) {
    if (lastUsedStep != null && s <= lastUsedStep) continue;
    if (crypto.timingSafeEqual(Buffer.from(totpAt(secret, s)), Buffer.from(clean))) return s;
  }
  return null;
}

export function otpauthUri(secret: string, email: string): string {
  const label = encodeURIComponent(`SecureVoult:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=SecureVoult&algorithm=SHA1&digits=6&period=30`;
}

// ── backup codes ─────────────────────────────────────────────────────────────

const hashCode = (c: string) => crypto.createHmac('sha256', serverKey('backup-code')).update(c.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

export function newBackupCodes(): { plain: string[]; hashed: string[] } {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const b = crypto.randomBytes(10);
    const s = Array.from(b, (x) => alphabet[x & 31]).join('');
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { plain, hashed: plain.map(hashCode) };
}

/** Index of the matching unused backup code, or -1. */
export function matchBackupCode(code: string, hashed: string[]): number {
  const h = hashCode(code);
  return hashed.findIndex((x) => x.length === h.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(h)));
}

// ── proof that this sign-in passed the second step ───────────────────────────

export function issueMfaToken(uid: string, authTime: number, now = Date.now()): string {
  const body = `${uid}.${authTime}.${now + MFA_TOKEN_TTL_MS}`;
  const sig = crypto.createHmac('sha256', serverKey('mfa-token')).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}

export function checkMfaToken(token: string | null | undefined, uid: string, authTime: number | undefined, now = Date.now()): boolean {
  if (!token || !authTime) return false;
  const [b, sig] = token.split('.');
  if (!b || !sig) return false;
  const body = Buffer.from(b, 'base64url').toString();
  const want = crypto.createHmac('sha256', serverKey('mfa-token')).update(body).digest('base64url');
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return false;
  const [tUid, tAuth, tExp] = body.split('.');
  return tUid === uid && Number(tAuth) === authTime && Number(tExp) > now;
}
