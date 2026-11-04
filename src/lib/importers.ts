/**
 * Importing from other password managers' CSV exports.
 *
 * Recognised by their header row: NordPass, Bitwarden, 1Password, LastPass,
 * Chrome/Edge/Brave, Firefox, Proton Pass, Dashlane. Anything else uses the
 * column mapping chosen on screen (or a best guess).
 *
 * Items already in the vault (same site, username and password) are skipped.
 */
import type { CustomField, PasswordEntry, VaultItemType } from '@/types/vault';
import type { NewEntry } from './vault';

/** RFC 4180: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let col = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { col += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else col += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(col); col = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(col); col = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else col += ch;
  }
  row.push(col);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export type CsvSource =
  | 'NordPass' | 'Bitwarden' | 'LastPass' | '1Password' | 'Chrome' | 'Firefox' | 'Proton Pass' | 'Dashlane' | 'SecureVoult' | 'CSV';

const has = (h: string[], ...cols: string[]) => cols.every((c) => h.includes(c));

export function detectSource(headers: string[]): CsvSource {
  const h = headers.map((x) => x.trim().toLowerCase());
  if (has(h, 'name', 'url', 'username', 'password', 'note', 'cardholdername', 'type') || has(h, 'additional_urls', 'cardnumber')) return 'NordPass';
  if (has(h, 'login_uri', 'login_username', 'login_password')) return 'Bitwarden';
  if (has(h, 'url', 'username', 'password', 'extra', 'name', 'grouping')) return 'LastPass';
  if (has(h, 'httprealm', 'formactionorigin')) return 'Firefox';
  if (has(h, 'name', 'url', 'username', 'password') && h.length <= 6 && h.includes('note')) return 'Chrome';
  if (has(h, 'name', 'url', 'username', 'password') && h.length === 4) return 'Chrome';
  if (has(h, 'title', 'website', 'username', 'password', 'otpauth')) return '1Password';
  if (has(h, 'title', 'url', 'username', 'password', 'otpurl')) return '1Password';
  if (has(h, 'type', 'name', 'url', 'email', 'username', 'password', 'note', 'totp', 'vault')) return 'Proton Pass';
  if (has(h, 'username', 'title', 'password', 'note', 'url', 'category', 'otpsecret')) return 'Dashlane';
  if (has(h, 'name', 'url', 'username', 'password', 'totp', 'notes', 'category', 'type')) return 'SecureVoult';
  return 'CSV';
}

type Row = Record<string, string>;

const jsonArray = <T,>(s: string | undefined): T[] => {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
};

function base(name: string, type: VaultItemType): NewEntry {
  return { type, website: name || 'Untitled', username: '', password: '', category: 'Imported' };
}

function cleanUrl(u: string | undefined): string | undefined {
  const s = (u ?? '').trim();
  if (!s || s === 'http://' || s === 'https://') return undefined;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
}

function siteName(url: string | undefined): string {
  try { return new URL(url!).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** "MM/YY", "MM/YYYY", "YYYY-MM" → "MM/YY". */
function expiry(s: string | undefined): string | undefined {
  const v = (s ?? '').trim();
  if (!v) return undefined;
  let m = v.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].slice(-2)}`;
  m = v.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[2].padStart(2, '0')}/${m[1].slice(-2)}`;
  return v;
}

function nordPass(r: Row): NewEntry | null {
  const kind = (r.type ?? '').toLowerCase();
  const fields: CustomField[] = jsonArray<{ label: string; type: string; value: string }>(r.custom_fields)
    .filter((f) => f && f.label)
    .map((f) => ({ label: f.label, value: f.value ?? '', hidden: f.type === 'hidden' }));
  const common = { notes: r.note || undefined, category: r.folder || 'Imported', ...(fields.length ? { fields } : {}) };
  const totp = r.totp || r.otp || r['2fa'] || undefined;

  if (kind === 'password' || kind === 'login' || (!kind && (r.password || r.username))) {
    const urls = jsonArray<string>(r.additional_urls).map(cleanUrl).filter(Boolean) as string[];
    const url = cleanUrl(r.url);
    return { ...base(r.name || siteName(url), 'login'), ...common, url, ...(urls.length ? { urls } : {}), username: r.username || r.email || '', password: r.password || '', ...(totp ? { totp } : {}) };
  }
  if (kind === 'credit_card') {
    return { ...base(r.name || 'Card', 'card'), ...common, card: { holder: r.cardholdername || undefined, number: r.cardnumber?.replace(/\s/g, '') || undefined, cvv: r.cvc || undefined, pin: r.pin || undefined, expiry: expiry(r.expirydate), postcode: r.zipcode || undefined } };
  }
  if (kind === 'identity') {
    return { ...base(r.name || r.full_name || 'Identity', 'identity'), ...common, identity: { fullName: r.full_name || undefined, email: r.email || undefined, phone: r.phone_number || undefined, address1: r.address1 || undefined, address2: r.address2 || undefined, city: r.city || undefined, state: r.state || undefined, postcode: r.zipcode || undefined, country: r.country || undefined } };
  }
  if (kind === 'note') return { ...base(r.name || 'Note', 'note'), ...common };
  return null; // folders and anything unknown
}

