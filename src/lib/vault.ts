import { VaultData, PasswordEntry, EncryptedVault } from '@/types/vault';
import { CryptoService } from './crypto';
import { UniversalStorageService } from './storage';
import { AuthService, getStoredSessionId } from '@/lib/auth';

// Custom error thrown when the server rejects a save due to a version conflict.
export class VaultVersionConflictError extends Error {
  serverVersion: number;
  constructor(serverVersion: number) {
    super('Your vault data is out of date. Please reload to get the latest version before saving.');
    this.name = 'VaultVersionConflictError';
    this.serverVersion = serverVersion;
  }
}

interface DatabaseVaultEntry {
  id: string;
  entryId: string;
  title: string;
  url: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
  lastAccessed: string;
  createdAt: string;
}

interface DatabaseAPI {
  // Vault methods
  syncVault: (encryptedVault: string, token: string, clientVersion?: number) => Promise<{ success: boolean; version?: number; error?: string }>;
  getVault: (token: string) => Promise<{ success: boolean; vault?: { encryptedData: string }; error?: string }>;
  
  // Entry methods
  getEntries: (token: string, category?: string, search?: string) => Promise<{ success: boolean; entries?: DatabaseVaultEntry[]; error?: string }>;
  createEntry: (entry: unknown, token: string) => Promise<{ success: boolean; entryId?: string; error?: string }>;
}

