/**
 * Email masks are mailcow aliases: mail to the mask is forwarded to the
 * account's address. Needs MAILCOW_URL, MAILCOW_API_KEY (read-write) and
 * MASK_DOMAIN (a domain added in mailcow, e.g. mask.autisync.com).
 */
import { randomInt } from 'crypto';

const env = (k: string) => (process.env[k] ?? '').trim();
export const maskDomain = () => env('MASK_DOMAIN').toLowerCase();
export const maskingConfigured = () => !!(env('MAILCOW_URL') && env('MAILCOW_API_KEY') && maskDomain());

export class MailcowError extends Error {}

async function call(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${env('MAILCOW_URL').replace(/\/+$/, '')}/api/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-API-Key': env('MAILCOW_API_KEY'), 'Content-Type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  }).catch(() => { throw new MailcowError('The mail server could not be reached.'); });
  if (res.status === 401 || res.status === 403) throw new MailcowError('The mail server refused the API key (check MAILCOW_API_KEY and its allowed IPs).');
  if (!res.ok) throw new MailcowError(`The mail server answered ${res.status}.`);
  const data = await res.json().catch(() => null);
  // Write calls answer [{ type: 'success' | 'danger' | 'error', msg: [...] }].
  if (Array.isArray(data) && data.some((r: { type?: string }) => r?.type === 'danger' || r?.type === 'error')) {
    const msg = (data.find((r: { type?: string }) => r?.type !== 'success') as { msg?: unknown })?.msg;
    throw new MailcowError(`The mail server said: ${Array.isArray(msg) ? msg.join(' ') : String(msg ?? 'error')}`);
  }
  return data;
}

async function findAliasId(address: string): Promise<string | null> {
  const all = (await call('get/alias/all')) as { id: number | string; address: string }[] | null;
  const hit = (all ?? []).find((a) => a.address?.toLowerCase() === address.toLowerCase());
  return hit ? String(hit.id) : null;
}

export async function createAlias(address: string, goto: string): Promise<string | null> {
  await call('add/alias', { address, goto, active: '1', sogo_visible: '0' });
  return findAliasId(address);
}

export async function setAliasActive(id: string, active: boolean): Promise<void> {
  await call('edit/alias', { items: [id], attr: { active: active ? '1' : '0' } });
}

export async function deleteAlias(id: string): Promise<void> {
  await call('delete/alias', [id]);
}

const A = ['amber', 'aspen', 'brisk', 'calm', 'cedar', 'clever', 'coral', 'crisp', 'dawn', 'eager', 'ember', 'fable', 'fern', 'frost', 'gentle', 'golden', 'hazel', 'ivory', 'jade', 'jolly', 'keen', 'lunar', 'maple', 'mellow', 'misty', 'noble', 'opal', 'pine', 'polar', 'quiet', 'rapid', 'river', 'ruby', 'sage', 'silver', 'solar', 'swift', 'tidal', 'velvet', 'vivid', 'willow', 'zesty'];
const B = ['anchor', 'arrow', 'badger', 'beacon', 'birch', 'canyon', 'comet', 'delta', 'falcon', 'field', 'harbor', 'heron', 'island', 'lagoon', 'lantern', 'meadow', 'meteor', 'orbit', 'otter', 'pebble', 'prairie', 'quartz', 'raven', 'reef', 'ridge', 'sparrow', 'summit', 'thistle', 'thunder', 'valley', 'voyage', 'zenith', 'everest', 'galaxy', 'harvest', 'kestrel'];

/** Something like opal.zenith6398@mask.autisync.com */
export function newMaskAddress(): string {
  return `${A[randomInt(A.length)]}.${B[randomInt(B.length)]}${randomInt(1000, 10000)}@${maskDomain()}`;
}
