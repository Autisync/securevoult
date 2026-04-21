'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { VaultData, PasswordEntry, SortBy } from '@/types/vault';
import { VaultService } from '@/lib/vault';
import { useAuth } from '@/contexts/AuthContext';
import { saveVaultToDatabase, loadVaultFromDatabase, VaultVersionConflictError } from '@/lib/vault';
import { CryptoService } from '@/lib/crypto';

export type SyncStatus = 'synced' | 'syncing' | 'failed' | 'offline';

interface VaultState {
  isUnlocked: boolean;
  vault: VaultData | null;
  masterPassword: string | null;
  searchQuery: string;
  selectedCategory: string;
  sortBy: SortBy;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  /** Set when a vault save was rejected due to a server-side version conflict. */
  vaultConflict: { serverVersion: number } | null;
}

type VaultAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UNLOCK_VAULT'; payload: { vault: VaultData; masterPassword: string } }
  | { type: 'LOCK_VAULT' }
  | { type: 'UPDATE_VAULT'; payload: VaultData }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string }
  | { type: 'SET_SORT_BY'; payload: SortBy }
  | { type: 'SET_SYNC_STATUS'; payload: { status: SyncStatus; lastSynced?: Date } }
  | { type: 'SET_CONFLICT'; payload: { serverVersion: number } | null };

const initialState: VaultState = {
  isUnlocked: false,
  vault: null,
  masterPassword: null,
  searchQuery: '',
  selectedCategory: 'all',
  sortBy: 'updated',
  isLoading: false,
  error: null,
  syncStatus: 'synced',
  lastSynced: null,
  vaultConflict: null,
};

function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'UNLOCK_VAULT':
      return {
        ...state,
        isUnlocked: true,
        vault: action.payload.vault,
        masterPassword: action.payload.masterPassword,
        error: null,
      };
    case 'LOCK_VAULT':
      return {
        ...initialState,
      };
    case 'UPDATE_VAULT':
      return { ...state, vault: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_SELECTED_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_SORT_BY':
      return { ...state, sortBy: action.payload };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload.status, lastSynced: action.payload.lastSynced ?? state.lastSynced };
    case 'SET_CONFLICT':
      return { ...state, vaultConflict: action.payload };
    default:
      return state;
  }
}

