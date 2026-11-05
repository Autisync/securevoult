/**
 * Browser side of two-step sign-in: keeps the proof token for this sign-in
 * and talks to /api/auth/2fa/*.
 *
 * Where the token lives: the web app's localStorage (shared by its tabs,
 * cleared at sign-out); the extension's chrome.storage.session (memory only,
 * shared by the popup and the background worker).
 */
import { AuthService } from '@/lib/auth';

const KEY = 'sv_mfa_token';

const extStore = (): chrome.storage.StorageArea | null => {
  try { return typeof chrome !== 'undefined' && chrome.storage?.session ? chrome.storage.session : null; } catch { return null; }
};

export async function getMfaToken(): Promise<string | null> {
  const ext = extStore();
  if (ext) return ((await ext.get(KEY))[KEY] as string | undefined) ?? null;
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null; } catch { return null; }
}

export async function setMfaToken(token: string | null): Promise<void> {
  const ext = extStore();
  if (ext) { await (token ? ext.set({ [KEY]: token }) : ext.remove(KEY)); return; }
  try { token ? localStorage.setItem(KEY, token) : localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

export class MfaRequiredError extends Error {
  constructor() { super('Enter the code from your authenticator app'); this.name = 'MfaRequiredError'; }
}

function baseUrl(): string {
  const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  return isExtension ? (process.env.NEXT_PUBLIC_APP_URL || 'https://vault.autisync.com') : (typeof window !== 'undefined' ? window.location.origin : '');
}

async function call<T>(action: string, body?: unknown): Promise<T> {
  const token = await AuthService.getIdToken();
  if (!token) throw new Error('Sign in first');
  const mfa = await getMfaToken();
  const res = await fetch(`${baseUrl()}/api/auth/2fa/${action}`, {
    method: body === undefined && action === 'status' ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(mfa ? { 'X-MFA-Token': mfa } : {}) },
    ...(action === 'status' ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? 'Something went wrong. Try again.');
  return data as T;
}

export const mfaApi = {
  status: () => call<{ enabled: boolean; verified: boolean; backupCodesLeft: number }>('status'),
  setup: () => call<{ secret: string; otpauth: string }>('setup', {}),
  async enable(code: string) {
    const r = await call<{ token: string | null; backupCodes: string[] }>('enable', { code });
    if (r.token) await setMfaToken(r.token);
    return r;
  },
  async verify(code: string) {
    const r = await call<{ token: string | null; backupCodesLeft?: number }>('verify', { code });
    await setMfaToken(r.token);
    return r;
  },
  async disable(code: string) {
    await call('disable', { code });
    await setMfaToken(null);
  },
  newBackupCodes: (code: string) => call<{ backupCodes: string[] }>('backup-codes', { code }),
};