function bitwarden(r: Row): NewEntry | null {
  const kind = (r.type ?? 'login').toLowerCase();
  const fields: CustomField[] = (r.fields ?? '').split('\n').filter(Boolean).map((line) => {
    const i = line.indexOf(': ');
    return i > 0 ? { label: line.slice(0, i), value: line.slice(i + 2) } : { label: 'Field', value: line };
  });
  const common = { notes: r.notes || undefined, category: r.folder || 'Imported', ...(fields.length ? { fields } : {}), ...(r.favorite === '1' ? { isFavorite: true } : {}) };
  if (kind === 'note') return { ...base(r.name, 'note'), ...common };
  if (kind !== 'login') return null;
  const uris = (r.login_uri ?? '').split(',').map(cleanUrl).filter(Boolean) as string[];
  return { ...base(r.name || siteName(uris[0]), 'login'), ...common, url: uris[0], ...(uris.length > 1 ? { urls: uris.slice(1) } : {}), username: r.login_username || '', password: r.login_password || '', ...(r.login_totp ? { totp: r.login_totp } : {}) };
}

function lastPass(r: Row): NewEntry | null {
  const url = r.url === 'http://sn' ? undefined : cleanUrl(r.url);
  if (r.url === 'http://sn') return { ...base(r.name, 'note'), notes: r.extra || undefined, category: r.grouping || 'Imported' };
  return { ...base(r.name || siteName(url), 'login'), url, username: r.username || '', password: r.password || '', notes: r.extra || undefined, category: r.grouping || 'Imported', ...(r.totp ? { totp: r.totp } : {}), ...(r.fav === '1' ? { isFavorite: true } : {}) };
}

function generic(r: Row, cols: { name: string; url: string; username: string; password: string; notes: string; totp: string; category: string; type: string }): NewEntry | null {
  const url = cleanUrl(r[cols.url]);
  const name = (r[cols.name] || siteName(url)).trim();
  const username = r[cols.username] ?? '';
  const password = r[cols.password] ?? '';
  if (!name && !username && !password) return null;
  const t = (r[cols.type] ?? '').toLowerCase();
  const type: VaultItemType = (['login', 'note', 'card', 'identity', 'wifi', 'bank'] as const).find((x) => x === t) ?? 'login';
  return { ...base(name, type), url, username, password, notes: r[cols.notes] || undefined, category: r[cols.category] || 'Imported', ...(r[cols.totp] ? { totp: r[cols.totp] } : {}) };
}

const fp = (e: Pick<PasswordEntry, 'type' | 'website' | 'url' | 'username' | 'password' | 'notes'>) =>
  [e.type ?? 'login', (siteName(e.url) || e.website || '').toLowerCase(), e.username ?? '', e.password ?? '', e.type === 'note' ? e.notes ?? '' : ''].join('\u0000');

export interface CsvImportResult { items: NewEntry[]; skipped: number; duplicates: number; source: CsvSource }

/**
 * @param mapping only used for an unrecognised CSV: column index for website/url/username/password/notes.
 */
export function importFromCsv(rows: string[][], existing: PasswordEntry[], mapping?: Record<string, number | null>): CsvImportResult {
  if (rows.length < 2) throw new Error('The file is empty or not a CSV');
  const headers = rows[0].map((h) => h.trim());
  const lower = headers.map((h) => h.toLowerCase());
  const source = detectSource(headers);
  const records: Row[] = rows.slice(1).map((cells) => Object.fromEntries(lower.map((h, i) => [h, (cells[i] ?? '').trim()])));

  let convert: (r: Row) => NewEntry | null;
  if (source === 'NordPass') convert = nordPass;
  else if (source === 'Bitwarden') convert = bitwarden;
  else if (source === 'LastPass') convert = lastPass;
  else if (source === 'Firefox') convert = (r) => generic(r, { name: '', url: 'url', username: 'username', password: 'password', notes: '', totp: '', category: '', type: '' });
  else if (source === '1Password') convert = (r) => generic(r, { name: 'title', url: lower.includes('website') ? 'website' : 'url', username: 'username', password: 'password', notes: lower.includes('notes') ? 'notes' : 'notesplain', totp: lower.includes('otpauth') ? 'otpauth' : 'otpurl', category: 'tags', type: '' });
  else if (source === 'Proton Pass') convert = (r) => { const e = generic(r, { name: 'name', url: 'url', username: 'username', password: 'password', notes: 'note', totp: 'totp', category: 'vault', type: 'type' }); if (e && !e.username) e.username = r.email ?? ''; return e; };
  else if (source === 'Dashlane') convert = (r) => generic(r, { name: 'title', url: 'url', username: 'username', password: 'password', notes: 'note', totp: 'otpsecret', category: 'category', type: '' });
  else {
    const pick = (key: string, ...names: string[]) => {
      const idx = mapping?.[key];
      if (typeof idx === 'number' && idx >= 0) return lower[idx];
      return lower.find((h) => names.includes(h)) ?? '';
    };
    const cols = {
      name: pick('website', 'name', 'title', 'site', 'website'),
      url: pick('url', 'url', 'uri', 'login_uri', 'website_url', 'website'),
      username: pick('username', 'username', 'login', 'user', 'email', 'login_username'),
      password: pick('password', 'password', 'login_password', 'pass'),
      notes: pick('notes', 'notes', 'note', 'comments', 'extra'),
      totp: pick('totp', 'totp', 'otp', 'otpauth', '2fa'),
      category: pick('category', 'category', 'folder', 'group', 'grouping'),
      type: pick('type', 'type'),
    };
    convert = (r) => generic(r, cols);
  }

  const seen = new Set(existing.map(fp));
  const items: NewEntry[] = [];
  let skipped = 0;
  let duplicates = 0;
  for (const r of records) {
    const e = convert(r);
    if (!e) { skipped++; continue; }
    const key = fp(e);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    items.push(e);
  }
  return { items, skipped, duplicates, source };
}