interface VaultContextType extends VaultState {
  unlockVault: (masterPassword: string) => Promise<void>;
  createVault: (masterPassword: string) => Promise<void>;
  lockVault: () => void;
  addEntry: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEntry: (entryId: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setSortBy: (sortBy: SortBy) => void;
  getFilteredEntries: () => PasswordEntry[];
  getCategories: () => string[];
  exportVault: () => Promise<string>;
  exportVaultCSV: () => string;
  importVault: (jsonData: string) => Promise<void>;
  importFromCSV: (csv: string, mapping?: Record<string, number | null>) => Promise<{ imported: number; skipped: number }>;
  hasVault: () => Promise<boolean>;
  findEntriesForCurrentDomain: () => Promise<PasswordEntry[]>;
  /** Non-null when the server rejected a save due to a version conflict. */
  vaultConflict: { serverVersion: number } | null;
  dismissConflict: () => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(vaultReducer, initialState);
  const { user, isAuthenticated } = useAuth();

  // Lock vault when user signs out
  useEffect(() => {
    if (!isAuthenticated && state.isUnlocked) {
      dispatch({ type: 'LOCK_VAULT' });
    }
  }, [isAuthenticated, state.isUnlocked]);

  const unlockVault = async (masterPassword: string) => {
    if (!isAuthenticated) {
      throw new Error('Please sign in first');
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const vault = await VaultService.loadVault(masterPassword);
      if (!vault) {
        throw new Error('No vault found');
      }
      dispatch({ type: 'UNLOCK_VAULT', payload: { vault, masterPassword } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to unlock vault' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createVault = async (masterPassword: string) => {
    if (!isAuthenticated) {
      throw new Error('Please sign in first');
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const vault = VaultService.createEmptyVault();
      await VaultService.saveVault(vault, masterPassword);
      dispatch({ type: 'UNLOCK_VAULT', payload: { vault, masterPassword } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create vault' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const lockVault = () => {
    dispatch({ type: 'LOCK_VAULT' });
  };

  /** Fire-and-forget server sync. Surfaces version conflicts via state.vaultConflict. */
  const syncToServer = async (vault: VaultData, masterPassword: string) => {
    try {
      // clientVersion is intentionally omitted here — we pass undefined so the
      // server only does conflict detection when the client explicitly opts in.
      // If you add a numeric version counter to VaultData, pass it here.
      await saveVaultToDatabase(vault, masterPassword);
    } catch (err) {
      if (err instanceof VaultVersionConflictError) {
        dispatch({ type: 'SET_CONFLICT', payload: { serverVersion: err.serverVersion } });
      }
      // Non-conflict server errors are non-fatal — vault is already saved locally
    }
  };

  const addEntry = async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!state.vault || !state.masterPassword) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'syncing' } });
    try {
      const updatedVault = VaultService.addEntry(state.vault, entry);
      await VaultService.saveVault(updatedVault, state.masterPassword);
      dispatch({ type: 'UPDATE_VAULT', payload: updatedVault });
      dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'synced', lastSynced: new Date() } });
      void syncToServer(updatedVault, state.masterPassword);
    } catch (error) {
      dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'failed' } });
      throw error;
    }
  };

  const updateEntry = async (entryId: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>) => {
    if (!state.vault || !state.masterPassword) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'syncing' } });
    try {
      const updatedVault = VaultService.updateEntry(state.vault, entryId, updates);
      await VaultService.saveVault(updatedVault, state.masterPassword);
      dispatch({ type: 'UPDATE_VAULT', payload: updatedVault });
      dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'synced', lastSynced: new Date() } });
      void syncToServer(updatedVault, state.masterPassword);
    } catch (error) {
      dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'failed' } });
      throw error;
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!state.vault || !state.masterPassword) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'syncing' } });
    try {
      const updatedVault = VaultService.deleteEntry(state.vault, entryId);
      await VaultService.saveVault(updatedVault, state.masterPassword);
      dispatch({ type: 'UPDATE_VAULT', payload: updatedVault });
      dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'synced', lastSynced: new Date() } });
      void syncToServer(updatedVault, state.masterPassword);
    } catch (error) {
      dispatch({ type: 'SET_SYNC_STATUS', payload: { status: 'failed' } });
      throw error;
    }
  };

  const dismissConflict = () => dispatch({ type: 'SET_CONFLICT', payload: null });

  const setSearchQuery = (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  };

  const setSelectedCategory = (category: string) => {
    dispatch({ type: 'SET_SELECTED_CATEGORY', payload: category });
  };

  const setSortBy = (sortBy: SortBy) => {
    dispatch({ type: 'SET_SORT_BY', payload: sortBy });
  };

  const getFilteredEntries = (): PasswordEntry[] => {
    if (!state.vault) return [];

    let entries = state.vault.entries;

    // Filter by category
    if (state.selectedCategory !== 'all') {
      entries = VaultService.filterByCategory(state.vault, state.selectedCategory);
    }

    // Filter by search query
    if (state.searchQuery.trim()) {
      entries = VaultService.searchEntries({ ...state.vault, entries }, state.searchQuery);
    }

    // Sort
    const sorted = [...entries];
    if (state.sortBy === 'updated') {
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (state.sortBy === 'newest') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (state.sortBy === 'alpha') {
      sorted.sort((a, b) => a.website.localeCompare(b.website));
    } else if (state.sortBy === 'weakest') {
      const order = { weak: 0, fair: 1, good: 2, strong: 3 };
      sorted.sort((a, b) => {
        const sa = CryptoService.checkPasswordStrength(a.password).strength;
        const sb = CryptoService.checkPasswordStrength(b.password).strength;
        return order[sa] - order[sb];
      });
    }
    return sorted;
  };

  const getCategories = (): string[] => {
    if (!state.vault) return [];
    return VaultService.getCategories(state.vault);
  };

  const exportVault = async (): Promise<string> => {
    if (!state.vault || !state.masterPassword) {
      throw new Error('No vault available for export');
    }
    return VaultService.exportVault(state.vault, state.masterPassword);
  };

  const exportVaultCSV = (): string => {
    if (!state.vault) return '';
    const header = 'name,url,username,password,notes,category,type';
    const rows = state.vault.entries.map(e => [
      `"${(e.website || '').replace(/"/g, '""')}"`,
      `"${(e.url || '').replace(/"/g, '""')}"`,
      `"${(e.username || '').replace(/"/g, '""')}"`,
      `"${(e.password || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${(e.category || 'Other').replace(/"/g, '""')}"`,
      `"${(e.type || 'login')}"`,
    ].join(','));
    return [header, ...rows].join('\n');
  };

  const importFromCSV = async (csv: string, mapping?: Record<string, number | null>): Promise<{ imported: number; skipped: number }> => {
    if (!state.masterPassword) throw new Error('Master password required');
    const lines = csv.split('\n').filter(Boolean);
    if (lines.length < 2) throw new Error('CSV appears empty or invalid');
    // Parse header (used only when no explicit mapping provided)
    const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const findIdx = (...terms: string[]) => header.findIndex(h => terms.includes(h));
    const nameIdx  = mapping?.website  ?? findIdx('name', 'title', 'website', 'site');
    const urlIdx   = mapping?.url      ?? findIdx('url', 'login_uri', 'uri', 'website_url');
    const userIdx  = mapping?.username ?? findIdx('username', 'login_username', 'user', 'email', 'login');
    const passIdx  = mapping?.password ?? findIdx('password', 'login_password', 'pass');
    const notesIdx = mapping?.notes    ?? findIdx('notes', 'note', 'comments');
    const catIdx   = findIdx('category', 'folder', 'group', 'type');
    if (nameIdx === null || nameIdx < 0) throw new Error('No name/title column found in CSV');
    let imported = 0; let skipped = 0;
    let currentVault = state.vault!;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g)?.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
      const name = cols[nameIdx as number]?.trim();
      if (!name) { skipped++; continue; }
      const password = (passIdx !== null && passIdx >= 0) ? (cols[passIdx as number]?.trim() ?? '') : '';
      const entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'login',
        website: name || 'Imported entry',
        url: (urlIdx !== null && urlIdx >= 0) ? cols[urlIdx as number]?.trim() : undefined,
        username: (userIdx !== null && userIdx >= 0) ? (cols[userIdx as number]?.trim() || '') : '',
        password,
        notes: (notesIdx !== null && notesIdx >= 0) ? cols[notesIdx as number]?.trim() : undefined,
        category: catIdx >= 0 ? (cols[catIdx]?.trim() || 'Other') : 'Other',
      };
      currentVault = VaultService.addEntry(currentVault, entry);
      imported++;
    }
    await VaultService.saveVault(currentVault, state.masterPassword);
    dispatch({ type: 'UPDATE_VAULT', payload: currentVault });
    return { imported, skipped };
  };

  const importVault = async (jsonData: string) => {
    if (!state.masterPassword) {
      throw new Error('Master password required for import');
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const importedVault = await VaultService.importVault(jsonData, state.masterPassword);
      
      // Merge with existing vault if present
      let finalVault = importedVault;
      if (state.vault) {
        const existingIds = new Set(state.vault.entries.map(e => e.id));
        const newEntries = importedVault.entries.filter(e => !existingIds.has(e.id));
        
        finalVault = {
          ...state.vault,
          entries: [...state.vault.entries, ...newEntries],
          updatedAt: new Date()
        };
      }

      await VaultService.saveVault(finalVault, state.masterPassword);
      dispatch({ type: 'UPDATE_VAULT', payload: finalVault });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to import vault' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const hasVault = async (): Promise<boolean> => {
    if (!isAuthenticated) return false;
    return await VaultService.hasVault();
  };

  const findEntriesForCurrentDomain = async (): Promise<PasswordEntry[]> => {
    if (!state.vault) return [];
    
    // Get current tab URL if in extension context
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const domain = new URL(tab.url).hostname.replace('www.', '');
          return VaultService.findEntriesForDomain(state.vault, domain);
        }
      } catch (error) {
        console.error('Failed to get current tab:', error);
      }
    }
    
    return [];
  };

  const contextValue: VaultContextType = {
    ...state,
    unlockVault,
    createVault,
    lockVault,
    addEntry,
    updateEntry,
    deleteEntry,
    setSearchQuery,
    setSelectedCategory,
    setSortBy,
    getFilteredEntries,
    getCategories,
    exportVault,
    exportVaultCSV,
    importVault,
    importFromCSV,
    hasVault,
    findEntriesForCurrentDomain,
    vaultConflict: state.vaultConflict,
    dismissConflict,
  };

  return (
    <VaultContext.Provider value={contextValue}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}