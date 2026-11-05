/**
 * The kinds of item a vault holds, with the names and icons every screen uses
 * (vault tabs, the Create menu, the extension).
 */
import { Key, StickyNote, CreditCard, UserCircle, Wifi, Landmark, IdCard } from 'lucide-react';
import type { DocumentKind, PasswordEntry, VaultItemType } from '@/types/vault';

export interface ItemTypeInfo {
  type: VaultItemType;
  /** One item, as on the Create menu: "Password". */
  label: string;
  /** The tab: "Passwords". */
  plural: string;
  /** What it's for, under the label on the Create menu. */
  hint: string;
  icon: React.ElementType;
  /** Tailwind text colour for the icon. */
  color: string;
}

export const ITEM_TYPES: ItemTypeInfo[] = [
  { type: 'login',    label: 'Password',     plural: 'Passwords',     hint: 'A website or app login',            icon: Key,        color: 'text-primary' },
  { type: 'note',     label: 'Secure note',  plural: 'Secure notes',  hint: 'Codes, answers, anything private',  icon: StickyNote, color: 'text-amber-300' },
  { type: 'card',     label: 'Credit card',  plural: 'Credit cards',  hint: 'Pay faster, get expiry reminders',  icon: CreditCard, color: 'text-sky-300' },
  { type: 'identity', label: 'Contact info', plural: 'Contact info',  hint: 'Name, address, phone for forms',    icon: UserCircle, color: 'text-violet-300' },
  { type: 'document', label: 'Document',     plural: 'Documents',     hint: 'ID card, licence, passport, photos', icon: IdCard,     color: 'text-emerald-300' },
  { type: 'bank',     label: 'Bank account', plural: 'Bank accounts', hint: 'Account number, IBAN, sort code',   icon: Landmark,   color: 'text-orange-300' },
  { type: 'wifi',     label: 'Wi-Fi',        plural: 'Wi-Fi',         hint: 'Network name and password',         icon: Wifi,       color: 'text-cyan-300' },
];

export const ITEM_TYPE: Record<VaultItemType, ItemTypeInfo> =
  Object.fromEntries(ITEM_TYPES.map((t) => [t.type, t])) as Record<VaultItemType, ItemTypeInfo>;

export const typeOf = (e: Pick<PasswordEntry, 'type'>): VaultItemType => e.type ?? 'login';

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: 'id_card', label: 'ID card' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'passport', label: 'Passport' },
  { value: 'residence_permit', label: 'Residence permit' },
  { value: 'other', label: 'Other document' },
];
export const documentKindLabel = (k?: DocumentKind) => DOCUMENT_KINDS.find((d) => d.value === k)?.label ?? 'Document';

export const REMINDER_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: 'No reminder' },
  { days: 7, label: '1 week before' },
  { days: 30, label: '1 month before' },
  { days: 90, label: '3 months before' },
  { days: 180, label: '6 months before' },
];

/** When an item expires, as a date: documents (expiresOn) and cards (MM/YY, end of that month). */
export function expiryOf(e: PasswordEntry): Date | null {
  if (e.type === 'document' && e.document?.expiresOn) {
    const d = new Date(`${e.document.expiresOn}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (e.type === 'card' && e.card?.expiry) {
    const m = e.card.expiry.match(/^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/);
    if (!m) return null;
    const month = Number(m[1]);
    const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    if (month < 1 || month > 12) return null;
    return new Date(year, month, 0, 23, 59, 59); // last day of that month
  }
  return null;
}

/** Days before expiry to start reminding: the document's own setting; cards always get 30. */
export function reminderDays(e: PasswordEntry): number {
  if (e.type === 'document') return e.document?.remindDays ?? 0;
  if (e.type === 'card') return 30;
  return 0;
}
