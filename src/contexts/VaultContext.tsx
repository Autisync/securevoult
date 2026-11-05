'use client';

import { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import { VaultData, PasswordEntry, SortBy, Attachment } from '@/types/vault';
import { useAuth } from '@/contexts/AuthContext';
import {
  VaultService, NoVaultError, openVault, createVault as createNewVault, saveVault, pullVault,
  vaultExists, exportBackup, readBackup, openWithKey, addRecoveryKit, recoverVault as recoverWithKit,
  MfaRequiredError, databaseAPI, type NewEntry,
} from '@/lib/vault';
import { mfaApi, setMfaToken } from '@/lib/mfa-client';
import { unlockWithDevice as deviceKey } from '@/lib/biometric';
import { AuthService } from '@/lib/auth';
import { rewrapVaultKey, encryptFile, decryptFile, toB64, exportRawKey, importRawKey, type KeyHeader, type VaultKey } from '@/lib/vault-crypto';
import { getVaultPreference } from '@/hooks/useVaultPreferences';
import { mergeVaults } from '@/lib/vault-merge';
import { parseCsv, importFromCsv } from '@/lib/importers';
import { CryptoService } from '@/lib/crypto';

export type SyncStatus = 'synced' | 'syncing' | 'failed' | 'offline';

interface VaultState {
  isUnlocked: boolean;
  vault: VaultData | null;
  searchQuery: string;
  selectedCategory: string;
  sortBy: SortBy;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  /** Kept for older screens; conflicts are merged automatically now. */
  vaultConflict: { serverVersion: number } | null;
  /** Two-step sign-in: 'required' until the authenticator code is entered for this sign-in. */
  secondFactor: 'unknown' | 'required' | 'ok';
  /** A Recovery Kit key just made: shown once, then forgotten. */
  newRecoveryKey: string | null;
  /** Whether the open vault has a Recovery Kit. */
  hasRecoveryKit: boolean;
}

type VaultAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UNLOCK_VAULT'; payload: { vault: VaultData } }
  | { type: 'LOCK_VAULT' }
  | { type: 'UPDATE_VAULT'; payload: VaultData }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string }
  | { type: 'SET_SORT_BY'; payload: SortBy }
  | { type: 'SET_SYNC_STATUS'; payload: { status: SyncStatus; lastSynced?: Date } }
  | { type: 'SET_2FA'; payload: VaultState['secondFactor'] }
  | { type: 'SET_RECOVERY'; payload: { key?: string | null; has?: boolean } };

const initialState: VaultState = {
  isUnlocked: false,
  vault: null,
  searchQuery: '',
  selectedCategory: 'all',
  sortBy: 'updated',
  isLoading: false,
  error: null,
  syncStatus: 'synced',
  lastSynced: null,
  vaultConflict: null,
  secondFactor: 'unknown',
  newRecoveryKey: null,
  hasRecoveryKit: false,
};

function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'UNLOCK_VAULT': return { ...state, isUnlocked: true, vault: action.payload.vault, error: null };
    case 'LOCK_VAULT': return { ...initialState, secondFactor: state.secondFactor };
    case 'UPDATE_VAULT': return { ...state, vault: action.payload };
    case 'SET_SEARCH_QUERY': return { ...state, searchQuery: action.payload };
    case 'SET_SELECTED_CATEGORY': return { ...state, selectedCategory: action.payload };
    case 'SET_SORT_BY': return { ...state, sortBy: action.payload };
    case 'SET_SYNC_STATUS': return { ...state, syncStatus: action.payload.status, lastSynced: action.payload.lastSynced ?? state.lastSynced };
    case 'SET_2FA': return { ...state, secondFactor: action.payload };
    case 'SET_RECOVERY': return {
      ...state,
      ...(action.payload.key !== undefined ? { newRecoveryKey: action.payload.key } : {}),
      ...(action.payload.has !== undefined ? { hasRecoveryKit: action.payload.has } : {}),
    };
    default: return state;
  }
}

