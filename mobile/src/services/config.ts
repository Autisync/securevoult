/**
 * Where the app talks to, and the public settings it reads from the server
 * (Firebase web config). Cached so the app still starts offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const API_BASE: string =
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ?? 'https://vault.autisync.com';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface AppConfig {
  firebase: FirebaseWebConfig;
  minAppVersion: string;
  webUrl: string;
}

const CACHE_KEY = 'sv_app_config';
let loaded: AppConfig | null = null;

export async function loadAppConfig(): Promise<AppConfig> {
  if (loaded) return loaded;
  try {
    const res = await fetch(`${API_BASE}/api/app-config`);
    if (!res.ok) throw new Error(String(res.status));
    const cfg = (await res.json()) as AppConfig;
    if (!cfg.firebase?.apiKey) throw new Error('No Firebase settings on the server');
    loaded = cfg;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cfg)).catch(() => undefined);
    return cfg;
  } catch (e) {
    const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
    if (cached) {
      loaded = JSON.parse(cached) as AppConfig;
      return loaded;
    }
    throw new Error(`Can't reach SecureVoult. Check your connection and try again. (${(e as Error).message})`);
  }
}

/** "1.2.10" < "1.10.0" done properly. */
export function olderThan(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
