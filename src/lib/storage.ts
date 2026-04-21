// Universal storage service that works across all platforms
import { ExtensionStorageService } from './extension';
import { MobileStorageService, MobileUtils } from './mobile';

export class UniversalStorageService {
  private static getStorageService() {
    const platform = MobileUtils.getPlatform();
    
    switch (platform) {
      case 'extension':
        return ExtensionStorageService;
      case 'mobile':
        return MobileStorageService;
      default:
        return {
          saveVault: (data: any) => {
            localStorage.setItem('password_vault', JSON.stringify(data));
            return Promise.resolve();
          },
          loadVault: () => {
            const stored = localStorage.getItem('password_vault');
            return Promise.resolve(stored ? JSON.parse(stored) : null);
          },
          hasVault: () => {
            return Promise.resolve(localStorage.getItem('password_vault') !== null);
          },
          clearVault: () => {
            localStorage.removeItem('password_vault');
            return Promise.resolve();
          }
        };
    }
  }

  static async saveVault(encryptedVault: any): Promise<void> {
    const service = this.getStorageService();
    return await service.saveVault(encryptedVault);
  }

  static async loadVault(): Promise<any | null> {
    const service = this.getStorageService();
    return await service.loadVault();
  }

  static async hasVault(): Promise<boolean> {
    const service = this.getStorageService();
    return await service.hasVault();
  }

  static async clearVault(): Promise<void> {
    const service = this.getStorageService();
    return await service.clearVault();
  }
}