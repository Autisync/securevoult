'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { PasswordEntry, VaultItemType } from '@/types/vault';
import { CryptoService } from '@/lib/crypto';
import { useVault } from '@/contexts/VaultContext';
import { Eye, EyeOff, RefreshCw, Copy, Check, Loader2, Key, StickyNote, CreditCard, UserCircle, Wifi, AlertTriangle, Star } from 'lucide-react';
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
    usernameLabel: 'Cardholder name',
    usernamePlaceholder: 'Full name on card',
    passwordLabel: 'Card number',
    showUrl: false,
    showUsername: true,
    showPassword: true,
    canGenerate: false,
    passwordRequired: false,
    usernameRequired: false,
  },
  identity: {
    icon: UserCircle,
    label: 'Identity',
    websiteLabel: 'Identity name',
    websitePlaceholder: 'Personal, Work…',
    usernameLabel: 'Full name',
    usernamePlaceholder: 'Your full name',
    passwordLabel: '',
    showUrl: true,
    showUsername: true,
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

const ITEM_TYPES: VaultItemType[] = ['login', 'note', 'card', 'identity', 'wifi'];

const emptyForm = () => ({
  type: (getVaultPreference('defaultEntryType') ?? 'login') as VaultItemType,
  website: '', url: '', username: '', password: '', notes: '', category: 'Other', tags: '', isFavorite: false,
});

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
          username: entry.username,
          password: entry.password,
          notes: entry.notes || '',
          category: entry.category,
          tags: (entry.tags ?? []).join(', '),
          isFavorite: entry.isFavorite ?? false,
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
    setIsLoading(true);
    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      const payload = {
        type: formData.type,
        website: formData.website,
        url: formData.url || undefined,
        username: formData.username,
        password: formData.password,
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
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-border bg-[hsl(222_40%_8%)]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? 'Edit entry' : 'Add new entry'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
