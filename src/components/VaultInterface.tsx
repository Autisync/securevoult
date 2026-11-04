'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EntryCard } from '@/components/EntryCard';
import { EntryDetailPanel } from '@/components/EntryDetailPanel';
import { EntryForm } from '@/components/EntryForm';
import { PasswordGenerator } from '@/components/PasswordGenerator';
import { SecurityCenter } from '@/components/SecurityCenter';
import { Settings } from '@/components/Settings';
import { EmptyState } from '@/components/EmptyState';
import { Logo } from '@/components/Logo';
import { PasswordEntry, SortBy, VaultItemType } from '@/types/vault';
import { useVault } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useVaultPreferences } from '@/hooks/useVaultPreferences';
import { CryptoService } from '@/lib/crypto';
import { checkMultiplePasswords } from '@/lib/breach';
import {
  Search, Plus, Lock, LogOut, Star, Layers, Clock, Wand2, ShieldAlert,
  ChevronRight, Settings2, Shield, Key, StickyNote, CreditCard, Wifi,
  ArrowUpDown, Tag, UserCircle, CheckSquare, Square, Trash2, Heart,
  FolderOpen, WifiOff, RefreshCw, CloudOff, CheckCircle2, History,
  Globe, LayoutDashboard, Landmark,
} from 'lucide-react';

type SidebarView = 'all' | 'favorites' | 'category' | 'recent' | 'used' | 'generator' | 'security' | 'settings';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'weakest', label: 'Weakest first' },
];

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  login: Key, note: StickyNote, card: CreditCard, identity: UserCircle, wifi: Wifi, bank: Landmark,
};

const TYPE_FILTERS: { value: VaultItemType | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'all',      label: 'All',      icon: Layers },
  { value: 'login',    label: 'Logins',   icon: Key },
  { value: 'note',     label: 'Notes',    icon: StickyNote },
  { value: 'card',     label: 'Cards',    icon: CreditCard },
  { value: 'bank',     label: 'Bank',     icon: Landmark },
  { value: 'identity', label: 'Identity', icon: UserCircle },
  { value: 'wifi',     label: 'Wi-Fi',    icon: Wifi },
];

interface VaultInterfaceProps {
  onViewPublicSite?: () => void;
  onOpenAdmin?: () => void;
}

