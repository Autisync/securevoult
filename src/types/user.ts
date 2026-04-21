export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface UserPermissions {
  canViewPasswords: boolean;
  canEditPasswords: boolean;
  canDeletePasswords: boolean;
  canCreatePasswords: boolean;
  canManageUsers: boolean;
  canExportVault: boolean;
  canImportVault: boolean;
  allowedCategories: string[];
}

export interface SharedVault {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: VaultMember[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface VaultMember {
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: UserPermissions;
  joinedAt: Date;
  invitedBy: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  vaultId: string;
  vaultName: string;
  invitedBy: string;
  invitedByName: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions: UserPermissions;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  owner: {
    canViewPasswords: true,
    canEditPasswords: true,
    canDeletePasswords: true,
    canCreatePasswords: true,
    canManageUsers: true,
    canExportVault: true,
    canImportVault: true,
    allowedCategories: ['*']
  },
  admin: {
    canViewPasswords: true,
    canEditPasswords: true,
    canDeletePasswords: true,
    canCreatePasswords: true,
    canManageUsers: true,
    canExportVault: true,
    canImportVault: false,
    allowedCategories: ['*']
  },
  editor: {
    canViewPasswords: true,
    canEditPasswords: true,
    canDeletePasswords: false,
    canCreatePasswords: true,
    canManageUsers: false,
    canExportVault: false,
    canImportVault: false,
    allowedCategories: ['*']
  },
  viewer: {
    canViewPasswords: true,
    canEditPasswords: false,
    canDeletePasswords: false,
    canCreatePasswords: false,
    canManageUsers: false,
    canExportVault: false,
    canImportVault: false,
    allowedCategories: ['*']
  }
};