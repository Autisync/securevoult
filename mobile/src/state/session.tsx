/**
 * The app's one source of truth: who is signed in, whether the vault is
 * locked, the open vault, and every action on it.
 *
 * The vault key lives in a ref (never in React state, never persisted in the
 * clear) and is wiped on lock. Saves are queued so two quick edits can't race.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { User } from '@firebase/auth';
import type { VaultData } from '../core/types';
import { WrongPasswordError, type VaultKey } from '../core/vault-crypto';
import { wipe } from '../core/bytes';
import { addEntry, contentStamp, restoreEntry, trashEntry, updateEntry, type NewEntry } from '../core/vault-ops';
import {
  clearDeviceTokens, MfaRequiredError, OfflineError, registerDevice, SignedOutError, verifySecondFactor,
} from '../services/api';
import { restoredUser, signInEmail, signOutFirebase } from '../services/firebase';
import { DEFAULT_PREFS, forgetLocal, readLocal, readPrefs, writePrefs, type Prefs } from '../services/local-store';
import {
  createVault as createVaultRemote, NoVaultError, openWithKey, openWithPassword, pullVault, saveVault, type OpenVault,
} from '../services/vault-sync';
import { biometricAvailable, hasBiometricKey, markBiometric, readBiometricKey, saveBiometricKey } from '../services/biometric';
import { clearAutofill, syncAutofill, takeSavedLogins } from '../services/autofill';
import { request } from '../services/api';

export type Phase = 'loading' | 'signedOut' | 'mfa' | 'locked' | 'noVault' | 'unlocked';

interface SessionValue {
  phase: Phase;
  startupError: string | null;
  email: string | null;
  vault: VaultData | null;
  offline: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  prefs: Prefs;
  biometric: { available: boolean; label: string; enabled: boolean };
  /** Logins saved from other apps, added on the last unlock. */
  importedFromAutofill: number;

  retryStartup(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  submitMfa(code: string): Promise<void>;
  unlock(password: string): Promise<void>;
  unlockWithBiometric(): Promise<boolean>;
  createVault(password: string): Promise<string>;
  lock(): void;
  signOut(): Promise<void>;
  setBiometric(on: boolean): Promise<void>;
  setPrefs(p: Partial<Prefs>): Promise<void>;
  refresh(): Promise<void>;
  saveEntry(entry: NewEntry & { id?: string }): Promise<string>;
  deleteEntry(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  markUsed(id: string): void;
  usedAt: Record<string, number>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [startupError, setStartupError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [vault, setVault] = useState<VaultData | null>(null);
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [bio, setBio] = useState({ available: false, label: 'fingerprint', enabled: false });
  const [importedFromAutofill, setImported] = useState(0);

  const keyRef = useRef<VaultKey | null>(null);
  const versionRef = useRef(0);
  const vaultRef = useRef<VaultData | null>(null);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const backgroundAt = useRef<number | null>(null);
  const autofillStamp = useRef<string>('');
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const uid = user?.uid ?? null;

  // ── helpers ──────────────────────────────────────────────────────────────

  const applyOpen = useCallback((o: OpenVault) => {
    if (keyRef.current && keyRef.current.raw !== o.key.raw) wipe(keyRef.current.raw);
    keyRef.current = o.key;
    versionRef.current = o.serverVersion;
    vaultRef.current = o.vault;
    setVault(o.vault);
    setOffline(o.offline);
    if (!o.offline) setLastSyncedAt(Date.now());
    const stamp = contentStamp(o.vault);
    if (stamp !== autofillStamp.current) {
      autofillStamp.current = stamp;
      void syncAutofill(o.vault.entries, prefsRef.current.autofill);
    }
  }, []);

  const wipeOpenVault = useCallback(() => {
    if (keyRef.current) wipe(keyRef.current.raw);
    keyRef.current = null;
    vaultRef.current = null;
    setVault(null);
  }, []);

  const afterSignIn = useCallback(async (u: User) => {
    setUser(u);
    try {
      await registerDevice();
    } catch (e) {
      if (e instanceof MfaRequiredError) { setPhase('mfa'); return; }
      if (e instanceof SignedOutError) throw e;
      /* the session record is best-effort */
    }
    // Does the account need the 2FA code, and is there a vault at all?
    try {
      const res = await request('/vault', { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.vault?.encryptedData && !(await readLocal(u.uid))) { setPhase('noVault'); return; }
      setPhase('locked');
    } catch (e) {
      if (e instanceof MfaRequiredError) { setPhase('mfa'); return; }
      if (e instanceof SignedOutError) throw e;
      setPhase('locked'); // offline: the copy on the phone can still open
    }
  }, []);

  const refreshBiometric = useCallback(async (forUid: string | null) => {
    const avail = await biometricAvailable().catch(() => ({ ok: false, label: 'fingerprint' }));
    const enabled = forUid ? await hasBiometricKey(forUid).catch(() => false) : false;
    setBio({ available: avail.ok, label: avail.label, enabled: enabled && avail.ok });
  }, []);

  // ── start-up ─────────────────────────────────────────────────────────────

  const startup = useCallback(async () => {
    setStartupError(null);
    setPhase('loading');
    try {
      setPrefsState(await readPrefs());
      const u = await restoredUser();
      if (!u) { setPhase('signedOut'); return; }
      setUser(u);
      await refreshBiometric(u.uid);
      setPhase('locked');
      // Check 2FA / revocation in the background; the lock screen is already up.
      afterSignIn(u).catch(async (e) => {
        if (e instanceof SignedOutError) {
          await signOutFirebase().catch(() => undefined);
          setUser(null);
          setPhase('signedOut');
        }
      });
    } catch (e) {
      setStartupError((e as Error).message);
      setPhase('signedOut');
    }
  }, [afterSignIn, refreshBiometric]);

  useEffect(() => { void startup(); }, [startup]);

  // ── auto-lock ────────────────────────────────────────────────────────────

  const lock = useCallback(() => {
    wipeOpenVault();
    setPhase((p) => (p === 'unlocked' ? 'locked' : p));
  }, [wipeOpenVault]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') {
        if (backgroundAt.current === null) backgroundAt.current = Date.now();
        if (s === 'background' && prefsRef.current.autoLockMinutes === 0) lock();
        return;
      }
      if (s === 'active') {
        const away = backgroundAt.current ? Date.now() - backgroundAt.current : 0;
        backgroundAt.current = null;
        if (keyRef.current && away >= prefsRef.current.autoLockMinutes * 60_000 && away > 0) {
          lock();
        } else if (keyRef.current && away > 15_000) {
          void refreshRef.current();
        }
      }
    });
    return () => sub.remove();
  }, [lock]);

  // ── sign in / 2FA ────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await signInEmail(email, password);
    await refreshBiometric(u.uid);
    await afterSignIn(u);
  }, [afterSignIn, refreshBiometric]);

  const submitMfa = useCallback(async (code: string) => {
    await verifySecondFactor(code);
    if (user) await afterSignIn(user);
  }, [afterSignIn, user]);

  // ── unlock ───────────────────────────────────────────────────────────────

  const importSavedLogins = useCallback(async (o: OpenVault): Promise<OpenVault> => {
    const saved = await takeSavedLogins();
    if (!saved.length || !uid) return o;
    let v = o.vault;
    for (const s of saved) {
      const exists = v.entries.some((e) => e.username === s.username && e.password === s.password);
      if (exists) continue;
      const url = s.domain ? `https://${s.domain}` : s.packageName ? `androidapp://${s.packageName}` : undefined;
      v = addEntry(v, {
        type: 'login', website: s.domain || s.packageName || 'Saved login', url, username: s.username, password: s.password,
        category: 'General', notes: '',
      }).vault;
    }
    if (v === o.vault) return o;
    setImported(v.entries.length - o.vault.entries.length);
    return saveVault(uid, v, o.key, o.serverVersion);
  }, [uid]);

  const unlock = useCallback(async (password: string) => {
    if (!uid) throw new Error('Sign in first.');
    try {
      const o = await openWithPassword(uid, password);
      applyOpen(await importSavedLogins(o));
      setPhase('unlocked');
    } catch (e) {
      if (e instanceof NoVaultError) { setPhase('noVault'); return; }
      if (e instanceof MfaRequiredError) { setPhase('mfa'); return; }
      if (e instanceof WrongPasswordError) throw new Error('That master password isn\'t right.');
      throw e;
    }
  }, [uid, applyOpen, importSavedLogins]);

  const unlockWithBiometric = useCallback(async () => {
    if (!uid) return false;
    const raw = await readBiometricKey(uid);
    if (!raw) return false;
    try {
      const o = await openWithKey(uid, raw);
      applyOpen(await importSavedLogins(o));
      setPhase('unlocked');
      return true;
    } catch (e) {
      wipe(raw);
      if (e instanceof MfaRequiredError) { setPhase('mfa'); return false; }
      // Key no longer matches (vault reset elsewhere): fall back to the master password.
      await markBiometric(uid, false);
      setBio((b) => ({ ...b, enabled: false }));
      throw new Error('Fingerprint unlock needs to be set up again. Use your master password this time.');
    }
  }, [uid, applyOpen, importSavedLogins]);

  const createVault = useCallback(async (password: string) => {
    if (!uid) throw new Error('Sign in first.');
    const o = await createVaultRemote(uid, password);
    applyOpen(o);
    setPhase('unlocked');
    return o.recoveryKey;
  }, [uid, applyOpen]);

  const setBiometric = useCallback(async (on: boolean) => {
    if (!uid) return;
    if (on) {
      if (!keyRef.current) throw new Error('Unlock first.');
      await saveBiometricKey(uid, keyRef.current.raw);
      await markBiometric(uid, true);
    } else {
      await markBiometric(uid, false);
    }
    await refreshBiometric(uid);
  }, [uid, refreshBiometric]);

  // ── sign out ─────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    wipeOpenVault();
    await clearAutofill();
    autofillStamp.current = '';
    if (uid) {
      await markBiometric(uid, false).catch(() => undefined);
      await forgetLocal(uid);
    }
    await clearDeviceTokens();
    await signOutFirebase().catch(() => undefined);
    setUser(null);
    setPhase('signedOut');
  }, [uid, wipeOpenVault]);

  // ── prefs ────────────────────────────────────────────────────────────────

  const setPrefs = useCallback(async (p: Partial<Prefs>) => {
    const next = { ...prefsRef.current, ...p };
    setPrefsState(next);
    prefsRef.current = next;
    await writePrefs(next);
    if (p.autofill !== undefined) {
      autofillStamp.current = '';
      if (vaultRef.current) void syncAutofill(vaultRef.current.entries, next.autofill);
      else if (!next.autofill) void clearAutofill();
    }
  }, []);

  // ── sync & edits ─────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const key = keyRef.current;
    const current = vaultRef.current;
    if (!uid || !key || !current) return;
    setSyncing(true);
    try {
      const local = await readLocal(uid);
      if (local?.dirty) applyOpen(await saveVault(uid, current, key, versionRef.current));
      else {
        const pulled = await pullVault(uid, current, key, versionRef.current);
        if (pulled) applyOpen(pulled);
        else { setOffline(false); setLastSyncedAt(Date.now()); }
      }
    } catch (e) {
      if (e instanceof OfflineError) setOffline(true);
      else if (e instanceof SignedOutError) await signOut();
    } finally {
      setSyncing(false);
    }
  }, [uid, applyOpen, signOut]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  /** Applies a change now, saves it in the background (queued). */
  const commit = useCallback((change: (v: VaultData) => VaultData) => {
    const key = keyRef.current;
    const current = vaultRef.current;
    if (!uid || !key || !current) throw new Error('The vault is locked.');
    const next = change(current);
    vaultRef.current = next;
    setVault(next);
    const job = saveChain.current.then(async () => {
      if (!keyRef.current || vaultRef.current !== next) return; // a newer change will save
      setSyncing(true);
      try {
        const o = await saveVault(uid, next, keyRef.current, versionRef.current);
        if (vaultRef.current === next) applyOpen(o);
        else { versionRef.current = o.serverVersion; keyRef.current = o.key; }
      } catch (e) {
        if (e instanceof SignedOutError) await signOut();
      } finally {
        setSyncing(false);
      }
    });
    saveChain.current = job.catch(() => undefined);
    return job;
  }, [uid, applyOpen, signOut]);

  const saveEntry = useCallback(async (entry: NewEntry & { id?: string }) => {
    let id = entry.id ?? '';
    await commit((v) => {
      if (entry.id && v.entries.some((e) => e.id === entry.id)) {
        const { id: _omit, ...rest } = entry;
        return updateEntry(v, entry.id, rest);
      }
      const r = addEntry(v, entry);
      id = r.id;
      return r.vault;
    });
    return id;
  }, [commit]);

  const deleteEntry = useCallback(async (id: string) => { await commit((v) => trashEntry(v, id)); }, [commit]);
  const restore = useCallback(async (id: string) => { await commit((v) => restoreEntry(v, id)); }, [commit]);
  const toggleFavorite = useCallback(async (id: string) => {
    await commit((v) => {
      const e = v.entries.find((x) => x.id === id);
      return e ? updateEntry(v, id, { isFavorite: !e.isFavorite }) : v;
    });
  }, [commit]);

  /** When items were last copied on this phone, for the "Recently used" order. Not saved to the vault. */
  const [usedAt, setUsedAt] = useState<Record<string, number>>({});
  const markUsed = useCallback((id: string) => {
    setUsedAt((m) => ({ ...m, [id]: Date.now() }));
  }, []);

  const value = useMemo<SessionValue>(() => ({
    phase, startupError, email: user?.email ?? null, vault, offline, syncing, lastSyncedAt, prefs,
    biometric: bio, importedFromAutofill,
    retryStartup: startup, signIn, submitMfa, unlock, unlockWithBiometric, createVault, lock, signOut, setBiometric,
    setPrefs, refresh, saveEntry, deleteEntry, restore, toggleFavorite, markUsed, usedAt,
  }), [phase, startupError, user, vault, offline, syncing, lastSyncedAt, prefs, bio, importedFromAutofill, startup, signIn,
    submitMfa, unlock, unlockWithBiometric, createVault, lock, signOut, setBiometric, setPrefs, refresh, saveEntry,
    deleteEntry, restore, toggleFavorite, markUsed, usedAt]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
