/**
 * The link to the Autisync CRM (crm-autisync-original), server to server.
 *
 *   CRM_API_URL          https://api.autisync.com
 *   CRM_PRODUCT_TOKEN    same value as PRODUCT_SIGNUP_TOKEN on the CRM: new
 *                        SecureVoult sign-ups become CRM contacts and deals
 *   CRM_STATUS_TOKEN     same value as STATUS_HEARTBEAT_TOKEN on the CRM: the
 *                        nightly backup check shows in CRM → System status
 *
 * Anything not set is skipped quietly. Nothing secret is sent: no vault data,
 * only an email address, a name and the plan for sign-ups.
 */
const env = (k: string) => (process.env[k] ?? '').trim();
const base = () => env('CRM_API_URL').replace(/\/+$/, '');

async function post(path: string, token: string, body: unknown): Promise<boolean> {
  if (!base() || !token) return false;
  try {
    const res = await fetch(`${base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': 'SecureVoult/1.0' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[crm] ${path} answered ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`[crm] ${path} failed:`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** A new SecureVoult account: a contact and a deal in the CRM. */
export function notifySignup(user: { email?: string | null; name?: string | null; plan?: string; provider?: string }): Promise<boolean> {
  if (!user.email) return Promise.resolve(false);
  return post('/api/public/products/securevoult/signups', env('CRM_PRODUCT_TOKEN'), {
    email: user.email, name: user.name || '', plan: user.plan || 'free', provider: user.provider || 'password', at: new Date().toISOString(),
  });
}

/** Tells CRM → System status that something ran (e.g. "securevoult-backup"). */
export function heartbeat(name: string, ok: boolean, detail: Record<string, unknown>): Promise<boolean> {
  return post(`/api/status/heartbeat/${encodeURIComponent(name)}`, env('CRM_STATUS_TOKEN'), { ok, ...detail });
}