class DatabaseService implements DatabaseAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    try {
      // Get Firebase ID token
      const token = await AuthService.getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const sessionId = getStoredSessionId();

      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
          ...options.headers,
        },
        ...options,
      });

      // Surface vault version conflicts as a typed error
      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        throw new VaultVersionConflictError(data.serverVersion ?? 0);
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? 'Request failed');
      }

      return data;
    } catch (error) {
      if (error instanceof VaultVersionConflictError) throw error;
      console.error(`API Error (${endpoint}):`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async syncVault(encryptedVault: string, _token: string, clientVersion?: number) {
    try {
      const data = await this.makeRequest('/vault', {
        method: 'POST',
        body: JSON.stringify({ encryptedVault, ...(clientVersion !== undefined ? { version: clientVersion } : {}) }),
      });

      return { success: true, version: data.version };
    } catch (error) {
      if (error instanceof VaultVersionConflictError) throw error;
      return { success: false, error: (error as Error).message };
    }
  }

  async getVault(_token: string) {
    try {
      const data = await this.makeRequest('/vault', {
        method: 'GET',
      });

      return { success: true, vault: data.vault };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getEntries(_token: string, category?: string, search?: string) {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);

      const data = await this.makeRequest(`/entries?${params.toString()}`, {
        method: 'GET',
      });

      return { success: true, entries: data.entries };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async createEntry(entry: any, token: string) {
    try {
      const data = await this.makeRequest('/entries', {
        method: 'POST',
        body: JSON.stringify(entry),
      });

      return { success: true, entryId: data.entryId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

// Create singleton instance
export const databaseAPI = new DatabaseService();

// Enhanced vault functions with Firebase + MongoDB sync
/**
 * Save the vault locally AND sync to the server.
 * Throws VaultVersionConflictError if the server has a newer version.
 * Returns true on full success, false if the server sync failed non-fatally.
 */
export async function saveVaultToDatabase(
  vault: VaultData,
  masterPassword: string,
  clientVersion?: number
): Promise<boolean> {
  // Always save locally first — this is the source of truth on the client
  await VaultService.saveVault(vault, masterPassword);

  const token = await AuthService.getIdToken();
  if (!token) {
    // Not authenticated — local save is sufficient; server sync deferred
    return true;
  }

  // Encrypt for server storage
  const vaultJson = JSON.stringify(vault);
  const { encrypted, salt, iv } = await CryptoService.encrypt(vaultJson, masterPassword);
  const encryptedBlob = JSON.stringify({ data: encrypted, salt, iv, version: '1.0.0' });

  // This will throw VaultVersionConflictError on 409 — propagate to caller
  const result = await databaseAPI.syncVault(encryptedBlob, token, clientVersion);
  return result.success;
}

export async function loadVaultFromDatabase(masterPassword: string): Promise<VaultData | null> {
  try {
    const token = await AuthService.getIdToken();
    if (!token) {
      console.warn('No auth token found, loading from local storage');
      return VaultService.loadVault(masterPassword);
    }

    const result = await databaseAPI.getVault(token);

    if (result.success && result.vault?.encryptedData) {
      try {
        const parsed = JSON.parse(result.vault.encryptedData);
        const decrypted = await CryptoService.decrypt(parsed.data, parsed.salt, parsed.iv, masterPassword);
        const vault: VaultData = JSON.parse(decrypted);

        // Convert date strings back to Date objects
        vault.createdAt = new Date(vault.createdAt);
        vault.updatedAt = new Date(vault.updatedAt);
        vault.entries = vault.entries.map((entry: PasswordEntry) => ({
          ...entry,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        }));

        // Update local cache
        await VaultService.saveVault(vault, masterPassword);
        return vault;
      } catch {
        console.warn('Failed to decrypt server vault, falling back to local');
      }
    }

    return VaultService.loadVault(masterPassword);
  } catch (error) {
    console.error('Error loading vault from database:', error);
    return VaultService.loadVault(masterPassword);
  }
}

export class VaultService {
  private static readonly VERSION = '1.0.0';

  // Initialize empty vault
  static createEmptyVault(): VaultData {
    return {
      entries: [],
      version: this.VERSION,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Save encrypted vault using universal storage
  static async saveVault(vault: VaultData, masterPassword: string): Promise<void> {
    const vaultJson = JSON.stringify(vault);
    const { encrypted, salt, iv } = await CryptoService.encrypt(vaultJson, masterPassword);
    
    const encryptedVault: EncryptedVault = {
      data: encrypted,
      salt,
      iv,
      version: this.VERSION
    };

    await UniversalStorageService.saveVault(encryptedVault);
  }

  // Load and decrypt vault using universal storage
  static async loadVault(masterPassword: string): Promise<VaultData | null> {
    const encryptedVault = await UniversalStorageService.loadVault();
    if (!encryptedVault) return null;

    try {
      const decryptedJson = await CryptoService.decrypt(
        encryptedVault.data,
        encryptedVault.salt,
        encryptedVault.iv,
        masterPassword
      );

      const vault: VaultData = JSON.parse(decryptedJson);
      
      // Convert date strings back to Date objects
      vault.createdAt = new Date(vault.createdAt);
      vault.updatedAt = new Date(vault.updatedAt);
      vault.entries = vault.entries.map(entry => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt)
      }));

      return vault;
    } catch (error) {
      console.error('Failed to decrypt vault:', error);
      throw new Error('Invalid master password or corrupted vault');
    }
  }

  // Check if vault exists using universal storage
  static async hasVault(): Promise<boolean> {
    return await UniversalStorageService.hasVault();
  }

  // Add entry to vault
  static addEntry(vault: VaultData, entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>): VaultData {
    const newEntry: PasswordEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return {
      ...vault,
      entries: [...vault.entries, newEntry],
      updatedAt: new Date()
    };
  }

  // Update entry in vault
  static updateEntry(vault: VaultData, entryId: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>): VaultData {
    const entries = vault.entries.map(entry => 
      entry.id === entryId 
        ? { ...entry, ...updates, updatedAt: new Date() }
        : entry
    );

    return {
      ...vault,
      entries,
      updatedAt: new Date()
    };
  }

  // Delete entry from vault
  static deleteEntry(vault: VaultData, entryId: string): VaultData {
    return {
      ...vault,
      entries: vault.entries.filter(entry => entry.id !== entryId),
      updatedAt: new Date()
    };
  }

  // Search entries
  static searchEntries(vault: VaultData, query: string): PasswordEntry[] {
    if (!query.trim()) return vault.entries;

    const searchTerm = query.toLowerCase();
    return vault.entries.filter(entry =>
      entry.website.toLowerCase().includes(searchTerm) ||
      entry.username.toLowerCase().includes(searchTerm) ||
      entry.category.toLowerCase().includes(searchTerm) ||
      entry.notes?.toLowerCase().includes(searchTerm)
    );
  }

  // Filter entries by category
  static filterByCategory(vault: VaultData, category: string): PasswordEntry[] {
    if (category === 'all') return vault.entries;
    return vault.entries.filter(entry => entry.category === category);
  }

  // Get unique categories
  static getCategories(vault: VaultData): string[] {
    const categories = new Set(vault.entries.map(entry => entry.category));
    return Array.from(categories).sort();
  }

  // Find entries matching current domain
  static findEntriesForDomain(vault: VaultData, domain: string): PasswordEntry[] {
    const cleanDomain = domain.replace('www.', '').toLowerCase();
    return vault.entries.filter(entry => {
      const entryDomain = entry.url ? 
        new URL(entry.url).hostname.replace('www.', '').toLowerCase() :
        entry.website.toLowerCase();
      return entryDomain.includes(cleanDomain) || cleanDomain.includes(entryDomain);
    });
  }

  // Export vault as JSON
  static async exportVault(vault: VaultData, masterPassword: string): Promise<string> {
    const exportData = {
      ...vault,
      exportedAt: new Date().toISOString(),
      appVersion: this.VERSION
    };

    const { encrypted, salt, iv } = await CryptoService.encrypt(JSON.stringify(exportData), masterPassword);
    
    return JSON.stringify({
      data: encrypted,
      salt,
      iv,
      version: this.VERSION,
      type: 'password_manager_backup'
    }, null, 2);
  }

  // Import vault from JSON
  static async importVault(jsonData: string, masterPassword: string): Promise<VaultData> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (importData.type !== 'password_manager_backup') {
        throw new Error('Invalid backup file format');
      }

      const decryptedJson = await CryptoService.decrypt(
        importData.data,
        importData.salt,
        importData.iv,
        masterPassword
      );

      const vault: VaultData = JSON.parse(decryptedJson);
      
      // Convert date strings back to Date objects
      vault.createdAt = new Date(vault.createdAt);
      vault.updatedAt = new Date(vault.updatedAt);
      vault.entries = vault.entries.map(entry => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt)
      }));

      return vault;
    } catch (error) {
      console.error('Failed to import vault:', error);
      throw new Error('Invalid backup file or incorrect password');
    }
  }
}