export interface ImportSummary { imported: number; skipped: number; duplicates: number; source: string }

interface VaultContextType extends VaultState {
  unlockVault: (masterPassword: string) => Promise<void>;
  createVault: (masterPassword: string) => Promise<void>;
  lockVault: () => void;
  addEntry: (entry: NewEntry) => Promise<void>;
  updateEntry: (entryId: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  getFilteredEntries: () => PasswordEntry[];
  getCategories: () => string[];
  /** Encrypted backup; opens with the current master password. */
  exportVault: () => Promise<string>;
  exportVaultCSV: () => string;
  /** Restores items from a SecureVoult backup made with `password`. */
  importVault: (jsonData: string, password?: string) => Promise<void>;
  /** NordPass, Bitwarden, 1Password, LastPass, Chrome or a generic CSV. */
  importFromCSV: (csv: string, mapping?: Record<string, number | null>) => Promise<ImportSummary>;
  changeMasterPassword: (current: string, next: string) => Promise<void>;
  /** Pulls changes made on other devices. */
  refresh: () => Promise<void>;
  hasVault: () => Promise<boolean>;
  findEntriesForCurrentDomain: () => Promise<PasswordEntry[]>;
  vaultConflict: { serverVersion: number } | null;
  dismissConflict: () => void;
  /** Sends the authenticator (or backup) code for this sign-in. */
  verifySecondFactor: (code: string) => Promise<void>;
  /** Re-reads whether this account has two-step sign-in on (after turning it on/off). */
  refreshSecondFactor: () => Promise<void>;
  /** Makes or replaces the Recovery Kit; the new key appears in newRecoveryKey. */
  createRecoveryKit: (masterPassword: string) => Promise<void>;
  /** Forgot the master password: recovery key + new master password. */
  recoverVault: (recoveryKey: string, newMasterPassword: string) => Promise<void>;
  /** The user has saved the key shown in newRecoveryKey. */
  dismissRecoveryKey: () => void;
  /** Unlock with Windows Hello / Touch ID / fingerprint (set up in Settings). */
  unlockWithDevice: () => Promise<void>;
  /** The open vault's key header (for setting up device unlock). */
  getKeyHeader: () => KeyHeader | null;
  /** Encrypts a file in this browser, uploads it and lists it on the item. */
  addAttachment: (entryId: string, file: File) => Promise<Attachment>;
  /** Downloads and decrypts a file. */
  openAttachment: (att: Attachment) => Promise<Blob>;
  removeAttachment: (entryId: string, attachmentId: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

/**
 * Keeps the unlocked key between popup openings (browser extension only).
 * The web app passes nothing: closing or reloading the tab locks the vault.
 */
export interface VaultSession {
  load(): Promise<{ key: string; header: KeyHeader } | null>;
  save(s: { key: string; header: KeyHeader; autoLockMinutes: number }): Promise<void>;
  clear(): Promise<void>;
}

export function VaultProvider({ children, session }: { children: ReactNode; session?: VaultSession }) {
  const [state, dispatch] = useReducer(vaultReducer, initialState);
  const { isAuthenticated } = useAuth();
  const resumeTried = useRef(false);

  // Live copies for the save queue (state is a step behind inside async code).
  const vaultRef = useRef<VaultData | null>(null);
  const keyRef = useRef<VaultKey | null>(null);
  const versionRef = useRef(0);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRef = useRef(false);

  const setVault = (v: VaultData) => { vaultRef.current = v; dispatch({ type: 'UPDATE_VAULT', payload: v }); };

  const forget = () => {
    vaultRef.current = null;
    keyRef.current = null;
    versionRef.current = 0;
    pendingRef.current = false;
  };

  useEffect(() => {
    if (!isAuthenticated && state.isUnlocked) { forget(); dispatch({ type: 'LOCK_VAULT' }); }
  }, [isAuthenticated, state.isUnlocked]);

  const remember = (key: VaultKey) => {
    if (!session) return;
    exportRawKey(key)
      .then((raw) => session.save({ key: raw, header: key.header, autoLockMinutes: getVaultPreference('autoLockMinutes') ?? 15 }))
      .catch(() => {});
  };

  const adopt = (opened: { vault: VaultData; key: VaultKey; serverVersion: number; offline: boolean }) => {
    const headerChanged = keyRef.current?.header.wk.ct !== opened.key.header.wk.ct || keyRef.current?.header.rk?.wk.ct !== opened.key.header.rk?.wk.ct;
    dispatch({ type: 'SET_RECOVERY', payload: { has: !!opened.key.header.rk } });
    keyRef.current = opened.key;
    versionRef.current = opened.serverVersion;
    if (headerChanged) remember(opened.key);
    dispatch({ type: 'SET_SYNC_STATUS', payload: opened.offline ? { status: 'offline' } : { status: 'synced', lastSynced: new Date() } });
  };

  // Two-step sign-in: find out once per sign-in whether a code is still needed.
  const refreshSecondFactor = useCallback(async () => {
    try {
      const s = await mfaApi.status();
      dispatch({ type: 'SET_2FA', payload: s.enabled && !s.verified ? 'required' : 'ok' });
    } catch {
      dispatch({ type: 'SET_2FA', payload: 'ok' }); // the vault request itself will ask if needed
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void refreshSecondFactor();
    else { dispatch({ type: 'SET_2FA', payload: 'unknown' }); void setMfaToken(null); }
  }, [isAuthenticated, refreshSecondFactor]);

  const verifySecondFactor = async (code: string) => {
    await mfaApi.verify(code);
    dispatch({ type: 'SET_2FA', payload: 'ok' });
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  // Extension: pick up the key kept from the last unlock instead of asking again.
  useEffect(() => {
    // Waits for the two-step check, so a kept key never skips the authenticator code.
    if (!session || !isAuthenticated || state.isUnlocked || resumeTried.current || state.secondFactor !== 'ok') return;
    resumeTried.current = true;
    (async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const kept = await session.load();
        if (!kept) return;
        const opened = await openWithKey(await importRawKey(kept.key, kept.header));
        keyRef.current = null;
        adopt(opened);
        vaultRef.current = opened.vault;
        dispatch({ type: 'UNLOCK_VAULT', payload: { vault: opened.vault } });
      } catch (e) {
        if (e instanceof MfaRequiredError) { resumeTried.current = false; dispatch({ type: 'SET_2FA', payload: 'required' }); }
        else await session.clear().catch(() => {});
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, [session, isAuthenticated, state.isUnlocked, state.secondFactor]);

  const unlockVault = async (masterPassword: string) => {
    if (!isAuthenticated) throw new Error('Please sign in first');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const opened = await openVault(masterPassword);
      keyRef.current = null;
      adopt(opened);
      vaultRef.current = opened.vault;
      dispatch({ type: 'UNLOCK_VAULT', payload: { vault: opened.vault } });
    } catch (error) {
      if (error instanceof MfaRequiredError) {
        dispatch({ type: 'SET_2FA', payload: 'required' });
        dispatch({ type: 'SET_ERROR', payload: null });
        return;
      }
      const msg = error instanceof NoVaultError ? error.message
        : error instanceof Error && error.name === 'WrongPasswordError' ? 'That master password is not right'
        : error instanceof Error ? error.message : 'Failed to unlock vault';
      dispatch({ type: 'SET_ERROR', payload: msg });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createVault = async (masterPassword: string) => {
    if (!isAuthenticated) throw new Error('Please sign in first');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const opened = await createNewVault(masterPassword);
      keyRef.current = null;
      adopt(opened);
      vaultRef.current = opened.vault;
      dispatch({ type: 'SET_RECOVERY', payload: { key: opened.recoveryKey } });
      dispatch({ type: 'UNLOCK_VAULT', payload: { vault: opened.vault } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create vault' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const lockVault = () => { forget(); void session?.clear().catch(() => {}); dispatch({ type: 'LOCK_VAULT' }); };

  const unlockWithDevice = async () => {
    if (!isAuthenticated) throw new Error('Please sign in first');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const opened = await openWithKey(await deviceKey(AuthService.currentUid()));
      keyRef.current = null;
      adopt(opened);
      vaultRef.current = opened.vault;
      dispatch({ type: 'UNLOCK_VAULT', payload: { vault: opened.vault } });
    } catch (error) {
      if (error instanceof MfaRequiredError) { dispatch({ type: 'SET_2FA', payload: 'required' }); return; }
      const msg = error instanceof Error && error.name === 'NotAllowedError' ? 'Cancelled. Try again or use your master password.'
        : error instanceof Error ? error.message : 'Could not unlock';
      dispatch({ type: 'SET_ERROR', payload: msg });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createRecoveryKit = async (masterPassword: string) => {
    if (!vaultRef.current || !keyRef.current) throw new Error('Unlock the vault first');
    await queueRef.current.catch(() => {});
    const made = await addRecoveryKit(vaultRef.current, keyRef.current, versionRef.current, masterPassword);
    adopt(made);
    vaultRef.current = made.vault;
    dispatch({ type: 'SET_RECOVERY', payload: { key: made.recoveryKey, has: true } });
  };

  const recoverVault = async (recoveryKey: string, newMasterPassword: string) => {
    if (!isAuthenticated) throw new Error('Please sign in first');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const opened = await recoverWithKit(recoveryKey, newMasterPassword);
      keyRef.current = null;
      adopt(opened);
      vaultRef.current = opened.vault;
      dispatch({ type: 'SET_RECOVERY', payload: { key: opened.recoveryKey, has: true } });
      dispatch({ type: 'UNLOCK_VAULT', payload: { vault: opened.vault } });
    } catch (error) {
      if (error instanceof MfaRequiredError) { dispatch({ type: 'SET_2FA', payload: 'required' }); throw error; }
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  /** Uploads the latest copy. Saves run one at a time; edits made meanwhile ride along on the next one. */
  const flush = useCallback((): Promise<void> => {
    pendingRef.current = true;
    const run = async () => {
      if (!pendingRef.current || !vaultRef.current || !keyRef.current) return;
      pendingRef.current = false;
      const sent = vaultRef.current;
      dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'syncing' } });
      try {
        const saved = await saveVault(sent, keyRef.current, versionRef.current);
        if (saved.key.header.wk.ct !== keyRef.current?.header.wk.ct) remember(saved.key);
        keyRef.current = saved.key;
        versionRef.current = saved.serverVersion;
        if (vaultRef.current) {
          // Bring in other devices' changes without losing edits made while uploading.
          const latest = vaultRef.current === sent ? saved.vault : mergeVaults(vaultRef.current, saved.vault);
          if (latest !== vaultRef.current) setVault(latest);
        }
        dispatch({ type: 'SET_SYNC_STATUS', payload: saved.offline ? { status: 'offline' } : { status: 'synced', lastSynced: new Date() } });
      } catch {
        pendingRef.current = true;
        dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'failed' } });
      }
    };
    const p = queueRef.current.then(run, run);
    queueRef.current = p;
    return p;
  }, []);

  const commit = async (change: (v: VaultData) => VaultData) => {
    if (!vaultRef.current || !keyRef.current) throw new Error('Unlock the vault first');
    setVault(change(vaultRef.current));
    await flush();
  };

  const addEntry = (entry: NewEntry) => commit((v) => VaultService.addEntry(v, entry));
  const updateEntry = (entryId: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>) =>
    commit((v) => VaultService.updateEntry(v, entryId, updates));
  const deleteEntry = async (entryId: string) => {
    const files = vaultRef.current?.entries.find((e) => e.id === entryId)?.attachments ?? [];
    await commit((v) => VaultService.deleteEntry(v, entryId));
    for (const f of files) void databaseAPI.deleteFile(f.id);
  };

  const MAX_FILE = 25 * 1024 * 1024;
  const addAttachment = async (entryId: string, file: File): Promise<Attachment> => {
    if (!keyRef.current || !vaultRef.current) throw new Error('Unlock the vault first');
    if (file.size > MAX_FILE) throw new Error(`${file.name} is larger than 25 MB`);
    const entry = vaultRef.current.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error('Item not found');
    const id = toB64(crypto.getRandomValues(new Uint8Array(18))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const encrypted = await encryptFile(keyRef.current, id, new Uint8Array(await file.arrayBuffer()));
    await databaseAPI.uploadFile(id, encrypted);
    const att: Attachment = { id, name: file.name.slice(0, 200), size: file.size, type: file.type || 'application/octet-stream', addedAt: new Date().toISOString() };
    await commit((v) => VaultService.updateEntry(v, entryId, {
      attachments: [...(v.entries.find((e) => e.id === entryId)?.attachments ?? []), att],
    }));
    return att;
  };

  const openAttachment = async (att: Attachment): Promise<Blob> => {
    if (!keyRef.current) throw new Error('Unlock the vault first');
    const plain = await decryptFile(keyRef.current, att.id, await databaseAPI.downloadFile(att.id));
    return new Blob([plain as BlobPart], { type: att.type || 'application/octet-stream' });
  };

  const removeAttachment = async (entryId: string, attachmentId: string) => {
    await commit((v) => VaultService.updateEntry(v, entryId, {
      attachments: (v.entries.find((e) => e.id === entryId)?.attachments ?? []).filter((a) => a.id !== attachmentId),
    }));
    void databaseAPI.deleteFile(attachmentId);
  };

  const refresh = useCallback(async () => {
    if (!vaultRef.current || !keyRef.current) return;
    await queueRef.current.catch(() => {});
    if (!vaultRef.current || !keyRef.current) return;
    const pulled = await pullVault(vaultRef.current, keyRef.current, versionRef.current).catch(() => null);
    if (!pulled) return;
    if (pulled.key.header.wk.ct !== keyRef.current?.header.wk.ct) remember(pulled.key);
    keyRef.current = pulled.key;
    versionRef.current = pulled.serverVersion;
    setVault(pulled.vault);
    dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'synced', lastSynced: new Date() } });
    if (pendingRef.current) void flush();
  }, [flush]);

  // Pick up other devices' changes when coming back to the app, and retry offline saves.
  useEffect(() => {
    if (!state.isUnlocked) return;
    const onFocus = () => { if (document.visibilityState === 'visible') void (pendingRef.current ? flush() : refresh()); };
    const onOnline = () => { void flush(); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [state.isUnlocked, flush, refresh]);

  const changeMasterPassword = async (current: string, next: string) => {
    if (!keyRef.current || !vaultRef.current) throw new Error('Unlock the vault first');
    await queueRef.current.catch(() => {});
    const header = await rewrapVaultKey(current, next, keyRef.current.header);
    keyRef.current = { key: keyRef.current.key, header };
    remember(keyRef.current);
    pendingRef.current = true;
    vaultRef.current = { ...vaultRef.current, updatedAt: new Date() };
    await flush();
  };

  const getFilteredEntries = (): PasswordEntry[] => {
    if (!state.vault) return [];
    let entries = state.vault.entries;
    if (state.selectedCategory !== 'all') entries = VaultService.filterByCategory(state.vault, state.selectedCategory);
    if (state.searchQuery.trim()) entries = VaultService.searchEntries({ ...state.vault, entries }, state.searchQuery);
    const sorted = [...entries];
    if (state.sortBy === 'updated') sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    else if (state.sortBy === 'newest') sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (state.sortBy === 'alpha') sorted.sort((a, b) => a.website.localeCompare(b.website));
    else if (state.sortBy === 'weakest') {
      const order = { weak: 0, fair: 1, good: 2, strong: 3 };
      sorted.sort((a, b) => order[CryptoService.checkPasswordStrength(a.password).strength] - order[CryptoService.checkPasswordStrength(b.password).strength]);
    }
    return sorted;
  };

  const getCategories = (): string[] => (state.vault ? VaultService.getCategories(state.vault) : []);

  const exportVault = async (): Promise<string> => {
    if (!vaultRef.current || !keyRef.current) throw new Error('No vault available for export');
    return exportBackup(vaultRef.current, keyRef.current);
  };

  const exportVaultCSV = (): string => {
    if (!state.vault) return '';
    const q = (s: string | undefined) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const header = 'name,url,username,password,totp,notes,category,type';
    const rows = state.vault.entries.map((e) =>
      [e.website, e.url, e.username, e.password, e.totp, e.notes, e.category || 'Other', e.type || 'login'].map(q).join(','));
    return [header, ...rows].join('\n');
  };

  const importFromCSV = async (csv: string, mapping?: Record<string, number | null>): Promise<ImportSummary> => {
    if (!vaultRef.current) throw new Error('Unlock the vault first');
    const rows = parseCsv(csv);
    const result = importFromCsv(rows, vaultRef.current.entries, mapping);
    if (result.items.length) await commit((v) => VaultService.addEntries(v, result.items));
    return { imported: result.items.length, skipped: result.skipped, duplicates: result.duplicates, source: result.source };
  };

  const importVault = async (jsonData: string, password?: string) => {
    if (!vaultRef.current) throw new Error('Unlock the vault first');
    if (!password) throw new Error('Enter the master password the backup was made with');
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const backup = await readBackup(jsonData, password);
      await commit((v) => {
        const existing = new Set(v.entries.map((e) => e.id));
        const fresh = backup.entries.filter((e) => !existing.has(e.id));
        return { ...v, entries: [...v.entries, ...fresh], updatedAt: new Date() };
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const hasVault = async (): Promise<boolean> => (isAuthenticated ? vaultExists() : false);

  const findEntriesForCurrentDomain = async (): Promise<PasswordEntry[]> => {
    if (!state.vault) return [];
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) return VaultService.findEntriesForDomain(state.vault, new URL(tab.url).hostname);
      } catch { /* not in the extension */ }
    }
    return [];
  };


  const contextValue: VaultContextType = {
    ...state,
    unlockVault, createVault, lockVault, addEntry, updateEntry, deleteEntry,
    setSearchQuery: (q) => dispatch({ type: 'SET_SEARCH_QUERY', payload: q }),
    setSelectedCategory: (c) => dispatch({ type: 'SET_SELECTED_CATEGORY', payload: c }),
    setSortBy: (s) => dispatch({ type: 'SET_SORT_BY', payload: s }),
    getFilteredEntries, getCategories, exportVault, exportVaultCSV, importVault, importFromCSV,
    changeMasterPassword, refresh, hasVault, findEntriesForCurrentDomain,
    verifySecondFactor, refreshSecondFactor, createRecoveryKit, recoverVault,
    dismissRecoveryKey: () => dispatch({ type: 'SET_RECOVERY', payload: { key: null } }),
    unlockWithDevice,
    getKeyHeader: () => keyRef.current?.header ?? null,
    addAttachment, openAttachment, removeAttachment,
    vaultConflict: null,
    dismissConflict: () => {},
  };

  return <VaultContext.Provider value={contextValue}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) throw new Error('useVault must be used within a VaultProvider');
  return context;
}
