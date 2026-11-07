/** Base64, hex and UTF-8 helpers that work the same in Hermes and Node. */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

export function toB64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}==`;
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}${B64[(n >> 6) & 63]}=`;
  }
  return out;
}

export function fromB64(b64: string): Uint8Array {
  const clean = b64.replace(/[\s=]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let o = 0;
  for (const ch of clean) {
    const v = B64_INDEX.get(ch);
    if (v === undefined) throw new Error('Not valid base64');
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (value >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** UTF-8 by hand: not every Hermes build has TextDecoder. */
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function fromUtf8(b: Uint8Array): string {
  let out = '';
  let chunk: number[] = [];
  const flush = () => { out += String.fromCharCode(...chunk); chunk = []; };
  for (let i = 0; i < b.length;) {
    const x = b[i];
    let c: number;
    if (x < 0x80) { c = x; i += 1; }
    else if (x >= 0xf0) { c = ((x & 7) << 18) | ((b[i + 1] & 63) << 12) | ((b[i + 2] & 63) << 6) | (b[i + 3] & 63); i += 4; }
    else if (x >= 0xe0) { c = ((x & 15) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63); i += 3; }
    else { c = ((x & 31) << 6) | (b[i + 1] & 63); i += 2; }
    if (c >= 0x10000) { c -= 0x10000; chunk.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023)); } else chunk.push(c);
    if (chunk.length > 8000) flush();
  }
  flush();
  return out;
}

export function wipe(b: Uint8Array | null | undefined): void {
  if (b) b.fill(0);
}
