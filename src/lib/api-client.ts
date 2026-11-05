/**
 * Signed-in calls to SecureVoult's API from the app and the extension.
 * Throws an Error with the server's own message when a call fails.
 */
import { AuthService } from '@/lib/auth';

function base(): string {
  const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  if (isExtension) return process.env.NEXT_PUBLIC_APP_URL || 'https://vault.autisync.com';
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  const token = await AuthService.getIdToken();
  if (!token) throw new Error('Sign in again to continue.');
  const res = await fetch(`${base()}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: unknown };
  if (!res.ok) throw new Error(data.message || (typeof data.error === 'string' ? data.error : '') || `Something went wrong (${res.status}).`);
  return data;
}
