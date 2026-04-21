/**
 * Browser Extension — secure storage and autofill helpers.
 *
 * Token handling:
 *   The extension must never store Firebase ID tokens in plain localStorage.
 *   Instead, use chrome.storage.session (cleared when browser closes) for the
 *   short-lived ID token and refresh it via getIdToken() before each API call.
 *   The encrypted vault blob is persisted in chrome.storage.local.
 */

const VAULT_KEY = 'securevoult_encrypted_vault';
const TOKEN_KEY = 'securevoult_session_token';

// ── Vault storage ────────────────────────────────────────────────────────────

export class ExtensionStorageService {
  static async saveVault(encryptedVault: unknown): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [VAULT_KEY]: encryptedVault });
    } else {
      localStorage.setItem(VAULT_KEY, JSON.stringify(encryptedVault));
    }
  }

  static async loadVault(): Promise<unknown | null> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get([VAULT_KEY]);
      return result[VAULT_KEY] ?? null;
    }
    const stored = localStorage.getItem(VAULT_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  static async hasVault(): Promise<boolean> {
    return (await this.loadVault()) !== null;
  }

  static async clearVault(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove([VAULT_KEY]);
    } else {
      localStorage.removeItem(VAULT_KEY);
    }
  }
}

// ── Session token (short-lived, cleared on browser close) ───────────────────

export class ExtensionSessionService {
  /**
   * Store a Firebase ID token in session storage (cleared when browser closes).
   * Prefer chrome.storage.session when available (MV3).
   */
  static async saveToken(idToken: string): Promise<void> {
    if (typeof chrome !== 'undefined' && (chrome.storage as any).session) {
      await (chrome.storage as any).session.set({ [TOKEN_KEY]: idToken });
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      // Fallback: session storage is unavailable, keep in memory only — do NOT
      // persist in local storage as that would be insecure.
      console.warn('[ExtensionSession] session storage unavailable, token not persisted.');
    }
  }

  static async getToken(): Promise<string | null> {
    if (typeof chrome !== 'undefined' && (chrome.storage as any).session) {
      const result = await (chrome.storage as any).session.get([TOKEN_KEY]);
      return result[TOKEN_KEY] ?? null;
    }
    return null;
  }

  static async clearToken(): Promise<void> {
    if (typeof chrome !== 'undefined' && (chrome.storage as any).session) {
      await (chrome.storage as any).session.remove([TOKEN_KEY]);
    }
  }
}

// ── Autofill helpers ─────────────────────────────────────────────────────────

export class AutoFillService {
  static async getCurrentTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  }

  static async fillCredentials(username: string, password: string): Promise<void> {
    const tab = await this.getCurrentTab();
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, {
      action: 'fillCredentials',
      username,
      password,
    });
  }

  /** Extract registrable domain (e.g. "github.com") from a full URL. */
  static extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      // Strip leading www.
      return hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /** Return true if a vault entry URL matches the current page domain. */
  static domainMatches(entryUrl: string, currentUrl: string): boolean {
    if (!entryUrl || !currentUrl) return false;
    try {
      const entryDomain = this.extractDomain(entryUrl);
      const currentDomain = this.extractDomain(currentUrl);
      return entryDomain.length > 0 && currentDomain.endsWith(entryDomain);
    } catch {
      return false;
    }
  }

  /**
   * Retrieve a pending save-login item that was detected by the content script
   * and queued by the background script in chrome.storage.session.
   * Clears the queue after reading so it only fires once.
   */
  static async getPendingSaveLogin(): Promise<{ username: string; password: string; domain: string; url: string; title: string } | null> {
    if (typeof chrome === 'undefined' || !(chrome.storage as any).session) return null;
    try {
      const result = await (chrome.storage as any).session.get(['sv_pending_save']);
      const data = result.sv_pending_save ?? null;
      if (data) await (chrome.storage as any).session.remove(['sv_pending_save']);
      return data;
    } catch {
      return null;
    }
  }
}
