/** Item kinds with the names the web app uses, and an icon for each. */
import type { PasswordEntry, VaultItemType } from '../core/types';
import type { IconName } from './kit';

export interface ItemTypeInfo { type: VaultItemType; label: string; plural: string; icon: IconName }

export const ITEM_TYPES: ItemTypeInfo[] = [
  { type: 'login', label: 'Password', plural: 'Passwords', icon: 'key-outline' },
  { type: 'note', label: 'Secure note', plural: 'Notes', icon: 'document-text-outline' },
  { type: 'card', label: 'Credit card', plural: 'Cards', icon: 'card-outline' },
  { type: 'identity', label: 'Contact info', plural: 'Contact info', icon: 'person-circle-outline' },
  { type: 'document', label: 'Document', plural: 'Documents', icon: 'id-card-outline' },
  { type: 'bank', label: 'Bank account', plural: 'Bank accounts', icon: 'business-outline' },
  { type: 'wifi', label: 'Wi-Fi', plural: 'Wi-Fi', icon: 'wifi-outline' },
];

export const ITEM_TYPE = Object.fromEntries(ITEM_TYPES.map((t) => [t.type, t])) as Record<VaultItemType, ItemTypeInfo>;
export const typeOf = (e: Pick<PasswordEntry, 'type'>): VaultItemType => e.type ?? 'login';

/** The line under an item's name in the list. */
export function subtitleOf(e: PasswordEntry): string {
  switch (typeOf(e)) {
    case 'card': return e.card?.number ? `•••• ${e.card.number.replace(/\s/g, '').slice(-4)}` : e.card?.holder ?? '';
    case 'identity': return e.identity?.email || e.identity?.fullName || '';
    case 'bank': return e.bank?.bankName || (e.bank?.accountNumber ? `•••• ${e.bank.accountNumber.slice(-4)}` : '');
    case 'wifi': return e.wifi?.ssid ?? '';
    case 'document': return e.document?.number ? `No. ${e.document.number}` : e.document?.fullName ?? '';
    case 'note': return (e.notes ?? '').split('\n')[0].slice(0, 60);
    // Username and the exact address, so logins on one site (calls. / crm.) can be told apart.
    default: return [e.username, hostLabel(e.url)].filter(Boolean).join(' · ');
  }
}

export function hostLabel(url?: string): string {
  if (!url) return '';
  const m = url.trim().match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/?#:@\s]+)/i);
  return m ? m[1].replace(/^www\./i, '') : '';
}
