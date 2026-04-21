// Extension popup component
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo, LogoIcon } from '@/components/Logo';
import { useVault } from '@/contexts/VaultContext';
import { useClipboard } from '@/hooks/useClipboard';
import { AutoFillService } from '@/lib/extension';
import { PasswordEntry } from '@/types/vault';
import { useToast } from '@/components/ui/use-toast';
import { Search, Key, Copy, ExternalLink, Plus, Settings, Lock, Check, Globe, Save, ChevronRight, Zap, ShieldCheck, X, Clock } from 'lucide-react';

interface TabInfo {
  url: string;
  title: string;
  domain: string;
}

export function ExtensionPopup() {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [matchingEntries, setMatchingEntries] = useState<PasswordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSave, setPendingSave] = useState<{ username: string; password: string; domain: string; url: string; title: string } | null>(null);
  const [pendingDismissed, setPendingDismissed] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ title: string; username: string; password: string } | null>(null);
  const [pendingShowPw, setPendingShowPw] = useState(false);
  const { copied, copy: clipboardCopy } = useClipboard();
  const { isUnlocked, vault, findEntriesForCurrentDomain, getFilteredEntries, setSearchQuery: setGlobalSearch, lockVault, addEntry } = useVault();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab.url && tab.title) {
          try {
            const domain = new URL(tab.url).hostname.replace('www.', '');
            setTabInfo({ url: tab.url, title: tab.title, domain });
          } catch {}
        }
      });
    }
  }, []);

  useEffect(() => {
    if (isUnlocked && tabInfo) {
      findEntriesForCurrentDomain().then(setMatchingEntries);
    }
  }, [isUnlocked, tabInfo, vault, findEntriesForCurrentDomain]);

  // Check for pending save-login queued by content script
  useEffect(() => {
    if (!isUnlocked) return;
    AutoFillService.getPendingSaveLogin().then(data => {
      if (data) {
        setPendingSave(data);
        // Pre-populate edit fields
        setPendingEdit({ title: data.title || data.domain, username: data.username, password: data.password });
      }
    });
  }, [isUnlocked]);

  const handleSavePendingLogin = async () => {
    if (!pendingSave || !pendingEdit) return;
    try {
      await addEntry({
        type: 'login',
        website: pendingEdit.title || pendingSave.domain,
        url: pendingSave.url,
        username: pendingEdit.username,
        password: pendingEdit.password,
        category: 'Other',
      });
      toast({ title: 'Login saved to vault', description: pendingEdit.title || pendingSave.domain });
      setPendingSave(null);
      setPendingEdit(null);
      setPendingExpanded(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const handleAutoFill = async (entry: PasswordEntry) => {
    try {
      await AutoFillService.fillCredentials(entry.username, entry.password);
      toast({ title: 'Credentials filled', description: entry.website });
      window.close();
    } catch {
      toast({ title: 'Autofill failed', description: 'Could not fill on this page.', variant: 'destructive' });
    }
  };

  const copyToClipboard = async (text: string, type: string, id: string) => {
    const ok = await clipboardCopy(text, id + type);
    if (ok) {
      toast({ title: `${type} copied` });
    } else {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const openFullApp = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
  };

  const filteredEntries = searchQuery
    ? getFilteredEntries().filter(e =>
        e.website.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : matchingEntries;

  // Recently used/added — shown when no search and no site match
  const recentEntries = (!searchQuery && matchingEntries.length === 0)
    ? [...(vault?.entries ?? [])]
        .filter(e => (e.type ?? 'login') === 'login')
        .sort((a, b) => {
          const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : new Date(a.updatedAt).getTime();
          const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : new Date(b.updatedAt).getTime();
          return bTime - aTime;
        })
        .slice(0, 6)
    : [];

  const letter = (entry: PasswordEntry) => (entry.website || '?')[0].toUpperCase();
  const gradients = ['from-blue-500 to-violet-600', 'from-violet-500 to-pink-600', 'from-emerald-500 to-teal-600', 'from-orange-500 to-red-600'];
  const gradient = (entry: PasswordEntry) => gradients[letter(entry).charCodeAt(0) % gradients.length];

  if (!isUnlocked) {
    return (
      <div className="w-80 bg-[hsl(222_47%_5%)] text-foreground">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <LogoIcon size="sm" />
          <span className="text-xs text-muted-foreground">SecureVoult</span>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Vault is locked</h3>
            <p className="text-xs text-muted-foreground mt-1">Open the app to unlock your vault</p>
          </div>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs h-9 w-full" onClick={openFullApp}>
            Open SecureVoult
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 max-h-[560px] flex flex-col bg-[hsl(222_47%_5%)] text-foreground">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <LogoIcon size="sm" />
          {tabInfo && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span className="max-w-[140px] truncate">{tabInfo.domain}</span>
              {matchingEntries.length > 0 && (
                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
                  {matchingEntries.length} match{matchingEntries.length !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openFullApp}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            title="Open full app"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search vault..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-secondary/50 border border-border/60 rounded-lg focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Pending save-login banner */}
      {pendingSave && !pendingDismissed && pendingEdit && (
        <div className="flex-shrink-0 mx-3 mt-2.5 bg-primary/8 border border-primary/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-primary">Save this login?</span>
              <span className="text-[11px] text-muted-foreground/70">— {pendingSave.domain}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPendingExpanded(v => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
              >
                {pendingExpanded ? 'Collapse' : 'Edit'}
              </button>
              <button onClick={() => setPendingDismissed(true)} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          {pendingExpanded && (
            <div className="px-3 pb-3 space-y-2 border-t border-primary/10">
              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Title</label>
                <input
                  className="w-full h-7 text-xs bg-secondary/60 border border-border/60 rounded-lg px-2.5 focus:outline-none focus:border-primary"
                  value={pendingEdit.title}
                  onChange={e => setPendingEdit(prev => prev ? { ...prev, title: e.target.value } : null)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Username</label>
                <input
                  className="w-full h-7 text-xs bg-secondary/60 border border-border/60 rounded-lg px-2.5 focus:outline-none focus:border-primary"
                  value={pendingEdit.username}
                  onChange={e => setPendingEdit(prev => prev ? { ...prev, username: e.target.value } : null)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={pendingShowPw ? 'text' : 'password'}
                    className="w-full h-7 text-xs bg-secondary/60 border border-border/60 rounded-lg px-2.5 pr-12 focus:outline-none focus:border-primary font-mono"
                    value={pendingEdit.password}
                    onChange={e => setPendingEdit(prev => prev ? { ...prev, password: e.target.value } : null)}
                  />
                  <button
                    onClick={() => setPendingShowPw(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {pendingShowPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {!pendingExpanded && (
            <div className="px-3 pb-2.5 text-[11px] text-muted-foreground">
              {pendingEdit.username} · {pendingEdit.password.length} chars
            </div>
          )}
          <div className="flex gap-2 px-3 pb-3">
            <button onClick={() => setPendingDismissed(true)} className="flex-1 text-[11px] text-muted-foreground border border-border/60 rounded-lg py-1.5 hover:bg-secondary/40 transition-colors">
              Not now
            </button>
            <button onClick={handleSavePendingLogin} className="flex-[2] text-[11px] bg-primary text-white rounded-lg px-3 py-1.5 font-semibold hover:bg-primary/90 transition-colors">
              Save to vault
            </button>
          </div>
        </div>
      )}

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredEntries.length > 0 ? (
          <div className="p-2">
            {!searchQuery && tabInfo && matchingEntries.length > 0 && (
              <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Saved for {tabInfo.domain}</p>
            )}
            {searchQuery && (
              <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}</p>
            )}
            <div className="space-y-0.5">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary/60 transition-colors">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient(entry)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xs font-bold text-white">{letter(entry)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{entry.website}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{entry.username}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleAutoFill(entry)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                    title="Autofill"
                  >
                    <Key className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(entry.username, 'Username', entry.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Copy username"
                  >
                    {copied === entry.id + 'Username' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(entry.password, 'Password', entry.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Copy password"
                  >
                    {copied === entry.id + 'Password' ? <Check className="w-3 h-3 text-green-400" /> : <Key className="w-3 h-3" />}
                  </button>
                  {entry.url && (
                    <button
                      onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Open site"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : recentEntries.length > 0 ? (
          <div className="p-2">
            <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />Recently used
            </p>
            <div className="space-y-0.5">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary/60 transition-colors">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient(entry)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-xs font-bold text-white">{letter(entry)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{entry.website}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{entry.username}</p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleAutoFill(entry)} className="w-6 h-6 flex items-center justify-center rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors" title="Autofill"><Key className="w-3 h-3" /></button>
                    <button onClick={() => copyToClipboard(entry.username, 'Username', entry.id)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Copy username">
                      {copied === entry.id + 'Username' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <button onClick={() => copyToClipboard(entry.password, 'Password', entry.id)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Copy password">
                      {copied === entry.id + 'Password' ? <Check className="w-3 h-3 text-green-400" /> : <Key className="w-3 h-3" />}
                    </button>
                    {entry.url && (
                      <button onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Open site"><ExternalLink className="w-3 h-3" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {tabInfo && (
              <div className="mt-2 mx-1 bg-secondary/30 border border-border/40 rounded-lg px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium">No login for {tabInfo.domain}</p>
                  <p className="text-[10px] text-muted-foreground">Save credentials for faster access next time</p>
                </div>
                <button onClick={openFullApp} className="text-[10px] text-primary flex-shrink-0 ml-2 font-medium">Add →</button>
              </div>
            )}
            <button onClick={openFullApp} className="w-full mt-1.5 text-center text-[11px] text-muted-foreground hover:text-foreground py-1 transition-colors">Browse all entries ↗</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            {!searchQuery && tabInfo ? (
              // Site is open but no saved credentials — show save CTA
              <>
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <Save className="w-4.5 h-4.5 text-primary" />
                </div>
                <p className="text-xs font-semibold mb-1">No saved login for</p>
                <p className="text-[11px] text-primary font-mono mb-3 truncate max-w-[180px]">{tabInfo.domain}</p>
                <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                  Save your credentials to autofill next time you visit.
                </p>
                <button
                  onClick={openFullApp}
                  className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />Save this login
                </button>
                <button onClick={openFullApp} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Or search all entries
                </button>
              </>
            ) : (
              // Search had no results
              <>
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                  <Search className="w-4 h-4 text-muted-foreground/50" />
                </div>
                <p className="text-xs font-medium">No results</p>
                <p className="text-[11px] text-muted-foreground mt-1 mb-4">
                  {searchQuery ? `Nothing matched “${searchQuery}”` : 'Your vault is empty'}
                </p>
                <button
                  onClick={openFullApp}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Plus className="w-3 h-3" />{searchQuery ? 'Add entry in app' : 'Open SecureVoult'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-2.5 border-t border-border/50 flex items-center justify-between">
        <button
          onClick={openFullApp}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Open full app ↗
        </button>
        <button
          onClick={() => lockVault()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Lock vault"
        >
          <Lock className="w-3 h-3" />Lock
        </button>
      </div>
    </div>
  );
}