export function VaultInterface({ onViewPublicSite, onOpenAdmin }: VaultInterfaceProps = {}) {
  const [sidebarView, setSidebarView] = useState<SidebarView>('all');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PasswordEntry | undefined>();
  const [detailEntry, setDetailEntry] = useState<PasswordEntry | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<VaultItemType | 'all'>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('sv_type_filter') as VaultItemType | 'all' | null;
      if (saved) return saved;
    }
    return 'all';
  });
  const searchRef = useRef<HTMLInputElement>(null);

  // Persist typeFilter to sessionStorage
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('sv_type_filter', typeFilter);
    }
  }, [typeFilter]);

  const {
    vault, isUnlocked, searchQuery, setSearchQuery, setSelectedCategory, setSortBy, sortBy,
    getFilteredEntries, getCategories, exportVault, lockVault,
    updateEntry, deleteEntry, syncStatus, lastSynced,
  } = useVault();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { prefs } = useVaultPreferences();

  // Auto-lock on inactivity — reacts live to Settings changes
  useAutoLock(prefs.autoLockMinutes, lockVault);

  // Apply defaultSort preference on vault unlock (only on initial unlock)
  useEffect(() => {
    if (isUnlocked) {
      setSortBy(prefs.defaultSort);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (['all', 'favorites', 'recent', 'used', 'category'].includes(sidebarView)) {
          e.preventDefault();
          searchRef.current?.focus();
        }
        return;
      }
      // Escape → close detail panel, or clear search if focused, or deselect bulk
      if (e.key === 'Escape') {
        if (bulkMode) {
          setBulkMode(false);
          setSelectedIds(new Set());
          return;
        }
        if (detailEntry) {
          setDetailEntry(null);
          return;
        }
        if (searchQuery) {
          setSearchQuery('');
          searchRef.current?.blur();
          return;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarView, bulkMode, detailEntry, searchQuery, setSearchQuery]);

  const handleTagClick = useCallback((tag: string) => {
    setSidebarView('all');
    setSelectedCategory('all');
    setSearchQuery(tag);
  }, [setSearchQuery, setSelectedCategory]);

  const filteredEntries = getFilteredEntries();
  const categories = getCategories();
  const allEntries = vault?.entries ?? [];
  const totalEntries = allEntries.length;
  const favoriteCount = allEntries.filter(e => e.isFavorite).length;

  // One-time background breach scan per session (fires once per unlock)
  useEffect(() => {
    if (!isUnlocked || !allEntries.length) return;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sv_breach_scanned')) return;
    const passwords = allEntries
      .filter(e => (e.type ?? 'login') === 'login' && e.password)
      .map(e => e.password);
    if (!passwords.length) return;
    checkMultiplePasswords(passwords).then(results => {
      // Mark scanned only after a successful response so a failed scan can retry
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('sv_breach_scanned', '1');
      const breachCount = Array.from(results.values()).filter(r => r.breached).length;
      if (breachCount > 0) {
        toast({
          title: `${breachCount} breached password${breachCount > 1 ? 's' : ''} detected`,
          description: 'Open Security Center to review and replace them.',
          variant: 'destructive',
        });
      }
    }).catch(() => {
      // Network unavailable — silently skip; flag not set so next unlock will retry
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked]);

  const securityStats = useMemo(() => {
    if (!allEntries.length) return { weak: 0, reused: 0, stale: 0 };
    const pwCounts = new Map<string, number>();
    for (const e of allEntries) if (e.password) pwCounts.set(e.password, (pwCounts.get(e.password) ?? 0) + 1);
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let weak = 0, reused = 0, stale = 0;
    for (const e of allEntries) {
      if (!e.password) continue;
      if (CryptoService.checkPasswordStrength(e.password).strength === 'weak') weak++;
      if ((pwCounts.get(e.password) ?? 0) > 1) reused++;
      if (now - new Date(e.updatedAt).getTime() > ninetyDays) stale++;
    }
    return { weak, reused, stale };
  }, [allEntries]);

  const handleExport = async () => {
    try {
      const data = await exportVault();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `securevoult-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: 'Vault exported' });
    } catch { toast({ title: 'Export failed', variant: 'destructive' }); }
  };

  const handleSidebarNav = (view: SidebarView, category?: string) => {
    setSidebarView(view);
    setBulkMode(false);
    setSelectedIds(new Set());
    setTypeFilter('all');
    if (view === 'favorites') { setSelectedCategory('all'); setSearchQuery(''); }
    else if (view === 'category' && category) { setActiveCategory(category); setSelectedCategory(category); }
    else if (['all', 'recent', 'used', 'generator', 'security', 'settings'].includes(view)) { setSelectedCategory('all'); setSearchQuery(''); }
  };

  const handleSignOut = async () => {
    try { await signOut(); }
    catch { toast({ title: 'Sign out failed', variant: 'destructive' }); }
  };

  const getUserInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const displayedEntries = (() => {
    let entries = filteredEntries;
    if (sidebarView === 'favorites') entries = entries.filter(e => e.isFavorite);
    if (sidebarView === 'recent') {
      entries = [...allEntries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 20);
    }
    if (sidebarView === 'used') {
      entries = [...allEntries]
        .filter(e => e.lastUsed)
        .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
        .slice(0, 20);
    }
    // Apply type filter (not on 'used' view — results are already type-diverse)
    if (typeFilter !== 'all' && sidebarView !== 'used') {
      entries = entries.filter(e => (e.type ?? 'login') === typeFilter);
    }
    return entries;
  })();

  // Big vaults: draw the first rows now and the rest as you scroll, so 600+
  // items stay smooth. The list resets to the top chunk when the view changes.
  const CHUNK = 60;
  const [renderLimit, setRenderLimit] = useState(CHUNK);
  const listKey = `${sidebarView}|${typeFilter}|${searchQuery}|${activeCategory ?? ''}`;
  useEffect(() => { setRenderLimit(CHUNK); }, [listKey]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setRenderLimit((n) => n + CHUNK * 2); }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [renderLimit, displayedEntries.length]);

  const recentlyUpdated = useMemo(() =>
    [...allEntries]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5),
  [allEntries]);

  const recentlyUsed = useMemo(() =>
    [...allEntries]
      .filter(e => e.lastUsed)
      .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
      .slice(0, 5),
  [allEntries]);

  // Bulk action handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(displayedEntries.map(e => e.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = async () => {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    let done = 0;
    for (const id of ids) {
      try { await deleteEntry(id); done++; } catch { /* continue */ }
    }
    clearSelection(); setBulkMode(false);
    toast({ title: `${done} ${done === 1 ? 'entry' : 'entries'} deleted` });
  };

  const bulkFavorite = async (fav: boolean) => {
    if (!selectedIds.size) return;
    for (const id of Array.from(selectedIds)) {
      try { await updateEntry(id, { isFavorite: fav }); } catch { /* continue */ }
    }
    clearSelection(); setBulkMode(false);
    toast({ title: fav ? 'Added to favorites' : 'Removed from favorites' });
  };

  const handleEditEntry = (entry: PasswordEntry) => {
    setDetailEntry(null);
    setEditingEntry(entry);
    setEntryFormOpen(true);
  };

  const handleDetailClick = (entry: PasswordEntry) => {
    if (bulkMode) { toggleSelect(entry.id); return; }
    setDetailEntry(prev => prev?.id === entry.id ? null : entry);
  };

  // Sync status badge
  const SyncBadge = () => {
    const map = {
      synced:  { icon: CheckCircle2, label: 'Synced',       cls: 'text-green-400' },
      syncing: { icon: RefreshCw,    label: 'Syncing…',      cls: 'text-blue-400 animate-spin' },
      failed:  { icon: CloudOff,     label: 'Sync failed',   cls: 'text-red-400' },
      offline: { icon: WifiOff,      label: 'Offline',       cls: 'text-yellow-400' },
    };
    const { icon: Icon, label, cls } = map[syncStatus];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`flex items-center gap-1 text-xs ${cls} cursor-default`}>
              <Icon className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />{label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {lastSynced ? `Last synced ${lastSynced.toLocaleTimeString()}` : 'Not yet synced this session'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const NavItem = ({ id, icon: Icon, label, count, category, danger }: {
    id: SidebarView; icon: React.ElementType; label: string; count?: number; category?: string; danger?: boolean;
  }) => {
    const active = sidebarView === id && (id !== 'category' || activeCategory === category);
    return (
      <button onClick={() => handleSidebarNav(id, category)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
          active ? 'bg-primary/15 text-primary font-medium' :
          danger ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/8' :
          'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}
      >
        <div className="flex items-center gap-2.5"><Icon className="w-4 h-4" /><span>{label}</span></div>
        {count !== undefined && count > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>{count}</span>
        )}
      </button>
    );
  };

  const showEntryList = ['all', 'favorites', 'recent', 'used', 'category'].includes(sidebarView);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col bg-[hsl(222_40%_7%)]">
        <div className="px-4 py-5 border-b border-border/50">
          <Logo size="sm" />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="space-y-0.5">
            <NavItem id="all" icon={Layers} label="All items" count={totalEntries} />
            <NavItem id="favorites" icon={Star} label="Favorites" count={favoriteCount} />
            <NavItem id="recent" icon={Clock} label="Recently updated" />
            <NavItem id="used" icon={History} label="Recently used" count={recentlyUsed.length || undefined} />
          </div>
          {categories.length > 0 && (
            <div className="pt-4">
              <p className="px-3 mb-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Categories</p>
              <div className="space-y-0.5">
                {categories.map(cat => <NavItem key={cat} id="category" icon={Layers} label={cat} category={cat} />)}
              </div>
            </div>
          )}
          <div className="pt-4">
            <p className="px-3 mb-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Tools</p>
            <div className="space-y-0.5">
              <NavItem id="generator" icon={Wand2} label="Password generator" />
              <NavItem id="security" icon={ShieldAlert} label="Security center" />
            </div>
          </div>
        </nav>
        <div className="p-3 border-t border-border/50 space-y-0.5">
          <NavItem id="settings" icon={Settings2} label="Settings" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary/60 transition-colors text-left mt-0.5">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.photoURL || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">{getUserInitials(user?.displayName, user?.email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user?.displayName || user?.email}</p>
                  {user?.displayName && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExport}><Shield className="mr-2 h-4 w-4" />Export backup</DropdownMenuItem>
              {onViewPublicSite && (
                <DropdownMenuItem onClick={onViewPublicSite}><Globe className="mr-2 h-4 w-4" />View public site</DropdownMenuItem>
              )}
              {onOpenAdmin && (
                <DropdownMenuItem onClick={onOpenAdmin}><LayoutDashboard className="mr-2 h-4 w-4" />Admin console</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => lockVault()}><Lock className="mr-2 h-4 w-4" />Lock vault</DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border bg-background">
          {/* Top bar */}
          <div className="h-14 flex items-center gap-3 px-5">
            {showEntryList ? (
              <>
                <div className="relative flex-1 max-w-lg">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                  <Input
                    ref={searchRef}
                    placeholder="Search vault… (⌘K)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-secondary/50 border-border/60 focus:border-primary text-sm"
                  />
                </div>
                <Select value={sortBy} onValueChange={v => setSortBy(v as SortBy)}>
                  <SelectTrigger className="w-44 h-9 bg-secondary/50 border-border/60 text-sm flex-shrink-0">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-muted-foreground/60" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className={`h-9 flex-shrink-0 border-border/60 ${bulkMode ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}`}
                  onClick={() => { setBulkMode(!bulkMode); clearSelection(); }} title="Multi-select">
                  <CheckSquare className="w-4 h-4" />
                </Button>
                <Button size="sm" className="h-9 bg-primary hover:bg-primary/90 flex-shrink-0" onClick={() => { setEditingEntry(undefined); setEntryFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" />Add entry
                </Button>
              </>
            ) : (
              <h2 className="text-sm font-semibold text-muted-foreground capitalize">{sidebarView}</h2>
            )}
            <div className="ml-auto flex-shrink-0">
              <SyncBadge />
            </div>
          </div>
          {/* Type filter chips — shown when browsing entries */}
          {showEntryList && sidebarView !== 'used' && (
            <div className="flex items-center gap-1.5 px-5 pb-2.5 overflow-x-auto no-scrollbar">
              {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors ${
                    typeFilter === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3 h-3" />{label}
                  {value !== 'all' && (
                    <span className={`text-xs ${typeFilter === value ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                      {allEntries.filter(e => (e.type ?? 'login') === value).length}
                    </span>
                  )}
                </button>
              ))}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/15 text-red-400 hover:bg-red-500/20 flex-shrink-0 transition-colors ml-auto"
                >
                  ✕ Clear search
                </button>
              )}
            </div>
          )}
        </header>

        {/* Content + detail panel */}
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 overflow-y-auto p-5">

            {/* Dashboard overview */}
            {sidebarView === 'all' && totalEntries > 0 && (
              <div className="mb-6 space-y-4 animate-fade-up">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Total',      value: totalEntries,          color: 'text-blue-400' },
                    { label: 'Favorites',  value: favoriteCount,          color: 'text-yellow-400' },
                    { label: 'Categories', value: categories.length,       color: 'text-violet-400' },
                    { label: 'Weak',       value: securityStats.weak,      color: securityStats.weak   > 0 ? 'text-red-400'    : 'text-green-400' },
                    { label: 'Reused',     value: securityStats.reused,    color: securityStats.reused > 0 ? 'text-orange-400' : 'text-green-400' },
                    { label: 'Stale',      value: securityStats.stale,     color: securityStats.stale  > 0 ? 'text-yellow-400' : 'text-green-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-card border border-border rounded-xl p-3">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {(securityStats.weak > 0 || securityStats.reused > 0) && (
                  <div className="flex items-center justify-between bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-sm text-red-300">
                        {securityStats.weak > 0 && `${securityStats.weak} weak password${securityStats.weak > 1 ? 's' : ''}`}
                        {securityStats.weak > 0 && securityStats.reused > 0 && ' · '}
                        {securityStats.reused > 0 && `${securityStats.reused} reused password${securityStats.reused > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                      onClick={() => handleSidebarNav('security')}>Review →</Button>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Quick actions</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'New login',         icon: Key,        action: () => { setEditingEntry(undefined); setEntryFormOpen(true); } },
                      { label: 'Generate password', icon: Wand2,      action: () => handleSidebarNav('generator') },
                      { label: 'Security scan',     icon: ShieldAlert, action: () => handleSidebarNav('security') },
                      { label: 'Import',            icon: Shield,     action: () => handleSidebarNav('settings') },
                      { label: 'Lock vault',        icon: Lock,       action: () => lockVault() },
                    ].map(({ label, icon: Icon, action }) => (
                      <button key={label} onClick={action}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recently updated mini-list */}
                {recentlyUpdated.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Recently updated</p>
                      <button className="text-xs text-primary/70 hover:text-primary transition-colors" onClick={() => handleSidebarNav('recent')}>
                        View all →
                      </button>
                    </div>
                    <div className="space-y-1">
                      {recentlyUpdated.map(entry => {
                        const TypeIcon = ITEM_TYPE_ICONS[entry.type ?? 'login'] ?? Key;
                        const gradients = ['from-blue-500 to-violet-600','from-violet-500 to-pink-600','from-emerald-500 to-teal-600','from-orange-500 to-red-600','from-cyan-500 to-blue-600'];
                        const letter = (entry.website || '?')[0].toUpperCase();
                        const gradient = gradients[letter.charCodeAt(0) % gradients.length];
                        return (
                          <button
                            key={entry.id}
                            onClick={() => { setDetailEntry(detailEntry?.id === entry.id ? null : entry); }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 text-left transition-colors group"
                          >
                            <div className={`relative w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-xs font-bold text-white">{letter}</span>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background border border-border/80 flex items-center justify-center">
                                <TypeIcon className="w-2 h-2 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{entry.website}</p>
                              {entry.username && <p className="text-xs text-muted-foreground truncate">{entry.username}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground/50 flex-shrink-0 hidden sm:block">
                              {new Date(entry.updatedAt).toLocaleDateString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recentlyUsed.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Recently used</p>
                      <button className="text-xs text-primary/70 hover:text-primary transition-colors" onClick={() => handleSidebarNav('used')}>
                        View all →
                      </button>
                    </div>
                    <div className="space-y-1">
                      {recentlyUsed.map(entry => {
                        const TypeIcon = ITEM_TYPE_ICONS[entry.type ?? 'login'] ?? Key;
                        const gradients = ['from-blue-500 to-violet-600','from-violet-500 to-pink-600','from-emerald-500 to-teal-600','from-orange-500 to-red-600','from-cyan-500 to-blue-600'];
                        const letter = (entry.website || '?')[0].toUpperCase();
                        const gradient = gradients[letter.charCodeAt(0) % gradients.length];
                        return (
                          <button
                            key={entry.id}
                            onClick={() => { setDetailEntry(detailEntry?.id === entry.id ? null : entry); }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 text-left transition-colors group"
                          >
                            <div className={`relative w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-xs font-bold text-white">{letter}</span>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background border border-border/80 flex items-center justify-center">
                                <TypeIcon className="w-2 h-2 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{entry.website}</p>
                              {entry.username && <p className="text-xs text-muted-foreground truncate">{entry.username}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground/50 flex-shrink-0 hidden sm:block">
                              {entry.lastUsed ? `Used ${new Date(entry.lastUsed).toLocaleDateString()}` : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tool views */}
            {sidebarView === 'generator' && <PasswordGenerator />}
            {sidebarView === 'security' && <SecurityCenter onEditEntry={entry => { handleEditEntry(entry); setSidebarView('all'); }} />}
            {sidebarView === 'settings' && <Settings onClose={() => setSidebarView('all')} />}

            {/* Bulk action bar */}
            {bulkMode && showEntryList && (
              <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl animate-fade-up">
                <button onClick={selectedIds.size === displayedEntries.length ? clearSelection : selectAll}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  {selectedIds.size === displayedEntries.length
                    ? <><CheckSquare className="w-3.5 h-3.5" />Deselect all</>
                    : <><Square className="w-3.5 h-3.5" />Select all</>
                  }
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                    <div className="flex items-center gap-2 ml-auto">
                      <button onClick={() => bulkFavorite(true)} className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors px-2 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/15">
                        <Heart className="w-3 h-3" />Favorite
                      </button>
                      <button onClick={() => bulkFavorite(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/60">
                        Unfavorite
                      </button>
                      <button onClick={bulkDelete} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/15">
                        <Trash2 className="w-3 h-3" />Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Entry list */}
            {showEntryList && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    {sidebarView === 'all' && 'All items'}
                    {sidebarView === 'favorites' && 'Favorites'}
                    {sidebarView === 'recent' && 'Recently updated'}
                    {sidebarView === 'category' && activeCategory}
                    {displayedEntries.length > 0 && (
                      <span className="normal-case font-normal text-muted-foreground/50">{displayedEntries.length}</span>
                    )}
                  </h2>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-xs text-muted-foreground hover:text-foreground">Clear search</button>
                  )}
                </div>

                {displayedEntries.length > 0 ? (
                  <div className={prefs.compactView ? 'space-y-0.5' : 'space-y-1.5'}>
                    {displayedEntries.slice(0, renderLimit).map(entry => (
                      <div key={entry.id} className="relative" onClick={() => handleDetailClick(entry)}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: prefs.compactView ? '0 44px' : '0 66px' }}>
                        {bulkMode && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
                            onClick={e => { e.stopPropagation(); toggleSelect(entry.id); }}>
                            {selectedIds.has(entry.id)
                              ? <CheckSquare className="w-4 h-4 text-primary" />
                              : <Square className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        )}
                        <div className={`${bulkMode ? 'pl-8' : ''} ${detailEntry?.id === entry.id ? 'ring-1 ring-primary/30 rounded-xl' : ''}`}>
                          <EntryCard
                            entry={entry}
                            onEdit={() => handleEditEntry(entry)}
                            onTagClick={handleTagClick}
                            onClick={() => handleDetailClick(entry)}
                            compact={prefs.compactView}
                          />
                        </div>
                      </div>
                    ))}
                    {displayedEntries.length > renderLimit && (
                      <div ref={sentinelRef} className="py-4 text-center text-xs text-muted-foreground">
                        Showing {renderLimit} of {displayedEntries.length}…
                      </div>
                    )}
                  </div>
                ) : searchQuery ? (
                  /* Rich search empty state */
                  <div className="flex flex-col items-center justify-center py-14 text-center space-y-4 animate-fade-up">
                    <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
                      <Search className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">No results for &ldquo;{searchQuery}&rdquo;</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {typeFilter !== 'all' ? `No ${typeFilter} entries match this search. Try removing the type filter.` : 'Try a different word, partial match, or browse by category.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60 bg-secondary/30 rounded-xl px-4 py-2.5 space-x-1">
                      <span>Search tips:</span>
                      <span className="px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">site name</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">username</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">tag name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                      {typeFilter !== 'all' && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setTypeFilter('all')}>
                          Show all types
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={
                      sidebarView === 'favorites' ? <Star className="w-6 h-6" /> :
                      sidebarView === 'used' ? <History className="w-6 h-6" /> :
                      <Shield className="w-6 h-6" />
                    }
                    title={
                      sidebarView === 'favorites' ? 'No favorites yet' :
                      sidebarView === 'used' ? 'No recently used entries' :
                      sidebarView === 'category' ? `No entries in ${activeCategory}` :
                      typeFilter !== 'all' ? `No ${typeFilter} entries` :
                      'Your vault is empty'
                    }
                    description={
                      sidebarView === 'favorites' ? 'Star entries to keep your most important logins front and center.' :
                      sidebarView === 'used' ? 'Copy a username or password from any entry to start tracking usage.' :
                      typeFilter !== 'all' ? `You have no entries of this type yet. Add one from the "Add entry" button.` :
                      'Add your first password to get started. All entries are encrypted with your master password.'
                    }
                    ctaLabel={sidebarView === 'used' ? undefined : 'Add entry'}
                    onCta={sidebarView === 'used' ? undefined : () => { setEditingEntry(undefined); setEntryFormOpen(true); }}
                    secondaryLabel={typeFilter !== 'all' ? 'Show all types' : undefined}
                    onSecondary={typeFilter !== 'all' ? () => setTypeFilter('all') : undefined}
                  />
                )}
              </>
            )}
          </main>

          {/* Entry detail panel */}
          {detailEntry && !bulkMode && (
            <EntryDetailPanel
              entry={detailEntry}
              onClose={() => setDetailEntry(null)}
              onEdit={handleEditEntry}
            />
          )}
        </div>
      </div>

      <EntryForm
        entry={editingEntry}
        open={entryFormOpen}
        onOpenChange={open => { if (!open) { setEntryFormOpen(false); setEditingEntry(undefined); } }}
      />
    </div>
  );
}
