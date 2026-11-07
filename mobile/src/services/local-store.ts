/**
 * What the phone keeps between launches:
 *  - the encrypted vault blob (the same one the server has), so the vault
 *    opens offline. It is useless without the master password or fingerprint.
 *  - app preferences (auto-lock, clipboard timeout...).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

export interface LocalCopy {
  blob: string;
  /** Server version this copy is based on. */
  serverVersion: number;
  /** Has changes not uploaded yet. */
  dirty: boolean;
  uid: string;
}

const fileFor = (uid: string) => new File(Paths.document, `vault-${uid.replace(/[^A-Za-z0-9_-]/g, '')}.json`);

export async function readLocal(uid: string): Promise<LocalCopy | null> {
  try {
    const f = fileFor(uid);
    if (!f.exists) return null;
    const copy = JSON.parse(await f.text()) as LocalCopy;
    return copy.uid === uid ? copy : null;
  } catch {
    return null;
  }
}

export async function writeLocal(copy: LocalCopy): Promise<void> {
  const f = fileFor(copy.uid);
  if (!f.exists) f.create();
  f.write(JSON.stringify(copy));
}

export async function forgetLocal(uid: string): Promise<void> {
  try {
    const f = fileFor(uid);
    if (f.exists) f.delete();
  } catch { /* already gone */ }
}

// ── Preferences ────────────────────────────────────────────────────────────

export interface Prefs {
  /** Lock this long after leaving the app. 0 = straight away. */
  autoLockMinutes: number;
  /** Clear a copied password after this many seconds. 0 = never. */
  clipboardSeconds: number;
  biometricUnlock: boolean;
  autofill: boolean;
  passwordLength: number;
}

export const DEFAULT_PREFS: Prefs = {
  autoLockMinutes: 5,
  clipboardSeconds: 30,
  biometricUnlock: false,
  autofill: true,
  passwordLength: 20,
};

const PREFS_KEY = 'sv_prefs';

export async function readPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function writePrefs(p: Prefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
}
