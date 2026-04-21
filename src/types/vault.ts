export type VaultItemType = 'login' | 'note' | 'card' | 'identity' | 'wifi';

export interface PasswordEntry {
  id: string;
  type: VaultItemType;
  website: string;
  url?: string;
  username: string;
  password: string;
  notes?: string;
  category: string;
  tags?: string[];
  isFavorite?: boolean;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultData {
  entries: PasswordEntry[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EncryptedVault {
  data: string; // encrypted JSON
  salt: string;
  iv: string;
  version: string;
}

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
}

export type SortBy = 'updated' | 'alpha' | 'newest' | 'weakest';

export interface VaultPreferences {
  autoLockMinutes: number;
  defaultPasswordLength: number;
  defaultUppercase: boolean;
  defaultNumbers: boolean;
  defaultSymbols: boolean;
  compactView: boolean;
  clipboardTimeoutSeconds: number;
}