import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const popup = `// Extension popup component
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo, LogoIcon } from '@/components/Logo';
import { useVault } from '@/contexts/VaultContext';
import { AutoFillService } from '@/lib/extension';
import { PasswordEntry } from '@/types/vault';
import { useToast } from '@/components/ui/use-toast';
import { Search, Key, Copy, ExternalLink, Plus, Settings, Lock, Check, Globe } from 'lucide-react';

interface TabInfo {
  url: string;
  title: string;
  domain: string;
}

export function ExtensionPopup() {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [matchingEntries, setMatchingEntries] = useState<PasswordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const { isUnlocked, vault, findEntriesForCurrentDomain, getFilteredEntries, setSearchQuery: setGlobalSearch } = useVault();
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
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id + type);
      setTimeout(() => setCopied(null), 2000);
      toast({ title: \`\${type} copied\` });
    } catch {
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

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredEntries.length > 0 ? (
          <div className="p-2 space-y-1">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary/60 transition-colors">
                <div className={\`w-8 h-8 rounded-lg bg-gradient-to-br \${gradient(entry)} flex items-center justify-center flex-shrink-0\`}>
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
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
              <Search className="w-4 h-4 text-muted-foreground/50" />
            </div>
            <p className="text-xs font-medium">{searchQuery ? 'No results' : 'No matches for this site'}</p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-4">
              {searchQuery ? \`No entries match "\${searchQuery}"\` : 'Try searching or add a new entry'}
            </p>
            <button
              onClick={openFullApp}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" />Add entry in app
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-2.5 border-t border-border/50">
        <button
          onClick={openFullApp}
          className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors py-1"
        >
          Open SecureVoult ↗
        </button>
      </div>
    </div>
  );
}
`;

writeFileSync(join(root, 'src/components/ExtensionPopup.tsx'), popup, 'utf8');
console.log('ExtensionPopup written:', popup.split('\n').length, 'lines');
