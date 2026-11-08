/**
 * Android autofill: the app hands the native autofill service a list of
 * logins, which it keeps encrypted with a key in the phone's secure hardware
 * that only opens after a fingerprint / screen-lock check. Other apps and
 * Chrome then get "Fill with SecureVoult" on their login fields.
 *
 * On iPhone (and in Expo Go) the native module isn't there and everything
 * here quietly does nothing.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { PasswordEntry } from '../core/types';
import { baseDomain } from '../core/domain';

interface NativeAutofill {
  isSupported(): boolean;
  isEnabled(): boolean;
  openSettings(): void;
  setLogins(json: string): Promise<void>;
  clear(): Promise<void>;
  takeSavedLogins(): Promise<string>;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeAutofill>('SecureVoultAutofill') : null;

export const autofillSupported = (): boolean => !!native?.isSupported();
export const autofillEnabled = (): boolean => !!native?.isEnabled();
export const openAutofillSettings = (): void => native?.openSettings();

/** What the native side gets: logins only, with their sites and Android app ids. */
export interface AutofillLogin {
  id: string;
  name: string;
  username: string;
  password: string;
  /** Base domains this login fills on, e.g. "google.com". */
  domains: string[];
  /** The exact addresses it was saved for, e.g. "calls.autisync.com", shown on the suggestion. */
  hosts: string[];
  /** Android package names, from "androidapp://com.example" addresses. */
  apps: string[];
}

function hostOf(u: string): string | null {
  const m = u.trim().match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/?#:@\s]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export function toAutofillLogins(entries: PasswordEntry[]): AutofillLogin[] {
  return entries
    .filter((e) => (e.type ?? 'login') === 'login' && (e.password || e.username))
    .map((e) => {
      const addresses = [e.url, ...(e.urls ?? [])].filter((u): u is string => !!u && !!u.trim());
      const apps = addresses.filter((u) => /^androidapp:\/\//i.test(u)).map((u) => u.replace(/^androidapp:\/\//i, '').trim());
      const hosts = [...new Set(addresses
        .filter((u) => !/^androidapp:\/\//i.test(u))
        .map(hostOf)
        .filter((h): h is string => !!h && h.includes('.'))
        .map((h) => h.replace(/^www\./, '')))];
      const domains = [...new Set(hosts.map(baseDomain))];
      return { id: e.id, name: e.website || hosts[0] || 'Login', username: e.username ?? '', password: e.password ?? '', domains, hosts, apps };
    });
}

export async function syncAutofill(entries: PasswordEntry[], enabled: boolean): Promise<void> {
  if (!native) return;
  try {
    if (!enabled) await native.clear();
    else await native.setLogins(JSON.stringify(toAutofillLogins(entries)));
  } catch { /* autofill is a convenience: never block the vault on it */ }
}

export async function clearAutofill(): Promise<void> {
  try { await native?.clear(); } catch { /* nothing to clear */ }
}

/** Logins typed into other apps that the user asked SecureVoult to save. */
export interface SavedLogin { username: string; password: string; domain?: string; packageName?: string; savedAt: number }

export async function takeSavedLogins(): Promise<SavedLogin[]> {
  if (!native) return [];
  try {
    const list = JSON.parse(await native.takeSavedLogins()) as SavedLogin[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
