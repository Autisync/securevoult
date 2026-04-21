// Mobile storage adapter using Expo SecureStore
export class MobileStorageService {
  private static readonly STORAGE_KEY = 'password_vault';

  // Save encrypted vault to secure storage
  static async saveVault(encryptedVault: any): Promise<void> {
    try {
      // Check if we're in a mobile environment
      if (typeof window !== 'undefined' && window.ExpoSecureStore) {
        await window.ExpoSecureStore.setItemAsync(this.STORAGE_KEY, JSON.stringify(encryptedVault));
      } else {
        // Fallback to localStorage for web
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(encryptedVault));
      }
    } catch (error) {
      console.error('Failed to save vault:', error);
      throw new Error('Failed to save vault to secure storage');
    }
  }

  // Load encrypted vault from secure storage
  static async loadVault(): Promise<any | null> {
    try {
      if (typeof window !== 'undefined' && window.ExpoSecureStore) {
        const stored = await window.ExpoSecureStore.getItemAsync(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      } else {
        // Fallback to localStorage for web
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      }
    } catch (error) {
      console.error('Failed to load vault:', error);
      return null;
    }
  }

  // Check if vault exists
  static async hasVault(): Promise<boolean> {
    const vault = await this.loadVault();
    return vault !== null;
  }

  // Clear vault data
  static async clearVault(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.ExpoSecureStore) {
        await window.ExpoSecureStore.deleteItemAsync(this.STORAGE_KEY);
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to clear vault:', error);
    }
  }
}

// Mobile-specific utilities
export class MobileUtils {
  // Copy to clipboard
  static async copyToClipboard(text: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.ExpoClipboard) {
        await window.ExpoClipboard.setStringAsync(text);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard not available');
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      throw error;
    }
  }

  // Open URL
  static async openURL(url: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.ExpoLinking) {
        await window.ExpoLinking.openURL(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  }

  // Check if running on mobile
  static isMobile(): boolean {
    return typeof window !== 'undefined' && (
      window.ExpoSecureStore !== undefined ||
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }

  // Get platform
  static getPlatform(): 'web' | 'mobile' | 'extension' {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return 'extension';
    } else if (this.isMobile()) {
      return 'mobile';
    } else {
      return 'web';
    }
  }
}

// Declare global types for Expo modules
declare global {
  interface Window {
    ExpoSecureStore?: {
      setItemAsync: (key: string, value: string) => Promise<void>;
      getItemAsync: (key: string) => Promise<string | null>;
      deleteItemAsync: (key: string) => Promise<void>;
    };
    ExpoClipboard?: {
      setStringAsync: (text: string) => Promise<void>;
    };
    ExpoLinking?: {
      openURL: (url: string) => Promise<void>;
    };
  }
}