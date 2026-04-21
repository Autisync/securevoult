import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const code = `'use client';

import { useState, useRef, useMemo } from 'react';
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
import { PasswordEntry, SortBy } from '@/types/vault';
import { useVault } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useAutoLock } from '@/hooks/useAutoLock';
import { CryptoService } from '@/lib/crypto';
import {
  Search, Plus, Lock, LogOut, Star, Layers, Clock, Wand2, ShieldAlert,
  ChevronRight, Settings2, Shield, Key, StickyNote, CreditCard, Wifi,
  ArrowUpDown, Tag, UserCircle, CheckSquare, Square, Trash2, Heart,
  FolderOpen, WifiOff, RefreshCw, CloudOff, CheckCircle2,
} from 'lucide-react';

type SidebarView = 'all' | 'favorites' | 'category' | 'recent' | 'generator' | 'security' | 'settings';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'weakest', label: 'Weakest first' },
];

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  login: Key, note: StickyNote, card: CreditCard, identity: UserCircle, wifi: Wifi,
};

const AUTO_LOCK_MINUTES_KEY = 'sv_autolock_minutes';
function getAutoLockMinutes(): number {
  if (typeof window === 'undefined') return 15;
  return parseInt(localStorage.getItem(AUTO_LOCK_MINUTES_KEY) ?? '15', 10);
}

export function VaultInterface() {
  const [sidebarView, setSidebarView] = useState<SidebarView>('all');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PasswordEntry | undefined>();
  const [detailEntry, setDetailEntry] = useState<PasswordEntry | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    vault, searchQuery, setSearchQuery, setSelectedCategory, setSortBy, sortBy,
    getFilteredEntries, getCategories, exportVault, importVault, lockVault,
    updateEntry, deleteEntry, syncStatus, lastSynced,
  } = useVault();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // Auto-lock on inactivity
  const autoLockMinutes = getAutoLockMinutes();
  useAutoLock(autoLockMinutes, lockVault);

  const filteredEntries = getFilteredEntries();
  const categories = getCategories();
  const allEntries = vault?.entries ?? [];
  const totalEntries = allEntries.length;
  const favoriteCount = allEntries.filter(e => e.isFavorite).length;

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
      a.download = \`securevoult-backup-\${new Date().toISOString().split('T')[0]}.json\`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: 'Vault exported' });
    } catch { toast({ title: 'Export failed', variant: 'destructive' }); }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      await importVault(text);
      toast({ title: 'Vault imported', description: 'Backup restored.' });
    } catch (err) {
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Invalid file.', variant: 'destructive' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSidebarNav = (view: SidebarView, category?: string) => {
    setSidebarView(view);
    setBulkMode(false);
    setSelectedIds(new Set());
    if (view === 'favorites') { setSelectedCategory('all'); setSearchQuery(''); }
    else if (view === 'category' && category) { setActiveCategory(category); setSelectedCategory(category); }
    else if (['all', 'recent', 'generator', 'security', 'settings'].includes(view)) { setSelectedCategory('all'); setSearchQuery(''); }
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
      entries = [...allEntries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 15);
    }
    return entries;
  })();

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
    toast({ title: \`\${done} \${done === 1 ? 'entry' : 'entries'} deleted\` });
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
            <span className={\`flex items-center gap-1 text-xs \${cls} cursor-default\`}>
              <Icon className={\`w-3.5 h-3.5 \${syncStatus === 'syncing' ? 'animate-spin' : ''}\`} />{label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {lastSynced ? \`Last synced \${lastSynced.toLocaleTimeString()}\` : 'Not yet synced this session'}
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
        className={\`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors \${
          active ? 'bg-primary/15 text-primary font-medium' :
          danger ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/8' :
          'text-muted-foreground hover:text-foreground hover:bg-secondary/60'\`}
      >
        <div className="flex items-center gap-2.5"><Icon className="w-4 h-4" /><span>{label}</span></div>
        {count !== undefined && count > 0 && (
          <span className={\`text-xs px-1.5 py-0.5 rounded-md \${active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}\`}>{count}</span>
        )}
      </button>
    );
  };

  const showEntryList = ['all', 'favorites', 'recent', 'category'].includes(sidebarView);

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
        <header className="flex-shrink-0 h-14 border-b border-border flex items-center gap-3 px-5">
          {showEntryList ? (
            <>
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                <Input
                  placeholder="Search vault…"
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
              <Button variant="outline" size="sm" className={\`h-9 flex-shrink-0 border-border/60 \${bulkMode ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}\`}
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
                      <p className={\`text-xl font-bold \${color}\`}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {(securityStats.weak > 0 || securityStats.reused > 0) && (
                  <div className="flex items-center justify-between bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-sm text-red-300">
                        {securityStats.weak > 0 && \`\${securityStats.weak} weak password\${securityStats.weak > 1 ? 's' : ''}\`}
                        {securityStats.weak > 0 && securityStats.reused > 0 && ' · '}
                        {securityStats.reused > 0 && \`\${securityStats.reused} reused password\${securityStats.reused > 1 ? 's' : ''}\`}
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
              </div>
            )}

            {/* Tool views */}
            {sidebarView === 'generator' && <PasswordGenerator />}
            {sidebarView === 'security' && <SecurityCenter />}
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
                  <div className="space-y-1.5">
                    {displayedEntries.map(entry => (
                      <div key={entry.id} className="relative" onClick={() => handleDetailClick(entry)}>
                        {bulkMode && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
                            onClick={e => { e.stopPropagation(); toggleSelect(entry.id); }}>
                            {selectedIds.has(entry.id)
                              ? <CheckSquare className="w-4 h-4 text-primary" />
                              : <Square className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        )}
                        <div className={\`\${bulkMode ? 'pl-8' : ''} \${detailEntry?.id === entry.id ? 'ring-1 ring-primary/30 rounded-xl' : ''}\`}>
                          <EntryCard
                            entry={entry}
                            onEdit={() => handleEditEntry(entry)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={
                      searchQuery ? <Search className="w-6 h-6" /> :
                      sidebarView === 'favorites' ? <Star className="w-6 h-6" /> :
                      <Shield className="w-6 h-6" />
                    }
                    title={
                      searchQuery ? \`No results for "\${searchQuery}"\` :
                      sidebarView === 'favorites' ? 'No favorites yet' :
                      sidebarView === 'category' ? \`No entries in \${activeCategory}\` :
                      'Your vault is empty'
                    }
                    description={
                      searchQuery ? 'Try a different search term or browse all items.' :
                      sidebarView === 'favorites' ? 'Star entries to keep your most important logins front and center.' :
                      'Add your first password to get started. All entries are encrypted with your master password.'
                    }
                    ctaLabel={searchQuery ? undefined : 'Add entry'}
                    onCta={searchQuery ? undefined : () => { setEditingEntry(undefined); setEntryFormOpen(true); }}
                    secondaryLabel={searchQuery ? 'Clear search' : undefined}
                    onSecondary={searchQuery ? () => setSearchQuery('') : undefined}
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
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
    </div>
  );
}
`;

writeFileSync(join(root, 'src/components/VaultInterface.tsx'), code, 'utf8');
console.log('VaultInterface written:', code.split('\n').length, 'lines');
