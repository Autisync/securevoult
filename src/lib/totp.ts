/**
 * 2FA codes (TOTP, RFC 6238) for vault items.
 *
 * An item stores either a bare base32 secret ("JBSWY3DPEHPK3PXP") or the
 * full otpauth:// link a QR code contains. Both are accepted everywhere.
 */

export interface TotpConfig {
  secret: Uint8Array;
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512';
  digits: number;
  period: number;
  issuer?: string;
  account?: string;
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error('Not a valid 2FA secret');
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

/** Reads a stored secret or otpauth link. Returns null when it isn't usable. */
export function parseTotp(stored: string | undefined | null): TotpConfig | null {
  const s = (stored ?? '').trim();
  if (!s) return null;
  try {
    if (/^otpauth:\/\//i.test(s)) {
      // Parsed by hand: browsers disagree on host/path for non-web URL schemes.
      const m = s.match(/^otpauth:\/\/([^/?#]+)\/?([^?#]*)\??([^#]*)/i);
      if (!m || m[1].toLowerCase() !== 'totp') return null;
      const q = new URLSearchParams(m[3]);
      const label = decodeURIComponent(m[2]);
      const colon = label.indexOf(':');
      const [labelIssuer, account] = colon >= 0 ? [label.slice(0, colon), label.slice(colon + 1)] : [undefined, label];
      const algo = (q.get('algorithm') ?? 'SHA1').toUpperCase().replace('-', '');
      return {
        secret: base32Decode(q.get('secret') ?? ''),
        algorithm: algo === 'SHA256' ? 'SHA-256' : algo === 'SHA512' ? 'SHA-512' : 'SHA-1',
        digits: clampInt(q.get('digits'), 6, 6, 10),
        period: clampInt(q.get('period'), 30, 1, 300),
        issuer: q.get('issuer') ?? labelIssuer ?? undefined,
        account: account?.trim() || undefined,
      };
    }
    return { secret: base32Decode(s), algorithm: 'SHA-1', digits: 6, period: 30 };
  } catch {
    return null;
  }
}

function clampInt(v: string | null, dflt: number, min: number, max: number): number {
  const n = v == null ? dflt : parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

export async function hotp(cfg: Pick<TotpConfig, 'secret' | 'algorithm' | 'digits'>, counter: number): Promise<string> {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey('raw', cfg.secret, { name: 'HMAC', hash: cfg.algorithm }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** cfg.digits).padStart(cfg.digits, '0');
}

/** The current code and how many seconds it stays valid. */
export async function totpNow(cfg: TotpConfig, nowMs = Date.now()): Promise<{ code: string; remaining: number }> {
  const t = Math.floor(nowMs / 1000);
  const code = await hotp(cfg, Math.floor(t / cfg.period));
  return { code, remaining: cfg.period - (t % cfg.period) };
}

/** "123456" → "123 456" for reading; copy the plain code. */
export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}
