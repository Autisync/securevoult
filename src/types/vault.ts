export type VaultItemType = 'login' | 'note' | 'card' | 'identity' | 'wifi' | 'bank' | 'document';

export type DocumentKind = 'id_card' | 'driving_licence' | 'passport' | 'residence_permit' | 'other';

/** ID card, driving licence, passport…: the photos are kept as attachments. */
export interface DocumentDetails {
  kind?: DocumentKind;
  fullName?: string;
  number?: string;
  /** Issuing country or authority. */
  issuedBy?: string;
  /** YYYY-MM-DD */
  issuedOn?: string;
  /** YYYY-MM-DD */
  expiresOn?: string;
  /** Remind this many days before it expires (0 or missing = no reminder). */
  remindDays?: number;
}

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

export interface BankDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  /** UK sort code, e.g. 12-34-56 */
  sortCode?: string;
  iban?: string;
  swift?: string;
  /** Online banking or phone-banking PIN */
  pin?: string;
  branch?: string;
}

export interface WifiDetails {
  ssid?: string;
  security?: string;
}

/** A file kept with an item. The bytes are stored encrypted on the server; only this description lives in the vault. */
export interface Attachment {
  id: string;
  name: string;
  /** Bytes before encryption. */
  size: number;
  /** MIME type, e.g. application/pdf */
  type: string;
  addedAt: string;
}

/** A website passkey kept in the vault (the private key never leaves the encrypted vault). */
export interface PasskeyCredential {
  credentialId: string; // base64url
  rpId: string;
  rpName?: string;
  userHandle: string; // base64url
  userName: string;
  userDisplayName?: string;
  privateKey: string; // PKCS#8, base64url
  alg: -7;
  counter: number;
  createdAt: string;
  lastUsedAt?: string;
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
  bank?: BankDetails;
  wifi?: WifiDetails;
  document?: DocumentDetails;
  fields?: CustomField[];
  attachments?: Attachment[];
  passkeys?: PasskeyCredential[];
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
  /** Deleted items, kept 30 days so they can be restored. */
  trash?: TrashedEntry[];
  /** Trash item id → when it was deleted for good, so a sync doesn't bring it back. */
  purged?: Record<string, string>;
}

export interface TrashedEntry {
  entry: PasswordEntry;
  trashedAt: string;
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