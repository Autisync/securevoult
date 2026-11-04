export type VaultItemType = 'login' | 'note' | 'card' | 'identity' | 'wifi';

export interface CustomField {
  label: string;
  value: string;
  /** Shown as dots until revealed, like a password. */
  hidden?: boolean;
}

export interface CardDetails {
  holder?: string;
  number?: string;
  /** MM/YY */
  expiry?: string;
  cvv?: string;
  pin?: string;
  brand?: string;
  postcode?: string;
}

export interface IdentityDetails {
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  birthDate?: string;
  documentNumber?: string;
}

export interface WifiDetails {
  ssid?: string;
  security?: string;
}

export interface PasswordEntry {
  id: string;
  type: VaultItemType;
  /** Item name. */
  website: string;
  url?: string;
  /** Extra addresses the same login works on (NordPass "additional URLs"). */
  urls?: string[];
  username: string;
  password: string;
  /** 2FA secret: base32 or an otpauth:// link. */
  totp?: string;
  notes?: string;
  card?: CardDetails;
  identity?: IdentityDetails;
  wifi?: WifiDetails;
  fields?: CustomField[];
  /** Previous passwords, newest first (kept 10). */
  passwordHistory?: { password: string; changedAt: string }[];
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
  /** Deleted item id → when it was deleted, so a sync doesn't bring it back. */
  deleted?: Record<string, string>;
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