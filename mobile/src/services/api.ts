/**
 * Signed-in calls to the SecureVoult API: the Firebase ID token, this
 * device's session id (so it can be signed out from the web) and the
 * two-step proof token when the account uses 2FA.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { idToken } from './firebase';

const SESSION_KEY = 'sv_session_id';
const MFA_KEY = 'sv_mfa_token';

export class OfflineError extends Error {
  constructor() { super('Can\'t reach SecureVoult right now.'); this.name = 'OfflineError'; }
}
export class MfaRequiredError extends Error {
  constructor() { super('Enter the code from your authenticator app.'); this.name = 'MfaRequiredError'; }
}
export class SignedOutError extends Error {
  constructor(message = 'Sign in again to continue.') { super(message); this.name = 'SignedOutError'; }
}

export const getSessionId = () => AsyncStorage.getItem(SESSION_KEY);
export const getMfaToken = () => AsyncStorage.getItem(MFA_KEY);
export async function setMfaToken(t: string | null): Promise<void> {
  if (t) await AsyncStorage.setItem(MFA_KEY, t);
  else await AsyncStorage.removeItem(MFA_KEY);
}

export async function clearDeviceTokens(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, MFA_KEY]);
}

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await idToken();
  if (!token) throw new SignedOutError();
  const [sessionId, mfa] = await Promise.all([getSessionId(), getMfaToken()]);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
        ...(mfa ? { 'X-MFA-Token': mfa } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new OfflineError();
  }
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (body?.code === 'mfa_required') throw new MfaRequiredError();
    if (body?.code === 'session_revoked' || /revoked/i.test(String(body?.message ?? body?.error ?? ''))) {
      throw new SignedOutError('This phone was signed out from another device.');
    }
  }
  if (res.status >= 500) throw new OfflineError();
  return res;
}

export async function json<T>(path: string, body?: unknown): Promise<T> {
  const res = await request(path, body === undefined ? { method: 'GET' } : { method: 'POST', body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: unknown };
  if (!res.ok) throw new Error(data.message || (typeof data.error === 'string' ? data.error : '') || `Something went wrong (${res.status}).`);
  return data;
}

/** Registers this phone as a session (shown under Devices on the web, where it can be signed out). */
export async function registerDevice(): Promise<{ plan?: string }> {
  const existing = await getSessionId();
  const data = await json<{ sessionId?: string; user?: { plan?: string } }>('/auth/sync-user', {
    provider: 'password',
    clientType: 'mobile',
    ...(existing ? { sessionId: existing } : {}),
  });
  if (data.sessionId) await AsyncStorage.setItem(SESSION_KEY, data.sessionId);
  return { plan: data.user?.plan };
}

// ── Two-step sign-in ───────────────────────────────────────────────────────

export async function verifySecondFactor(code: string): Promise<void> {
  const r = await json<{ token: string | null }>('/auth/2fa/verify', { code: code.replace(/\s/g, '') });
  await setMfaToken(r.token);
}
