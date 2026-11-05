// Extension popup component
'use client';

import { useState, useEffect } from 'react';
import { Logo, LogoIcon, LogoMark } from '@/components/Logo';
import { useVault } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClipboard } from '@/hooks/useClipboard';
import { AutoFillService } from '@/lib/extension';
import { baseDomain } from '@/lib/domain';
import { parseTotp, totpNow } from '@/lib/totp';
import { SecondFactorStep } from '@/components/SecondFactorStep';
import { PasswordEntry } from '@/types/vault';
import { useToast } from '@/components/ui/use-toast';
import {
  Search, Key, Copy, ExternalLink, Plus, Settings, Lock, Check,
  Globe, Save, ShieldCheck, X, Clock, Eye, EyeOff, Mail,
  LogIn, AlertCircle, Bell, Wrench, RefreshCw, Maximize2, ChevronLeft, Wand2, VenetianMask, HeartPulse, ScanSearch, LogOut,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationList } from '@/components/NotificationList';
import { ITEM_TYPES, ITEM_TYPE, typeOf } from '@/lib/item-types';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInShowPw, setSignInShowPw] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [masterPw, setMasterPw] = useState('');
  const [masterPwShow, setMasterPwShow] = useState(false);
  const [masterPwConfirm, setMasterPwConfirm] = useState('');
  const [masterPwConfirmShow, setMasterPwConfirmShow] = useState(false);
  const [masterPwLoading, setMasterPwLoading] = useState(false);
  const [masterPwError, setMasterPwError] = useState('');
  const [vaultMode, setVaultMode] = useState<'unlock' | 'create'>('unlock');

  const { copied, copy: clipboardCopy } = useClipboard();
  const { secondFactor, newRecoveryKey, dismissRecoveryKey, isUnlocked, vault, error: vaultError, isLoading: vaultLoading, findEntriesForCurrentDomain, getFilteredEntries, lockVault, addEntry, unlockVault, createVault, refresh, syncStatus } = useVault();
  const notes = useNotifications();
  const [panel, setPanel] = useState<'list' | 'notifications' | 'tools' | 'create'>('list');
  const [syncing, setSyncing] = useState(false);
  const { isAuthenticated, isLoading: authLoading, user, signIn, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.url && tab?.title) {
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

  useEffect(() => {
    if (!isUnlocked) return;
    // Logins seen on a page while the vault was locked.
    AutoFillService.takePendingLogins().then(list => {
      const data = list[list.length - 1];
      if (data) {
        setPendingSave(data);
        setPendingEdit({ title: data.title || data.domain, username: data.username, password: data.password });
      }
    });
  }, [isUnlocked]);

  useEffect(() => {
    if (vaultError && /no vault found/i.test(vaultError)) setVaultMode('create');
  }, [vaultError]);

  const openFullApp = (hash = '') => {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vault.autisync.com') + (typeof hash === 'string' && hash ? `/#/vault/${hash}` : '');
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: appUrl });
    } else {
      window.open(appUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    setSignInError('');
    try {
      await signIn({ email: signInEmail, password: signInPassword });
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setSignInError('Incorrect email or password.');
      } else if (msg.includes('too-many-requests')) {
        setSignInError('Too many attempts. Try again later.');
      } else {
        setSignInError('Sign in failed. Check your credentials.');
      }
    } finally {
      setSignInLoading(false);
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPw) return;
    setMasterPwLoading(true);
    setMasterPwError('');
    try {
      await unlockVault(masterPw);
      setMasterPw('');
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('No vault found') || err?.name === 'NoVaultError') {
        setVaultMode('create');
        setMasterPwError('');
        setMasterPw('');
      } else if (msg.includes('Invalid') || msg.includes('decrypt') || msg.includes('bad decrypt')) {
        setMasterPwError('Incorrect master password.');
      } else {
        setMasterPwError(msg || 'Failed to unlock vault.');
      }
    } finally {
      setMasterPwLoading(false);
    }
  };

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPw) return;
    if (masterPw.length < 8) { setMasterPwError('Master password must be at least 8 characters.'); return; }
    if (masterPw !== masterPwConfirm) { setMasterPwError('Passwords do not match.'); return; }
    setMasterPwLoading(true);
    setMasterPwError('');
    try {
      await createVault(masterPw);
      setMasterPw(''); setMasterPwConfirm('');
    } catch (err: any) {
      setMasterPwError(err?.message || 'Failed to create vault.');
    } finally {
      setMasterPwLoading(false);
    }
  };

  const handleSavePendingLogin = async () => {
    if (!pendingSave || !pendingEdit) return;
    try {
      await addEntry({ type: 'login', website: pendingEdit.title || pendingSave.domain, url: pendingSave.url, username: pendingEdit.username, password: pendingEdit.password, category: 'Other' });
      toast({ title: 'Login saved to vault', description: pendingEdit.title || pendingSave.domain });
      setPendingSave(null); setPendingEdit(null); setPendingExpanded(false);
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
  };

  const handleAutoFill = async (entry: PasswordEntry) => {
    // Only fill a login on its own site: a look-alike page gets nothing.
    const here = tabInfo ? baseDomain(new URL(tabInfo.url).hostname) : '';
    const matches = !!here && [entry.url, ...(entry.urls ?? [])].some(u => { try { return baseDomain(new URL(u!).hostname) === here; } catch { return false; } });
    if (!matches) {
      toast({ title: `This login is not for ${tabInfo?.domain ?? 'this page'}`, description: 'Copy the password instead if you are sure.', variant: 'destructive' });
      return;
    }
    try {
      const ok = await AutoFillService.fillCredentials(entry.username, entry.password, here);
      if (!ok) { toast({ title: 'No login form found on this page', variant: 'destructive' }); return; }
      const cfg = parseTotp(entry.totp);
      if (cfg) {
        await clipboardCopy((await totpNow(cfg)).code, entry.id + '2FA');
        toast({ title: 'Filled', description: '2FA code copied, paste it on the next step.' });
        setTimeout(() => window.close(), 900);
      } else {
        window.close();
      }
    } catch { toast({ title: 'Autofill failed', description: 'Could not fill on this page.', variant: 'destructive' }); }
  };

  const copyTotp = async (entry: PasswordEntry) => {
    const cfg = parseTotp(entry.totp);
    if (cfg) await copyToClipboard((await totpNow(cfg)).code, '2FA code', entry.id);
  };

  const copyToClipboard = async (text: string, type: string, id: string) => {
    const ok = await clipboardCopy(text, id + type);
    if (ok) { toast({ title: `${type} copied` }); }
    else { toast({ title: 'Copy failed', variant: 'destructive' }); }
  };

  const inputCls = 'w-full h-10 pl-9 pr-10 text-sm bg-white/5 border border-border/60 rounded-xl focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/40';
  const btnPrimary = 'h-10 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold rounded-xl shadow-lg shadow-primary/15 active:scale-[.98] transition-all';

  if (authLoading) {
    return (
      <div className="w-[360px] h-[480px] bg-background text-foreground flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-[360px] bg-background text-foreground flex flex-col">
        <div className="flex items-center justify-center px-4 pt-8 pb-2">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-in zoom-in-95 fade-in duration-500"><LogoMark px={56} tile /></div>
            <div className="text-center">
              <h1 className="text-lg font-semibold tracking-tight">Secure<span className="text-primary">Voult</span></h1>
              <p className="text-xs text-muted-foreground mt-0.5">Sign in with your SecureVoult account</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSignIn} className="flex flex-col gap-3 px-5 pt-5 pb-6">
          {signInError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{signInError}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input type="email" autoComplete="email" placeholder="you@example.com" value={signInEmail} required onChange={e => { setSignInEmail(e.target.value); setSignInError(''); }} className={inputCls} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input type={signInShowPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={signInPassword} required onChange={e => { setSignInPassword(e.target.value); setSignInError(''); }} className={inputCls} />
              <button type="button" onClick={() => setSignInShowPw(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {signInShowPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={signInLoading || !signInEmail || !signInPassword} className={btnPrimary + ' mt-1'}>
            {signInLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-4 h-4" />Sign in</>}
          </button>
          <div className="text-center pt-1">
            <button type="button" onClick={() => openFullApp()} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">No account yet, or forgot your password? Open the web app</button>
          </div>
        </form>
      </div>
    );
  }

  if (isUnlocked && newRecoveryKey) {
    return (
      <div className="w-[360px] bg-background text-foreground flex flex-col gap-3 p-5 animate-in fade-in duration-300">
        <p className="text-sm font-semibold">Save your recovery key</p>
        <p className="text-xs text-muted-foreground">If you forget your master password, this is the only way back in. It is shown once.</p>
        <div className="grid grid-cols-4 gap-1.5">
          {newRecoveryKey.split('-').map((g, i) => <span key={i} className="font-mono font-bold text-xs text-center py-1.5 rounded bg-secondary/70 select-all">{g}</span>)}
        </div>
        <p className="text-[11px] text-muted-foreground">Write it down now. For a printable kit, make a new one any time in the web app: Settings → Security.</p>
        <button onClick={dismissRecoveryKey} className={btnPrimary}>I&apos;ve saved it</button>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="w-[360px] bg-background text-foreground flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <LogoIcon size="sm" />
            <span className="text-xs font-medium">{user?.displayName || user?.email?.split('@')[0] || 'SecureVoult'}</span>
          </div>
          <button onClick={() => signOut()} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Switch account</button>
        </div>
        {secondFactor === 'required' ? (
          <div className="px-5 pt-6 pb-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <SecondFactorStep compact />
          </div>
        ) : vaultMode === 'create' ? (
          <div className="flex flex-col items-center px-5 pt-7 pb-7">
            <div className="mb-4"><LogoMark px={52} tile /></div>
            <h2 className="text-sm font-bold mb-1">Set up your vault</h2>
            <p className="text-xs text-muted-foreground text-center mb-1 leading-relaxed">Create a master password to protect your vault.</p>
            <p className="text-[11px] text-yellow-500/80 text-center mb-5">You cannot recover this password — write it down.</p>
            <form onSubmit={handleCreateVault} className="w-full space-y-3">
              {masterPwError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{masterPwError}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Master password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input type={masterPwShow ? 'text' : 'password'} autoComplete="new-password" placeholder="Min. 8 characters" value={masterPw} autoFocus required onChange={e => { setMasterPw(e.target.value); setMasterPwError(''); }} className={inputCls} />
                  <button type="button" onClick={() => setMasterPwShow(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">{masterPwShow ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input type={masterPwConfirmShow ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat master password" value={masterPwConfirm} required onChange={e => { setMasterPwConfirm(e.target.value); setMasterPwError(''); }} className={inputCls} />
                  <button type="button" onClick={() => setMasterPwConfirmShow(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">{masterPwConfirmShow ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
              <button type="submit" disabled={masterPwLoading || vaultLoading || !masterPw || !masterPwConfirm} className={btnPrimary}>
                {(masterPwLoading || vaultLoading) ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ShieldCheck className="w-4 h-4" />Create vault</>}
              </button>
            </form>
            <button onClick={() => { setVaultMode('unlock'); setMasterPwError(''); setMasterPw(''); setMasterPwConfirm(''); }} className="mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors">← Already have a vault?</button>
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 pt-7 pb-7">
            <div className="mb-4 animate-in zoom-in-95 fade-in duration-500"><LogoMark px={52} tile /></div>
            <h2 className="text-base font-semibold mb-1">Unlock your vault</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">Your master password never leaves this device.</p>
            <form onSubmit={handleUnlockVault} className="w-full space-y-3">
              {(masterPwError || vaultError) && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{masterPwError || vaultError}</p>
                </div>
              )}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input type={masterPwShow ? 'text' : 'password'} autoComplete="current-password" placeholder="Master password" value={masterPw} autoFocus required onChange={e => { setMasterPw(e.target.value); setMasterPwError(''); }} className={inputCls} />
                <button type="button" onClick={() => setMasterPwShow(v => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">{masterPwShow ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
              </div>
              <button type="submit" disabled={masterPwLoading || vaultLoading || !masterPw} className={btnPrimary}>
                {(masterPwLoading || vaultLoading) ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Key className="w-4 h-4" />Unlock vault</>}
              </button>
            </form>
            <button onClick={() => { setVaultMode('create'); setMasterPwError(''); setMasterPw(''); }} className="mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors">First time? Set up a new vault →</button>
            <button onClick={() => openFullApp()} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">Open full app ↗</button>
          </div>
        )}
      </div>
    );
  }

  const filteredEntries = searchQuery
    ? getFilteredEntries().filter(e => e.website.toLowerCase().includes(searchQuery.toLowerCase()) || e.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : matchingEntries;

  const recentEntries = (!searchQuery && matchingEntries.length === 0)
    ? [...(vault?.entries ?? [])].filter(e => (e.type ?? 'login') === 'login').sort((a, b) => {
        const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : new Date(a.updatedAt).getTime();
        const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      }).slice(0, 6)
    : [];

  const letter = (entry: PasswordEntry) => (entry.website || '?')[0].toUpperCase();
  const gradients = ['from-primary to-amber-700', 'from-stone-500 to-stone-700', 'from-emerald-500 to-teal-600', 'from-orange-500 to-red-600'];
  const gradient = (entry: PasswordEntry) => gradients[letter(entry).charCodeAt(0) % gradients.length];
  const initials = (user?.displayName || user?.email || 'U').split(/[\s@.]/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const breachNotes = notes.items.filter(n => n.kind === 'breach' && !n.read).length;

  const doSync = async () => {
    setSyncing(true);
    try { await refresh(); toast({ title: 'Vault synced' }); } catch { toast({ title: 'Sync failed', variant: 'destructive' }); }
    setSyncing(false);
  };

  const Row = ({ entry }: { entry: PasswordEntry }) => {
    const t = typeOf(entry);
    const isLogin = t === 'login';
    return (
      <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/70 transition-colors">
        <button onClick={() => (isLogin ? handleAutoFill(entry) : openFullApp('all'))} title={isLogin ? 'Fill on this page' : 'Open in SecureVoult'} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient(entry)} flex items-center justify-center flex-shrink-0 shadow-sm`}><span className="text-sm font-bold text-white">{letter(entry)}</span></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate flex items-center gap-1.5">{entry.website}{!!entry.passkeys?.length && <span className="text-[10px] font-semibold px-1.5 rounded bg-emerald-500/15 text-emerald-300">Passkey</span>}</p>
            <p className="text-xs text-muted-foreground truncate">{isLogin ? (entry.username || 'No username') : ITEM_TYPE[t].label}</p>
          </div>
        </button>
        {isLogin && (
          <div className="flex items-center gap-0.5">
            <button onClick={() => copyToClipboard(entry.username, 'Username', entry.id)} title="Copy username" aria-label="Copy username" className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + 'Username' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</button>
            <button onClick={() => copyToClipboard(entry.password, 'Password', entry.id)} title="Copy password" aria-label="Copy password" className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + 'Password' ? <Check className="w-4 h-4 text-green-400" /> : <Key className="w-4 h-4" />}</button>
            {entry.totp && <button onClick={() => copyTotp(entry)} title="Copy 2FA code" aria-label="Copy 2FA code" className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + '2FA code' ? <Check className="w-4 h-4 text-green-400" /> : <ShieldCheck className="w-4 h-4" />}</button>}
          </div>
        )}
      </div>
    );
  };

  const PanelHeader = ({ title }: { title: string }) => (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 h-14 border-b border-border/50">
      <button onClick={() => setPanel('list')} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary/70"><ChevronLeft className="w-5 h-5" /></button>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );

  const tools = [
    { label: 'Password generator', icon: Wand2, hash: 'generator', cls: 'text-orange-300' },
    { label: 'Email masking', icon: VenetianMask, hash: 'masking', cls: 'text-sky-300' },
    { label: 'Password health', icon: HeartPulse, hash: 'security', cls: 'text-rose-300' },
    { label: 'Data breach scanner', icon: ScanSearch, hash: 'breach', cls: 'text-emerald-300', badge: breachNotes },
  ];

  return (
    <div className="w-[360px] h-[580px] flex flex-col bg-background text-foreground">
      {panel === 'notifications' && (
        <>
          <PanelHeader title="Notifications" />
          <div className="flex-1 overflow-y-auto">
            <NotificationList dense items={notes.items} onMarkAll={() => void notes.markRead()}
              onOpen={(n) => { void notes.markRead([n.id]); openFullApp(n.kind === 'breach' ? 'breach' : 'all'); }} />
          </div>
        </>
      )}

      {panel === 'tools' && (
        <>
          <PanelHeader title="Tools" />
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2.5">
              {tools.map(({ label, icon: Icon, hash, cls, badge }) => (
                <button key={hash} onClick={() => openFullApp(hash)} className="relative h-[104px] rounded-2xl bg-secondary/60 hover:bg-secondary border border-border/50 p-3.5 text-left flex flex-col justify-between transition-colors">
                  <Icon className={`w-7 h-7 ${cls}`} />
                  <span className="text-sm font-semibold leading-tight">{label}</span>
                  {!!badge && <span className="absolute top-3 right-3 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 px-1">Each tool opens in the full SecureVoult app.</p>
          </div>
        </>
      )}

      {panel === 'create' && (
        <>
          <PanelHeader title="Create item" />
          <div className="flex-1 overflow-y-auto p-2">
            {ITEM_TYPES.map(({ type, label, hint, icon: Icon, color }) => (
              <button key={type} onClick={() => openFullApp(`new/${type}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/70 text-left">
                <span className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-5 h-5" /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground truncate">{hint}</span></span>
              </button>
            ))}
          </div>
        </>
      )}

      {panel === 'list' && (
      <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2 min-w-0">
          <LogoMark px={24} className="flex-shrink-0" />
          <h1 className="text-lg font-semibold">Vault</h1>
          {tabInfo && matchingEntries.length > 0 && (
            <span className="bg-primary/15 text-primary px-1.5 py-0.5 rounded-md text-[11px] font-medium truncate max-w-[110px]" title={tabInfo.domain}>{matchingEntries.length} for {tabInfo.domain}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPanel('notifications')} aria-label={notes.unread ? `Notifications, ${notes.unread} unread` : 'Notifications'} className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70">
            <Bell className="w-5 h-5" />
            {notes.unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{notes.unread > 99 ? '99+' : notes.unread}</span>}
          </button>
          <button onClick={() => setPanel('tools')} aria-label="Tools" className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70">
            <Wrench className="w-5 h-5" />
            {breachNotes > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account" className="ml-1 w-9 h-9 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center hover:ring-2 hover:ring-primary/40">{initials}</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal"><span className="block text-xs text-muted-foreground">Signed in as</span><span className="block text-sm truncate">{user?.email}</span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openFullApp('all')}><Maximize2 className="mr-2 h-4 w-4" />Open SecureVoult</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openFullApp('settings')}><Settings className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => lockVault()}><Lock className="mr-2 h-4 w-4" />Lock vault</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-shrink-0 px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="Search all items" aria-label="Search all items" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus
            className="w-full h-11 pl-11 pr-3 text-sm bg-secondary/60 border border-border/70 rounded-xl focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground" />
        </div>
      </div>
      {pendingSave && !pendingDismissed && pendingEdit && (
        <div className="flex-shrink-0 mx-3 mt-2.5 bg-primary/8 border border-primary/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-primary">Save this login?</span>
              <span className="text-[11px] text-muted-foreground/70">— {pendingSave.domain}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPendingExpanded(v => !v)} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">{pendingExpanded ? 'Collapse' : 'Edit'}</button>
              <button onClick={() => setPendingDismissed(true)} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"><X className="w-3 h-3" /></button>
            </div>
          </div>
          {pendingExpanded && (
            <div className="px-3 pb-3 space-y-2 border-t border-primary/10">
              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Title</label>
                <input className="w-full h-7 text-xs bg-secondary/60 border border-border/60 rounded-lg px-2.5 focus:outline-none focus:border-primary" value={pendingEdit.title} onChange={e => setPendingEdit(prev => prev ? { ...prev, title: e.target.value } : null)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Username</label>
                <input className="w-full h-7 text-xs bg-secondary/60 border border-border/60 rounded-lg px-2.5 focus:outline-none focus:border-primary" value={pendingEdit.username} onChange={e => setPendingEdit(prev => prev ? { ...prev, username: e.target.value } : null)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type={pendingShowPw ? 'text' : 'password'} className="w-full h-7 text-xs bg-secondary/60 border border-border/60 rounded-lg px-2.5 pr-12 focus:outline-none focus:border-primary font-mono" value={pendingEdit.password} onChange={e => setPendingEdit(prev => prev ? { ...prev, password: e.target.value } : null)} />
                  <button onClick={() => setPendingShowPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground">{pendingShowPw ? 'Hide' : 'Show'}</button>
                </div>
              </div>
            </div>
          )}
          {!pendingExpanded && <div className="px-3 pb-2.5 text-[11px] text-muted-foreground">{pendingEdit.username} · {pendingEdit.password.length} chars</div>}
          <div className="flex gap-2 px-3 pb-3">
            <button onClick={() => setPendingDismissed(true)} className="flex-1 text-[11px] text-muted-foreground border border-border/60 rounded-lg py-1.5 hover:bg-secondary/40 transition-colors">Not now</button>
            <button onClick={handleSavePendingLogin} className="flex-[2] text-[11px] bg-primary text-primary-foreground rounded-lg px-3 py-1.5 font-semibold hover:bg-primary/90 transition-colors">Save to vault</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 border-t border-border/40">
        {filteredEntries.length > 0 ? (
          <div className="p-2">
            <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground">{searchQuery ? `${filteredEntries.length} result${filteredEntries.length !== 1 ? 's' : ''}` : `Suggested for ${tabInfo?.domain ?? 'this site'}`}</p>
            {filteredEntries.map(entry => <Row key={entry.id} entry={entry} />)}
          </div>
        ) : recentEntries.length > 0 ? (
          <div className="p-2">
            {tabInfo && (
              <div className="mx-1 mb-2 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="text-sm font-medium truncate">Nothing saved for {tabInfo.domain}</p><p className="text-xs text-muted-foreground">Sign in once and SecureVoult offers to save it.</p></div>
                <button onClick={() => openFullApp('new/login')} className="flex-shrink-0 h-8 px-3 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25">Add</button>
              </div>
            )}
            <p className="px-3 pt-1 pb-1 text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Recently used</p>
            {recentEntries.map(entry => <Row key={entry.id} entry={entry} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">{searchQuery ? <Search className="w-5 h-5 text-muted-foreground" /> : <Save className="w-5 h-5 text-primary" />}</div>
            <p className="text-sm font-semibold">{searchQuery ? 'No results' : 'Your vault is empty'}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">{searchQuery ? `Nothing matched "${searchQuery}".` : 'Add your first password, or import from another manager in the app.'}</p>
            <button onClick={() => setPanel('create')} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center gap-1.5"><Plus className="w-4 h-4" />Create item</button>
          </div>
        )}
      </div>

      {/* Big, labelled actions: nobody has to guess what a tiny icon does. */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-1.5 p-2 border-t border-border/50 bg-card/60">
        <button onClick={() => lockVault()} className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
          <Lock className="w-5 h-5" /><span className="text-[11px] font-medium">Lock</span>
        </button>
        <button onClick={doSync} disabled={syncing} className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
          <RefreshCw className={`w-5 h-5 ${syncing || syncStatus === 'syncing' ? 'animate-spin text-primary' : syncStatus === 'failed' ? 'text-red-400' : ''}`} /><span className="text-[11px] font-medium">{syncing ? 'Syncing' : syncStatus === 'failed' ? 'Retry sync' : 'Sync'}</span>
        </button>
        <button onClick={() => setPanel('create')} className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="w-5 h-5" /><span className="text-[11px] font-semibold">New item</span>
        </button>
        <button onClick={() => openFullApp('all')} className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
          <Maximize2 className="w-5 h-5" /><span className="text-[11px] font-medium">Full screen</span>
        </button>
      </div>
      </>
      )}
    </div>
  );
}
