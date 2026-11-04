'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { PasswordEntry, VaultItemType, CardDetails, IdentityDetails, CustomField, BankDetails } from '@/types/vault';
import { parseTotp } from '@/lib/totp';
import { CryptoService } from '@/lib/crypto';
import { useVault } from '@/contexts/VaultContext';
import { Eye, EyeOff, RefreshCw, Copy, Check, Loader2, Key, StickyNote, CreditCard, UserCircle, Wifi, AlertTriangle, Star, Plus, Trash2, ShieldCheck, Landmark } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getVaultPreference } from '@/hooks/useVaultPreferences';

interface EntryFormProps {
  entry?: PasswordEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CATEGORIES = ['Social Media', 'Email', 'Banking', 'Shopping', 'Work', 'Entertainment', 'Other'];

interface TypeConfig {
  icon: React.ElementType;
  label: string;
  websiteLabel: string;
  websitePlaceholder: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  showUrl: boolean;
  showUsername: boolean;
  showPassword: boolean;
  canGenerate: boolean;
  passwordRequired: boolean;
  usernameRequired: boolean;
}

const TYPE_CONFIGS: Record<VaultItemType, TypeConfig> = {
  login: {
    icon: Key,
    label: 'Login',
    websiteLabel: 'Name',
    websitePlaceholder: 'Google, GitHub…',
    usernameLabel: 'Username / Email',
    usernamePlaceholder: 'your@email.com',
    passwordLabel: 'Password',
    showUrl: true,
    showUsername: true,
    showPassword: true,
    canGenerate: true,
    passwordRequired: true,
    usernameRequired: true,
  },
  note: {
    icon: StickyNote,
    label: 'Secure note',
    websiteLabel: 'Title',
    websitePlaceholder: 'My secure note…',
    usernameLabel: '',
    usernamePlaceholder: '',
    passwordLabel: '',
    showUrl: false,
    showUsername: false,
    showPassword: false,
    canGenerate: false,
    passwordRequired: false,
    usernameRequired: false,
  },
  card: {
    icon: CreditCard,
    label: 'Payment card',
    websiteLabel: 'Card name',
    websitePlaceholder: 'Visa Debit, Mastercard…',
    usernameLabel: '',
    usernamePlaceholder: '',
    passwordLabel: '',
    showUrl: false,
    showUsername: false,
    showPassword: false,
    canGenerate: false,
    passwordRequired: false,
    usernameRequired: false,
  },
  identity: {
    icon: UserCircle,
    label: 'Identity',
    websiteLabel: 'Identity name',
    websitePlaceholder: 'Personal, Work…',
    usernameLabel: '',
    usernamePlaceholder: '',
    passwordLabel: '',
    showUrl: false,
    showUsername: false,
    showPassword: false,
    canGenerate: false,
    passwordRequired: false,
    usernameRequired: false,
  },
  bank: {
    icon: Landmark,
    label: 'Bank account',
    websiteLabel: 'Name',
    websitePlaceholder: 'Business current account…',
    usernameLabel: '',
    usernamePlaceholder: '',
    passwordLabel: '',
    showUrl: true,
    showUsername: false,
    showPassword: false,
    canGenerate: false,
    passwordRequired: false,
    usernameRequired: false,
  },
  wifi: {
    icon: Wifi,
    label: 'Wi-Fi',
    websiteLabel: 'Network name (SSID)',
    websitePlaceholder: 'HomeNetwork_5G…',
    usernameLabel: '',
    usernamePlaceholder: '',
    passwordLabel: 'Wi-Fi password',
    showUrl: false,
    showUsername: false,
    showPassword: true,
    canGenerate: true,
    passwordRequired: false,
    usernameRequired: false,
  },
};

const ITEM_TYPES: VaultItemType[] = ['login', 'note', 'card', 'bank', 'identity', 'wifi'];

const emptyForm = () => ({
  type: (getVaultPreference('defaultEntryType') ?? 'login') as VaultItemType,
  website: '', url: '', urls: '', username: '', password: '', totp: '', notes: '', category: 'Other', tags: '', isFavorite: false,
  card: {} as CardDetails,
  identity: {} as IdentityDetails,
  bank: {} as BankDetails,
  fields: [] as CustomField[],
});

const CARD_FIELDS: { key: keyof CardDetails; label: string; placeholder: string; secret?: boolean; half?: boolean; mono?: boolean }[] = [
  { key: 'holder', label: 'Name on card', placeholder: 'Full name' },
  { key: 'number', label: 'Card number', placeholder: '1234 5678 9012 3456', secret: true, mono: true },
  { key: 'expiry', label: 'Expiry', placeholder: 'MM/YY', half: true, mono: true },
  { key: 'cvv', label: 'Security code', placeholder: 'CVV', secret: true, half: true, mono: true },
  { key: 'pin', label: 'PIN', placeholder: 'Optional', secret: true, half: true, mono: true },
  { key: 'postcode', label: 'Billing postcode', placeholder: 'Optional', half: true },
];

const BANK_FIELDS: { key: keyof BankDetails; label: string; placeholder: string; secret?: boolean; half?: boolean; mono?: boolean }[] = [
  { key: 'bankName', label: 'Bank', placeholder: 'Barclays, Millennium BCP, BAI…', half: true },
  { key: 'accountName', label: 'Account name', placeholder: 'Name on the account', half: true },
  { key: 'sortCode', label: 'Sort code', placeholder: '12-34-56', half: true, mono: true },
  { key: 'accountNumber', label: 'Account number', placeholder: '12345678', secret: true, half: true, mono: true },
  { key: 'iban', label: 'IBAN', placeholder: 'GB00 XXXX 0000 0000 0000 00', secret: true, mono: true },
  { key: 'swift', label: 'SWIFT / BIC', placeholder: 'XXXXGB2L', half: true, mono: true },
  { key: 'pin', label: 'PIN', placeholder: 'Optional', secret: true, half: true, mono: true },
  { key: 'branch', label: 'Branch', placeholder: 'Optional' },
];

const IDENTITY_FIELDS: { key: keyof IdentityDetails; label: string; placeholder: string; half?: boolean }[] = [
  { key: 'fullName', label: 'Full name', placeholder: 'As on documents' },
  { key: 'email', label: 'Email', placeholder: 'name@example.com', half: true },
  { key: 'phone', label: 'Phone', placeholder: '+44…', half: true },
  { key: 'address1', label: 'Address', placeholder: 'Street and number' },
  { key: 'address2', label: 'Address line 2', placeholder: 'Optional' },
  { key: 'city', label: 'City', placeholder: '', half: true },
  { key: 'postcode', label: 'Postcode', placeholder: '', half: true },
  { key: 'state', label: 'County / province', placeholder: '', half: true },
  { key: 'country', label: 'Country', placeholder: '', half: true },
  { key: 'company', label: 'Company', placeholder: 'Optional', half: true },
  { key: 'birthDate', label: 'Date of birth', placeholder: 'DD/MM/YYYY', half: true },
  { key: 'documentNumber', label: 'Passport / ID number', placeholder: 'Optional' },
];

const clean = <T extends object>(o: T): T | undefined => {
  const entries = Object.entries(o).filter(([, v]) => typeof v === 'string' ? v.trim() !== '' : v != null);
  return entries.length ? (Object.fromEntries(entries.map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as T) : undefined;
};

export function EntryForm({ entry, open, onOpenChange }: EntryFormProps) {
  const [formData, setFormData] = useState(() => emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDuplicateDetail, setShowDuplicateDetail] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { addEntry, updateEntry, getCategories, vault } = useVault();
  const { toast } = useToast();

  const isEditing = !!entry;
  const cfg = TYPE_CONFIGS[formData.type];
  const passwordStrength = formData.password ? CryptoService.checkPasswordStrength(formData.password) : null;
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...getCategories()])).sort();

  // Duplicate-password detection: find other entries sharing the same password
  const duplicateOf = formData.password
    ? vault?.entries.filter(
        e => e.password && e.password === formData.password && e.id !== entry?.id
      ) ?? []
    : [];

  useEffect(() => {
    if (open) {
      if (entry) {
        setFormData({
          type: entry.type ?? 'login',
          website: entry.website,
          url: entry.url || '',
          urls: (entry.urls ?? []).join('\n'),
          username: entry.username,
          password: entry.password,
          totp: entry.totp ?? '',
          notes: entry.notes || '',
          category: entry.category,
          tags: (entry.tags ?? []).join(', '),
          isFavorite: entry.isFavorite ?? false,
          // Cards and identities saved before these sections existed kept the
          // name/number in the username/password slots.
          card: entry.card ?? (entry.type === 'card' ? { holder: entry.username || undefined, number: entry.password || undefined } : {}),
          identity: entry.identity ?? (entry.type === 'identity' ? { fullName: entry.username || undefined } : {}),
          bank: entry.bank ?? {},
          fields: entry.fields ?? [],
        });
      } else {
        setFormData(emptyForm());
      }
      setShowPassword(false);
      setCopied(false);
      setShowDuplicateDetail(false);
      setTouched({});
    }
  }, [open, entry]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }));

  const touch = (key: string) => () => setTouched(prev => ({ ...prev, [key]: true }));

  // Inline validation
  const errors: Record<string, string> = {};
  const totpInvalid = !!formData.totp.trim() && !parseTotp(formData.totp);
  if (totpInvalid) errors.totp = 'Paste the setup key or the otpauth:// link from the site';
  if (touched.website && !formData.website.trim()) errors.website = `${cfg.websiteLabel} is required`;
  if (touched.username && cfg.usernameRequired && !formData.username.trim()) errors.username = `${cfg.usernameLabel} is required`;
  if (touched.password && cfg.passwordRequired && !formData.password.trim()) errors.password = `${cfg.passwordLabel} is required`;

  const handleTypeChange = (t: VaultItemType) => {
    setFormData(prev => ({ ...prev, type: t }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mark all relevant fields touched to show inline errors
    const newTouched: Record<string, boolean> = { website: true };
    if (cfg.usernameRequired) newTouched.username = true;
    if (cfg.passwordRequired) newTouched.password = true;
    setTouched(newTouched);

    if (!formData.website.trim()) return;
    if (cfg.usernameRequired && !formData.username.trim()) return;
    if (cfg.passwordRequired && !formData.password.trim()) return;
    if (totpInvalid) return;
    setIsLoading(true);
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      const t = formData.type;
      const urls = formData.urls.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
      const fields = formData.fields.filter(f => f.label.trim() || f.value.trim());
      const payload = {
        type: t,
        website: formData.website,
        url: cfg.showUrl ? formData.url || undefined : undefined,
        urls: t === 'login' && urls.length ? urls : undefined,
        username: cfg.showUsername ? formData.username : '',
        password: cfg.showPassword ? formData.password : '',
        totp: t === 'login' && formData.totp.trim() ? formData.totp.trim() : undefined,
        card: t === 'card' ? clean(formData.card) : undefined,
        identity: t === 'identity' ? clean(formData.identity) : undefined,
        bank: t === 'bank' ? clean(formData.bank) : undefined,
        fields: fields.length ? fields : undefined,
        notes: formData.notes || undefined,
        category: formData.category,
        tags: tags.length > 0 ? tags : undefined,
        isFavorite: formData.isFavorite,
      };
      if (isEditing) {
        await updateEntry(entry.id, payload);
        toast({ title: 'Entry updated' });
      } else {
        await addEntry(payload);
        toast({ title: 'Entry added', description: 'Saved to your encrypted vault.' });
      }
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    const len = getVaultPreference('defaultPasswordLength');
    const upper = getVaultPreference('defaultUppercase');
    const nums  = getVaultPreference('defaultNumbers');
    const syms  = getVaultPreference('defaultSymbols');
    const pw = CryptoService.generatePassword(len, upper, nums, syms);
    setFormData(prev => ({ ...prev, password: pw }));
    setShowPassword(true);
  };

  const handleCopy = async () => {
    if (!formData.password) return;
    try {
      await navigator.clipboard.writeText(formData.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-border bg-[hsl(222_40%_8%)] max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? 'Edit entry' : 'Add new entry'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Type selector */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Item type</Label>
            <div className="flex gap-1.5 flex-wrap">
              {ITEM_TYPES.map(t => {
                const { icon: Icon, label } = TYPE_CONFIGS[t];
                const active = formData.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      active
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-secondary/50 text-muted-foreground border-border/50 hover:text-foreground hover:border-border'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Website / Name + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ef-website" className="text-sm font-medium">{cfg.websiteLabel} <span className="text-destructive">*</span></Label>
              <Input
                id="ef-website"
                value={formData.website}
                onChange={set('website')}
                onBlur={touch('website')}
                placeholder={cfg.websitePlaceholder}
                className={`h-10 bg-secondary/50 border-border/60 focus:border-primary ${errors.website ? 'border-destructive' : ''}`}
                autoFocus
              />
              {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-category" className="text-sm font-medium">Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger id="ef-category" className="h-10 bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* URL */}
          {cfg.showUrl && (
            <div className="space-y-1.5">
              <Label htmlFor="ef-url" className="text-sm font-medium">URL <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input id="ef-url" type="url" value={formData.url} onChange={set('url')} placeholder="https://example.com" className="h-10 bg-secondary/50 border-border/60 focus:border-primary" />
            </div>
          )}

          {/* Username */}
          {cfg.showUsername && (
            <div className="space-y-1.5">
              <Label htmlFor="ef-username" className="text-sm font-medium">
                {cfg.usernameLabel}
                {cfg.usernameRequired && <span className="text-destructive"> *</span>}
                {!cfg.usernameRequired && <span className="text-muted-foreground text-xs font-normal"> (optional)</span>}
              </Label>
              <Input id="ef-username" value={formData.username} onChange={set('username')} onBlur={touch('username')} placeholder={cfg.usernamePlaceholder}
                className={`h-10 bg-secondary/50 border-border/60 focus:border-primary ${errors.username ? 'border-destructive' : ''}`}
                autoComplete="off" />
              {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
            </div>
          )}

          {/* Password */}
          {cfg.showPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="ef-password" className="text-sm font-medium">
                {cfg.passwordLabel}
                {cfg.passwordRequired && <span className="text-destructive"> *</span>}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ef-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={set('password')}
                    onBlur={touch('password')}
                    placeholder={cfg.canGenerate ? 'Enter or generate…' : 'Enter value…'}
                    className={`h-10 pr-20 bg-secondary/50 border-border/60 focus:border-primary font-mono text-sm ${errors.password ? 'border-destructive' : ''}`}
                    autoComplete="new-password"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button type="button" onClick={handleCopy} disabled={!formData.password}
                      className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {cfg.canGenerate && (
                  <Button type="button" variant="outline" size="sm" className="h-10 px-3 border-border/60 hover:border-primary hover:text-primary" onClick={handleGenerate}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Generate
                  </Button>
                )}
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              {formData.password && cfg.canGenerate && passwordStrength && (
                <PasswordStrengthIndicator result={passwordStrength} />
              )}
              {duplicateOf.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 overflow-hidden mt-1">
                  <button
                    type="button"
                    className="w-full flex items-start gap-2 px-3 py-2 text-left"
                    onClick={() => setShowDuplicateDetail(v => !v)}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-amber-300 font-medium flex-1">
                      Reused password — shared with {duplicateOf.length} other {duplicateOf.length === 1 ? 'entry' : 'entries'}
                    </span>
                    <span className="text-[10px] text-amber-400/60 flex-shrink-0">{showDuplicateDetail ? 'Hide' : 'Show'}</span>
                  </button>
                  {showDuplicateDetail && (
                    <div className="px-3 pb-2.5 space-y-1">
                      <p className="text-xs text-amber-300/70">
                        If any of these sites are breached, all accounts sharing this password are at risk. Generate a unique password for each.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {duplicateOf.map(e => (
                          <span key={e.id} className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md">{e.website}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2FA code */}
          {formData.type === 'login' && (
            <div className="space-y-1.5">
              <Label htmlFor="ef-totp" className="text-sm font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />2FA setup key
                <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </Label>
              <Input id="ef-totp" value={formData.totp} onChange={set('totp')} placeholder="Setup key or otpauth:// link"
                className={`h-10 bg-secondary/50 border-border/60 focus:border-primary font-mono text-sm ${errors.totp ? 'border-destructive' : ''}`}
                autoComplete="off" spellCheck={false} />
              {errors.totp
                ? <p className="text-xs text-destructive">{errors.totp}</p>
                : <p className="text-xs text-muted-foreground">When the site shows a QR code, choose “can’t scan it?” to see the key. SecureVoult then shows the 6-digit codes.</p>}
            </div>
          )}

          {formData.type === 'login' && (
            <div className="space-y-1.5">
              <Label htmlFor="ef-urls" className="text-sm font-medium">Also works on <span className="text-muted-foreground text-xs font-normal">(optional, one address per line)</span></Label>
              <Textarea id="ef-urls" value={formData.urls} onChange={set('urls')} rows={formData.urls ? 2 : 1} placeholder="https://other-site.com"
                className="bg-secondary/50 border-border/60 focus:border-primary text-sm resize-none" />
            </div>
          )}

          {formData.type === 'card' && (
            <div className="grid grid-cols-2 gap-3">
              {CARD_FIELDS.map(f => (
                <div key={f.key} className={`space-y-1.5 ${f.half ? '' : 'col-span-2'}`}>
                  <Label htmlFor={`ef-card-${f.key}`} className="text-sm font-medium">{f.label}</Label>
                  <Input id={`ef-card-${f.key}`} value={formData.card[f.key] ?? ''} placeholder={f.placeholder}
                    type={f.secret && !showPassword ? 'password' : 'text'} autoComplete="off"
                    inputMode={f.mono ? 'numeric' : undefined}
                    onChange={e => setFormData(prev => ({ ...prev, card: { ...prev.card, [f.key]: e.target.value } }))}
                    className={`h-10 bg-secondary/50 border-border/60 focus:border-primary text-sm ${f.mono ? 'font-mono' : ''}`} />
                </div>
              ))}
              <button type="button" onClick={() => setShowPassword(v => !v)} className="col-span-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 w-fit">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}{showPassword ? 'Hide' : 'Show'} card number and codes
              </button>
            </div>
          )}

          {formData.type === 'bank' && (
            <div className="grid grid-cols-2 gap-3">
              {BANK_FIELDS.map(f => (
                <div key={f.key} className={`space-y-1.5 ${f.half ? '' : 'col-span-2'}`}>
                  <Label htmlFor={`ef-bank-${f.key}`} className="text-sm font-medium">{f.label}</Label>
                  <Input id={`ef-bank-${f.key}`} value={formData.bank[f.key] ?? ''} placeholder={f.placeholder} autoComplete="off"
                    type={f.secret && !showPassword ? 'password' : 'text'}
                    onChange={e => setFormData(prev => ({ ...prev, bank: { ...prev.bank, [f.key]: e.target.value } }))}
                    className={`h-10 bg-secondary/50 border-border/60 focus:border-primary text-sm ${f.mono ? 'font-mono' : ''}`} />
                </div>
              ))}
              <button type="button" onClick={() => setShowPassword(v => !v)} className="col-span-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 w-fit">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}{showPassword ? 'Hide' : 'Show'} account number and PIN
              </button>
            </div>
          )}

          {formData.type === 'identity' && (
            <div className="grid grid-cols-2 gap-3">
              {IDENTITY_FIELDS.map(f => (
                <div key={f.key} className={`space-y-1.5 ${f.half ? '' : 'col-span-2'}`}>
                  <Label htmlFor={`ef-id-${f.key}`} className="text-sm font-medium">{f.label}</Label>
                  <Input id={`ef-id-${f.key}`} value={formData.identity[f.key] ?? ''} placeholder={f.placeholder} autoComplete="off"
                    onChange={e => setFormData(prev => ({ ...prev, identity: { ...prev.identity, [f.key]: e.target.value } }))}
                    className="h-10 bg-secondary/50 border-border/60 focus:border-primary text-sm" />
                </div>
              ))}
            </div>
          )}

          {/* Extra fields */}
          <div className="space-y-2">
            {formData.fields.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={f.label} placeholder="Field name" aria-label="Field name"
                  onChange={e => setFormData(prev => ({ ...prev, fields: prev.fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))}
                  className="h-9 w-1/3 bg-secondary/50 border-border/60 text-sm" />
                <Input value={f.value} placeholder="Value" aria-label={`${f.label || 'Field'} value`} type={f.hidden && !showPassword ? 'password' : 'text'} autoComplete="off"
                  onChange={e => setFormData(prev => ({ ...prev, fields: prev.fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))}
                  className="h-9 flex-1 bg-secondary/50 border-border/60 text-sm" />
                <button type="button" title={f.hidden ? 'Hidden like a password' : 'Shown as plain text'}
                  onClick={() => setFormData(prev => ({ ...prev, fields: prev.fields.map((x, j) => j === i ? { ...x, hidden: !x.hidden } : x) }))}
                  className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
                  {f.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button type="button" aria-label="Remove field" onClick={() => setFormData(prev => ({ ...prev, fields: prev.fields.filter((_, j) => j !== i) }))}
                  className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, fields: [...prev.fields, { label: '', value: '', hidden: false }] }))}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />Add a field
            </button>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="ef-tags" className="text-sm font-medium">Tags <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Input id="ef-tags" value={formData.tags} onChange={set('tags')} placeholder="work, personal, 2fa…" className="h-10 bg-secondary/50 border-border/60 focus:border-primary text-sm" />
            <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ef-notes" className="text-sm font-medium">
              {formData.type === 'note' ? 'Content' : 'Notes'}
              {' '}<span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Textarea id="ef-notes" value={formData.notes} onChange={set('notes')}
              placeholder={formData.type === 'note' ? 'Write your secure note here…' : 'Security questions, backup codes, extra details…'}
              rows={formData.type === 'note' ? 4 : 2}
              className="bg-secondary/50 border-border/60 focus:border-primary text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isFavorite: !prev.isFavorite }))}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                formData.isFavorite
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                  : 'text-muted-foreground hover:text-foreground border border-border/40'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${formData.isFavorite ? 'fill-current' : ''}`} />
              {formData.isFavorite ? 'Favorited' : 'Add to favorites'}
            </button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="h-10 bg-primary hover:bg-primary/90 font-semibold min-w-[120px]" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? 'Save changes' : 'Add entry'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
