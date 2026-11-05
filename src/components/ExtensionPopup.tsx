// Extension popup component
'use client';

import { useState, useEffect } from 'react';
import { LogoIcon } from '@/components/Logo';
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
  Globe, Save, ShieldCheck, X, Clock, Eye, EyeOff, Shield, Mail,
  LogIn, AlertCircle,
} from 'lucide-react';

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
  const { secondFactor, newRecoveryKey, dismissRecoveryKey, isUnlocked, vault, error: vaultError, isLoading: vaultLoading, findEntriesForCurrentDomain, getFilteredEntries, lockVault, addEntry, unlockVault, createVault } = useVault();
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

  const openFullApp = () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vault.autisync.com';
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
  const btnPrimary = 'h-10 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all';

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
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-base font-bold tracking-tight">SecureVoult</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Sign in to access your vault</p>
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
            <button type="button" onClick={openFullApp} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">Forgot password? Open web app →</button>
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
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-4">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
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
              <button type="submit" disabled={masterPwLoading || vaultLoading || !masterPw || !masterPwConfirm} className="h-10 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all">
                {(masterPwLoading || vaultLoading) ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ShieldCheck className="w-4 h-4" />Create vault</>}
              </button>
            </form>
            <button onClick={() => { setVaultMode('unlock'); setMasterPwError(''); setMasterPw(''); setMasterPwConfirm(''); }} className="mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors">← Already have a vault?</button>
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 pt-7 pb-7">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-4">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-sm font-bold mb-1">Vault is locked</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">Enter your master password to unlock</p>
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
            <button onClick={openFullApp} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">Open full app ↗</button>
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

  return (
    <div className="w-[360px] max-h-[560px] flex flex-col bg-background text-foreground">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <LogoIcon size="sm" />
          {tabInfo && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span className="max-w-[140px] truncate">{tabInfo.domain}</span>
              {matchingEntries.length > 0 && (
                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">{matchingEntries.length} match{matchingEntries.length !== 1 ? 'es' : ''}</span>
              )}
            </div>
          )}
        </div>
        <button onClick={openFullApp} title="Open full app" className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="Search vault…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-8 pl-8 pr-3 text-xs bg-secondary/50 border border-border/60 rounded-lg focus:outline-none focus:border-primary transition-colors" />
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
            <button onClick={handleSavePendingLogin} className="flex-[2] text-[11px] bg-primary text-white rounded-lg px-3 py-1.5 font-semibold hover:bg-primary/90 transition-colors">Save to vault</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredEntries.length > 0 ? (
          <div className="p-2">
            {!searchQuery && tabInfo && matchingEntries.length > 0 && <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Saved for {tabInfo.domain}</p>}
            {searchQuery && <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}</p>}
            <div className="space-y-0.5">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary/60 transition-colors">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient(entry)} flex items-center justify-center flex-shrink-0`}><span className="text-xs font-bold text-white">{letter(entry)}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{entry.website}</p><p className="text-[11px] text-muted-foreground truncate">{entry.username}</p></div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onClick={() => handleAutoFill(entry)} title="Autofill" className="w-6 h-6 flex items-center justify-center rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Key className="w-3 h-3" /></button>
                    <button onClick={() => copyToClipboard(entry.username, 'Username', entry.id)} title="Copy username" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + 'Username' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}</button>
                    <button onClick={() => copyToClipboard(entry.password, 'Password', entry.id)} title="Copy password" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + 'Password' ? <Check className="w-3 h-3 text-green-400" /> : <Key className="w-3 h-3" />}</button>
                    {entry.totp && <button onClick={() => copyTotp(entry)} title="Copy 2FA code" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + '2FA code' ? <Check className="w-3 h-3 text-green-400" /> : <ShieldCheck className="w-3 h-3" />}</button>}
                    {entry.url && <button onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')} title="Open site" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><ExternalLink className="w-3 h-3" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : recentEntries.length > 0 ? (
          <div className="p-2">
            <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1"><Clock className="w-2.5 h-2.5" />Recently used</p>
            <div className="space-y-0.5">
              {recentEntries.map(entry => (
                <div key={entry.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary/60 transition-colors">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient(entry)} flex items-center justify-center flex-shrink-0`}><span className="text-xs font-bold text-white">{letter(entry)}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{entry.website}</p><p className="text-[11px] text-muted-foreground truncate">{entry.username}</p></div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onClick={() => handleAutoFill(entry)} title="Autofill" className="w-6 h-6 flex items-center justify-center rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"><Key className="w-3 h-3" /></button>
                    <button onClick={() => copyToClipboard(entry.username, 'Username', entry.id)} title="Copy username" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + 'Username' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}</button>
                    <button onClick={() => copyToClipboard(entry.password, 'Password', entry.id)} title="Copy password" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + 'Password' ? <Check className="w-3 h-3 text-green-400" /> : <Key className="w-3 h-3" />}</button>
                    {entry.totp && <button onClick={() => copyTotp(entry)} title="Copy 2FA code" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{copied === entry.id + '2FA code' ? <Check className="w-3 h-3 text-green-400" /> : <ShieldCheck className="w-3 h-3" />}</button>}
                    {entry.url && <button onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')} title="Open site" className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><ExternalLink className="w-3 h-3" /></button>}
                  </div>
                </div>
              ))}
            </div>
            {tabInfo && (
              <div className="mt-2 mx-1 bg-secondary/30 border border-border/40 rounded-lg px-3 py-2 flex items-center justify-between">
                <div><p className="text-[11px] font-medium">No login for {tabInfo.domain}</p><p className="text-[10px] text-muted-foreground">Save credentials for faster access next time</p></div>
                <button onClick={openFullApp} className="text-[10px] text-primary flex-shrink-0 ml-2 font-medium">Add →</button>
              </div>
            )}
            <button onClick={openFullApp} className="w-full mt-1.5 text-center text-[11px] text-muted-foreground hover:text-foreground py-1 transition-colors">Browse all entries ↗</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            {!searchQuery && tabInfo ? (
              <>
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3"><Save className="w-5 h-5 text-primary" /></div>
                <p className="text-xs font-semibold mb-1">No saved login for</p>
                <p className="text-[11px] text-primary font-mono mb-3 truncate max-w-[180px]">{tabInfo.domain}</p>
                <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">Save your credentials to autofill next time you visit.</p>
                <button onClick={openFullApp} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-lg font-medium transition-colors"><Plus className="w-3 h-3" />Save this login</button>
                <button onClick={openFullApp} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">Or search all entries</button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center mb-3"><Search className="w-4 h-4 text-muted-foreground/50" /></div>
                <p className="text-xs font-medium">No results</p>
                <p className="text-[11px] text-muted-foreground mt-1 mb-4">{searchQuery ? `Nothing matched "${searchQuery}"` : 'Your vault is empty'}</p>
                <button onClick={openFullApp} className="flex items-center gap-1.5 text-xs text-primary hover:underline"><Plus className="w-3 h-3" />{searchQuery ? 'Add entry in app' : 'Open SecureVoult'}</button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 px-3 py-2.5 border-t border-border/50 flex items-center justify-between">
        <button onClick={openFullApp} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Open full app ↗</button>
        <button onClick={() => lockVault()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><Lock className="w-3 h-3" />Lock</button>
      </div>
    </div>
  );
}
