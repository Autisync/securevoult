'use client';

import { useState } from 'react';
import { useClipboard } from '@/hooks/useClipboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { PasswordEntry, VaultItemType } from '@/types/vault';
import { CryptoService } from '@/lib/crypto';
import { useVault } from '@/contexts/VaultContext';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import {
  X, Copy, Check, Eye, EyeOff, Edit, Trash2, ExternalLink, Star,
  Key, StickyNote, CreditCard, UserCircle, Wifi, Globe, Calendar,
  RefreshCw, Tag, Shield, AlertTriangle
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TYPE_META: Record<VaultItemType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  login:    { icon: Key,        label: 'Login',        color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  note:     { icon: StickyNote, label: 'Secure note',  color: 'text-violet-400', bg: 'bg-violet-500/10' },
  card:     { icon: CreditCard, label: 'Payment card', color: 'text-green-400',  bg: 'bg-green-500/10' },
  identity: { icon: UserCircle, label: 'Identity',     color: 'text-orange-400', bg: 'bg-orange-500/10' },
  wifi:     { icon: Wifi,       label: 'Wi-Fi',        color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
};

const GRADIENTS = [
  'from-blue-500 to-violet-600',
  'from-violet-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-cyan-500 to-blue-600',
];

interface EntryDetailPanelProps {
  entry: PasswordEntry | null;
  onClose: () => void;
  onEdit: (entry: PasswordEntry) => void;
}

export function EntryDetailPanel({ entry, onClose, onEdit }: EntryDetailPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const { copied, copy: clipboardCopy } = useClipboard();
  const { updateEntry, deleteEntry } = useVault();
  const { toast } = useToast();

  if (!entry) return null;

  const type: VaultItemType = entry.type ?? 'login';
  const meta = TYPE_META[type];
  const TypeIcon = meta.icon;
  const letter = (entry.website || '?')[0].toUpperCase();
  const gradient = GRADIENTS[letter.charCodeAt(0) % GRADIENTS.length];
  const strength = entry.password ? CryptoService.checkPasswordStrength(entry.password) : null;

  const faviconUrl = (() => {
    if (!entry.url) return null;
    try { return `https://icons.duckduckgo.com/ip3/${new URL(entry.url).hostname}.ico`; } catch { return null; }
  })();
  const showFavicon = !!faviconUrl && !faviconError;

  const copy = async (text: string, label: string) => {
    const ok = await clipboardCopy(text, label);
    if (ok) {
      toast({ title: `${label} copied` });
      // Track last-used timestamp when copying a credential (password or username)
      if (label === 'Password' || label === 'Username') {
        try {
          await updateEntry(entry.id, { lastUsed: new Date() });
        } catch {
          // Non-critical: don't surface tracking errors to the user
        }
      }
    } else {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const toggleFavorite = async () => {
    try {
      await updateEntry(entry.id, { isFavorite: !entry.isFavorite });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntry(entry.id);
      toast({ title: 'Entry deleted' });
      onClose();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
    setDeleteOpen(false);
  };

  const CopyBtn = ({ value, label }: { value: string; label: string }) => (
    <button
      onClick={() => copy(value, label)}
      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex-shrink-0"
      title={`Copy ${label}`}
    >
      {copied === label ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  const Field = ({ label, value, secret, onReveal, revealed, copyLabel, action }:
    { label: string; value: string; secret?: boolean; onReveal?: () => void; revealed?: boolean; copyLabel?: string; action?: React.ReactNode }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 min-h-[36px]">
        <span className={`flex-1 text-sm break-all ${secret && !revealed ? 'font-mono tracking-widest text-muted-foreground' : ''}`}>
          {secret && !revealed ? '•'.repeat(Math.min(value?.length ?? 0, 16)) : (value || <span className="text-muted-foreground/50 italic">—</span>)}
        </span>
        {action}
        {onReveal && (
          <button onClick={onReveal} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex-shrink-0">
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        {copyLabel && value && <CopyBtn value={value} label={copyLabel} />}
      </div>
    </div>
  );

  return (
    <>
      <div className="w-80 flex-shrink-0 border-l border-border flex flex-col bg-[hsl(222_40%_6%)] overflow-hidden animate-in slide-in-from-right-5 duration-200">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
                {showFavicon ? (
                  <img src={faviconUrl!} alt="" className="w-6 h-6 object-contain" onError={() => setFaviconError(true)} />
                ) : (
                  <span className="text-sm font-bold text-white">{letter}</span>
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border border-border/60 flex items-center justify-center ${meta.bg}`}>
                <TypeIcon className={`w-2.5 h-2.5 ${meta.color}`} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{entry.website}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded ${meta.bg} ${meta.color}`}>{meta.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={toggleFavorite} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title={entry.isFavorite ? 'Remove favorite' : 'Add favorite'}>
              <Star className={`w-4 h-4 ${entry.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Username */}
          {entry.username && (
            <Field label="Username" value={entry.username} copyLabel="Username" />
          )}

          {/* Password */}
          {entry.password && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Password</p>
              <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                <span className={`flex-1 text-sm font-mono break-all ${!showPassword ? 'tracking-widest text-muted-foreground' : ''}`}>
                  {showPassword ? entry.password : '•'.repeat(Math.min(entry.password.length, 16))}
                </span>
                <button onClick={() => setShowPassword(!showPassword)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex-shrink-0">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <CopyBtn value={entry.password} label="Password" />
              </div>
              {showPassword && strength && (
                <div className="mt-1">
                  <PasswordStrengthIndicator result={strength} />
                </div>
              )}
              {strength?.strength === 'weak' && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/8 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Weak password — consider updating it
                </div>
              )}
            </div>
          )}

          {/* URL */}
          {entry.url && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">URL</p>
              <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm text-primary truncate">{entry.url}</span>
                {/^https?:\/\//i.test(entry.url) && (
                  <button onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex-shrink-0" title="Open website">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <CopyBtn value={entry.url} label="URL" />
              </div>
            </div>
          )}

          {/* Notes */}
          {entry.notes && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Notes</p>
              <div className="bg-secondary/30 rounded-lg px-3 py-2.5">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
              </div>
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Category</p>
            <Badge variant="outline" className="text-xs">{entry.category}</Badge>
          </div>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1"><Tag className="w-3 h-3" />Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground border border-border/50">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3" />History</p>
            <div className="bg-secondary/30 rounded-lg px-3 py-2.5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground/60">Created</span>
                <span className="text-muted-foreground">{format(new Date(entry.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground/60">Updated</span>
                <span className="text-muted-foreground">{formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true })}</span>
              </div>
              {entry.lastUsed && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground/60">Last used</span>
                  <span className="text-muted-foreground">{formatDistanceToNow(new Date(entry.lastUsed), { addSuffix: true })}</span>
                </div>
              )}
              {entry.password && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground/60">Password age</span>
                  <span className={`${
                    Date.now() - new Date(entry.updatedAt).getTime() > 180 * 24 * 60 * 60 * 1000
                      ? 'text-red-400' : Date.now() - new Date(entry.updatedAt).getTime() > 90 * 24 * 60 * 60 * 1000
                      ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {formatDistanceToNow(new Date(entry.updatedAt))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Security shield placeholder */}
          {!entry.url && (entry.type === 'login' || !entry.type) && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2.5">
              <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>No URL set — autofill won't work for this entry. <button onClick={() => onEdit(entry)} className="underline hover:no-underline">Add one</button></span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 p-4 border-t border-border/50 space-y-2">
          <Button className="w-full h-9 bg-primary hover:bg-primary/90 text-sm" onClick={() => onEdit(entry)}>
            <Edit className="w-3.5 h-3.5 mr-2" />Edit entry
          </Button>
          <Button variant="outline" className="w-full h-9 text-sm border-border/60 hover:border-destructive/50 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-2" />Delete entry
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{entry.website}</strong> from your vault. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
