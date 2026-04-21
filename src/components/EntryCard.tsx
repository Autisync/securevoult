'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PasswordEntry, VaultItemType } from '@/types/vault';
import { useVault } from '@/contexts/VaultContext';
import { useToast } from '@/components/ui/use-toast';
import { useClipboard } from '@/hooks/useClipboard';
import { Copy, Edit, Trash2, ExternalLink, Eye, EyeOff, Check, Star, Key, StickyNote, CreditCard, UserCircle, Wifi, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function getFaviconUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const domain = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch {
    return null;
  }
}

const TYPE_ICONS: Record<VaultItemType, React.ElementType> = {
  login: Key,
  note: StickyNote,
  card: CreditCard,
  identity: UserCircle,
  wifi: Wifi,
};

interface EntryCardProps {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
  onTagClick?: (tag: string) => void;
  onClick?: () => void;
  compact?: boolean;
}

export function EntryCard({ entry, onEdit, onTagClick, onClick, compact }: EntryCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const { deleteEntry, updateEntry } = useVault();
  const { toast } = useToast();
  const { copied, copy } = useClipboard();

  const faviconUrl = getFaviconUrl(entry.url);
  const showFavicon = !!faviconUrl && !faviconError;

  const copyToClipboard = async (text: string, key: string) => {
    const ok = await copy(text, key);
    if (ok) {
      const rawTimeout = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sv_clipboard_timeout') ?? '30', 10) : 30;
      const timeout = Number.isFinite(rawTimeout) && rawTimeout > 0 && rawTimeout <= 300 ? rawTimeout : 30;
      toast({ title: `${key} copied`, description: `Clipboard will clear in ${timeout}s.` });
      // Track last-used timestamp (fire-and-forget)
      if (key === 'Password' || key === 'Username') {
        updateEntry(entry.id, { lastUsed: new Date() }).catch(() => {});
      }
    } else {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEntry(entry.id);
      toast({ title: 'Entry deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
    setDeleteDialogOpen(false);
  };

  const toggleFavorite = async () => {
    try {
      await updateEntry(entry.id, { isFavorite: !entry.isFavorite });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  const letter = (entry.website || entry.username || '?')[0].toUpperCase();
  const maskedPassword = '•'.repeat(Math.min(entry.password?.length ?? 8, 16));
  const entryType: VaultItemType = entry.type ?? 'login';
  const TypeIcon = TYPE_ICONS[entryType];
  const hasPassword = !!entry.password;
  const hasUsername = !!entry.username && entryType !== 'note' && entryType !== 'wifi';

  const gradients = [
    'from-blue-500 to-violet-600',
    'from-violet-500 to-pink-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-cyan-500 to-blue-600',
  ];
  const gradient = gradients[letter.charCodeAt(0) % gradients.length];

  const passwordAgeDays = entry.password
    ? Math.floor((Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isStale = entry.password && passwordAgeDays > 90;

  return (
    <>
      <div className={`group flex items-center gap-4 rounded-xl bg-card border border-border hover:border-border/80 hover:bg-card/80 transition-all ${compact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
        {/* Favicon / letter avatar with type badge */}
        <div className="relative flex-shrink-0" onClick={onClick}>
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
            {showFavicon ? (
              <img
                src={faviconUrl!}
                alt=""
                className="w-6 h-6 object-contain"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <span className="text-sm font-bold text-white">{letter}</span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border border-border/80 flex items-center justify-center">
            <TypeIcon className="w-2.5 h-2.5 text-muted-foreground" />
          </div>
        </div>

        {/* Title & username */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium truncate ${compact ? 'text-xs' : 'text-sm'}`}>{entry.website}</span>
            {entry.isFavorite && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0 fill-yellow-400" />}
            <Badge variant="outline" className="text-xs h-4 px-1.5 flex-shrink-0 hidden sm:flex">{entry.category}</Badge>
          </div>
          {entry.username && entryType !== 'note' && entryType !== 'wifi' && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.username}</p>
          )}
          {!compact && entry.tags && entry.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {entry.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0 rounded bg-secondary/60 text-muted-foreground border border-border/40 hover:bg-primary/15 hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={e => { e.stopPropagation(); onTagClick?.(tag); }}
                >{tag}</span>
              ))}
              {entry.tags.length > 3 && <span className="text-xs text-muted-foreground/50">+{entry.tags.length - 3}</span>}
            </div>
          )}
        </div>

        {/* Password preview — hidden in compact mode */}
        {!compact && (
          <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
            {hasPassword && (
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                {showPassword ? entry.password : maskedPassword}
              </span>
            )}
          </div>
        )}

        {/* Updated time + stale badge — hidden in compact mode */}
        {!compact && (
          <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0 w-36 justify-end">
          {isStale && (
            <span className="flex items-center gap-0.5 text-xs text-yellow-500/80 bg-yellow-500/8 border border-yellow-500/15 px-1.5 py-0.5 rounded-md" title={`Password is ${passwordAgeDays} days old`}>
              <Clock className="w-2.5 h-2.5" />{passwordAgeDays}d
            </span>
          )}
          <span className="text-xs text-muted-foreground/60 text-right">
            {formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true })}
          </span>
        </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasUsername && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => copyToClipboard(entry.username, 'Username')} title="Copy username">
              {copied === 'Username' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          )}
          {hasPassword && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => copyToClipboard(entry.password, 'Password')} title="Copy password">
              {copied === 'Password' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          )}
          {hasPassword && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide' : 'Show'}>
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          )}
          {entry.url && /^https?:\/\//i.test(entry.url) && (
            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')}
              title="Open website"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(entry)}
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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