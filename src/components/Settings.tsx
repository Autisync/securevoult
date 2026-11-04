'use client';

import { useState, useRef, useEffect } from 'react';
import { useDeviceSessions } from '@/hooks/useDeviceSessions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useVault } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useVaultPreferences } from '@/hooks/useVaultPreferences';
import { TwoStepSettings, RecoveryKitSettings } from '@/components/AccountSecurity';
import { parseCsv, detectSource, type CsvSource } from '@/lib/importers';
import { CryptoService } from '@/lib/crypto';
import {
  User, Shield, Palette, FileDown, FileUp, Info, AlertTriangle,
  Download, Upload, CheckCircle2, Loader2, Lock, Clock, Clipboard,
  Eye, EyeOff, RefreshCw, Puzzle, Monitor, Tag, X as XIcon, Hash,
  Smartphone, Globe, Sun, Moon, SlidersHorizontal, Activity,
  CreditCard, Fingerprint,
} from 'lucide-react';
import { BillingSettings } from '@/components/BillingSettings';
import { PasskeySettings } from '@/components/PasskeySettings';
import { TrustSignals } from '@/components/TrustSignals';
import { PlanBadge } from '@/components/PlanGate';
import { canUsePasskeys } from '@/lib/feature-gates';
import type { PlanId } from '@/lib/plans';

interface SettingsProps {
  onClose?: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { vault, exportVault, exportVaultCSV, importVault, importFromCSV, lockVault, updateEntry, changeMasterPassword } = useVault();
  const { user } = useAuth();
  const { toast } = useToast();
  const { prefs, setPref } = useVaultPreferences();
  const { sessions, loading: sessionsLoading, error: sessionsError, fetchSessions, revokeSession, revokeOtherSessions } = useDeviceSessions();

  // Export states
  const [exportLoading, setExportLoading] = useState(false);
  const [showCsvWarning, setShowCsvWarning] = useState(false);
  const [csvExportConfirmed, setCsvExportConfirmed] = useState(false);

  // Import states
  const [importLoading, setImportLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{
    rows: string[][];
    headers: string[];
    file: File;
    // column mapping: field -> header index
    mapping: Record<string, number | null>;
    step: 'preview' | 'mapping' | 'confirm' | 'known';
    source: CsvSource;
    total: number;
  } | null>(null);
  // Restoring a backup needs the master password it was made with.
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  // Changing the master password.
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const nextStrength = CryptoService.checkPasswordStrength(pwForm.next);
  const pwFormReady = !!pwForm.current && pwForm.next.length >= 12 && pwForm.next === pwForm.confirm && pwForm.next !== pwForm.current;

  const handleChangeMasterPassword = async () => {
    if (!pwFormReady) return;
    setPwSaving(true);
    try {
      await changeMasterPassword(pwForm.current, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      toast({ title: 'Master password changed', description: 'Use the new one on every device from now on.' });
    } catch (err) {
      const wrong = err instanceof Error && err.name === 'WrongPasswordError';
      toast({ title: wrong ? 'Current master password is not right' : 'Could not change it', description: wrong ? undefined : (err instanceof Error ? err.message : ''), variant: 'destructive' });
    } finally {
      setPwSaving(false);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const entryCount = vault?.entries.length ?? 0;


  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExportEncrypted = async () => {
    setExportLoading(true);
    try {
      const data = await exportVault();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securevoult-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Encrypted backup downloaded', description: `${entryCount} entries exported.` });
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!csvExportConfirmed) { setShowCsvWarning(true); return; }
    const csv = exportVaultCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securevoult-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: 'CSV exported', description: 'Passwords exported in plain text. Store this file securely.' });
    setShowCsvWarning(false); setCsvExportConfirmed(false);
  };

  // ── Import JSON ─────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setBackupFile(file);
    setBackupPassword('');
  };

  const handleRestoreBackup = async () => {
    if (!backupFile || !backupPassword) return;
    setImportLoading(true);
    try {
      await importVault(await backupFile.text(), backupPassword);
      setBackupFile(null);
      setBackupPassword('');
      toast({ title: 'Backup restored', description: 'Items not already in your vault were added.' });
    } catch (err) {
      toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'Invalid file.', variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  // ── Import CSV ──────────────────────────────────────────────────────────────
  // Auto-detect column mapping from common CSV export header names
  const autoDetectMapping = (headers: string[]): Record<string, number | null> => {
    const h = headers.map(s => s.toLowerCase().trim());
    const find = (...terms: string[]): number | null => {
      for (const term of terms) {
        const idx = h.findIndex(header => header.includes(term));
        if (idx >= 0) return idx;
      }
      return null;
    };
    return {
      website:  find('name', 'title', 'site', 'service', 'account'),
      url:      find('url', 'website', 'uri', 'link', 'address'),
      username: find('username', 'user', 'email', 'login', 'account'),
      password: find('password', 'pass', 'pwd', 'secret'),
      notes:    find('notes', 'note', 'comment', 'extra', 'memo'),
    };
  };

  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { toast({ title: 'CSV is empty or unreadable', variant: 'destructive' }); return; }
    const headers = parsed[0];
    const previewRows = parsed.slice(1, 6);
    const mapping = autoDetectMapping(headers);
    const source = detectSource(headers);
    setCsvPreview({ rows: previewRows, headers, file, mapping, step: source === 'CSV' ? 'mapping' : 'known', source, total: parsed.length - 1 });
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleConfirmCsvImport = async () => {
    if (!csvPreview) return;
    setImportLoading(true);
    try {
      const text = await csvPreview.file.text();
      const { imported, skipped, duplicates, source } = await importFromCSV(text, csvPreview.mapping);
      const extra = [duplicates && `${duplicates} already in your vault`, skipped && `${skipped} skipped (folders or empty rows)`].filter(Boolean).join(', ');
      toast({ title: `${imported} item${imported === 1 ? '' : 's'} imported from ${source === 'CSV' ? 'the CSV' : source}`, description: extra || 'Everything is encrypted in your vault now.' });
      setCsvPreview(null);
    } catch (err) {
      toast({ title: 'CSV import failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  // ── Tag management ──────────────────────────────────────────────────────────
  const allTags = (() => {
    const map = new Map<string, number>();
    for (const e of vault?.entries ?? []) {
      for (const t of (e.tags ?? [])) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  })();

  const handleRemoveTagFromAll = async (tag: string) => {
    const affected = (vault?.entries ?? []).filter(e => e.tags?.includes(tag));
    let done = 0;
    for (const entry of affected) {
      try {
        await updateEntry(entry.id, { tags: (entry.tags ?? []).filter(t => t !== tag) });
        done++;
      } catch { /* continue */ }
    }
    toast({ title: `Tag "${tag}" removed from ${done} ${done === 1 ? 'entry' : 'entries'}` });
  };

  // ── Section wrapper ─────────────────────────────────────────────────────────
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider border-b border-border/50 pb-2">{title}</h3>
      {children}
    </div>
  );

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your SecureVoult preferences and data.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-secondary/50 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile"><User className="w-3.5 h-3.5 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-3.5 h-3.5 mr-1.5" />Security</TabsTrigger>
          <TabsTrigger value="passkeys"><Fingerprint className="w-3.5 h-3.5 mr-1.5" />Passkeys</TabsTrigger>
          <TabsTrigger value="vault"><Lock className="w-3.5 h-3.5 mr-1.5" />Vault</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="w-3.5 h-3.5 mr-1.5" />Appearance</TabsTrigger>
          <TabsTrigger value="importexport"><FileDown className="w-3.5 h-3.5 mr-1.5" />Import / Export</TabsTrigger>
          <TabsTrigger value="extension"><Puzzle className="w-3.5 h-3.5 mr-1.5" />Extension</TabsTrigger>
          <TabsTrigger value="devices"><Monitor className="w-3.5 h-3.5 mr-1.5" />Devices</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Billing</TabsTrigger>
          <TabsTrigger value="about"><Info className="w-3.5 h-3.5 mr-1.5" />About</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="mt-5 space-y-6">
          <Section title="Account">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.displayName || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <span className="flex-shrink-0">
                  <PlanBadge plan={((user as unknown as { plan?: PlanId })?.plan ?? 'free') as PlanId} size="md" />
                </span>
              </div>
              <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
                <p className="text-xs text-muted-foreground">
                  Upgrade to Pro for unlimited entries, breach history, passkeys, and priority support.{' '}
                  <button
                    className="text-primary hover:underline font-medium"
                    onClick={() => {
                      const el = document.querySelector('[data-value="billing"]') as HTMLButtonElement | null;
                      el?.click();
                    }}
                  >
                    View plans →
                  </button>
                </p>
              </div>
            </div>
          </Section>
          <Section title="Vault overview">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total entries', value: String(entryCount) },
                { label: 'Encryption', value: 'AES-256-GCM' },
                { label: 'Key derivation', value: 'Argon2id', sub: '64 MiB, 3 passes' },
                { label: 'Architecture', value: 'Zero-knowledge' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-card border border-border rounded-xl px-4 py-3">
                  <p className="text-lg font-bold text-primary leading-tight">{value}</p>
                  {sub && <p className="text-xs text-muted-foreground/60">{sub}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Master password & recovery">
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Change master password</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your items stay as they are; only the lock changes. Other devices ask for the new one next time they unlock.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Input type="password" autoComplete="current-password" placeholder="Current master password" className="h-9 bg-secondary/50"
                    value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
                  <Input type="password" autoComplete="new-password" placeholder="New master password (12+ characters)" className="h-9 bg-secondary/50"
                    value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
                  <Input type="password" autoComplete="new-password" placeholder="New master password again" className="h-9 bg-secondary/50"
                    value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                </div>
                {pwForm.next && (
                  <p className="text-xs text-muted-foreground">
                    Strength: <span className="font-medium capitalize">{nextStrength.strength}</span>
                    {pwForm.next.length < 12 && ' · use at least 12 characters'}
                    {pwForm.confirm && pwForm.confirm !== pwForm.next && ' · the two new passwords differ'}
                  </p>
                )}
                <Button size="sm" className="h-8 text-xs" onClick={handleChangeMasterPassword} disabled={!pwFormReady || pwSaving}>
                  {pwSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Changing…</> : 'Change master password'}
                </Button>
              </div>
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />Your master password cannot be recovered
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Because of zero-knowledge encryption, your master password is never stored anywhere — not even on our servers. If you forget it, your vault data cannot be decrypted. Keep it in a safe, offline location.
                </p>
              </div>
              <RecoveryKitSettings />
            </div>
          </Section>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-5 space-y-6">
          <Section title="Two-step sign-in">
            <TwoStepSettings />
          </Section>
          <Section title="Recovery Kit">
            <RecoveryKitSettings />
          </Section>
          <Section title="Auto-lock">
            <Row label="Lock after inactivity" hint={prefs.autoLockMinutes === 0 ? 'Auto-lock is disabled.' : `Locks after ${prefs.autoLockMinutes} minute${prefs.autoLockMinutes === 1 ? '' : 's'} of inactivity.`}>
              <Select value={String(prefs.autoLockMinutes)} onValueChange={v => setPref('autoLockMinutes', parseInt(v, 10))}>
                <SelectTrigger className="w-36 h-9 bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="0">Never</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>
          <Section title="Clipboard">
            <Row label="Clear clipboard after" hint={prefs.clipboardTimeoutSeconds === 0 ? 'Clipboard is not cleared automatically.' : `Clears ${prefs.clipboardTimeoutSeconds}s after copying a password.`}>
              <Select value={String(prefs.clipboardTimeoutSeconds)} onValueChange={v => setPref('clipboardTimeoutSeconds', parseInt(v, 10))}>
                <SelectTrigger className="w-36 h-9 bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="0">Never</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>
          <Section title="Quick lock">
            <Row label="Lock vault now" hint="Immediately locks your vault and requires master password to re-open.">
              <Button variant="outline" size="sm" className="h-9" onClick={() => { lockVault(); onClose?.(); }}>
                <Lock className="w-3.5 h-3.5 mr-1.5" />Lock now
              </Button>
            </Row>
          </Section>
          <Section title="Two-factor awareness">
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4 flex-shrink-0" />Use a 2FA tag to track accounts
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add a <strong>2fa</strong> tag to vault entries that have two-factor authentication enabled.
                SecureVoult will surface missing-2FA entries in the Security Center so you can prioritize enabling it.
              </p>
            </div>
          </Section>
        </TabsContent>

        {/* Passkeys */}
        <TabsContent value="passkeys" className="mt-5 space-y-6">
          <PasskeySettings
            planAllows={canUsePasskeys(((user as unknown as { plan?: PlanId })?.plan ?? 'free') as PlanId)}
          />
          <Section title="Why passkeys?">
            <TrustSignals max={3} compact />
          </Section>
        </TabsContent>

        {/* Vault preferences */}
        <TabsContent value="vault" className="mt-5 space-y-6">
          <Section title="Password generator defaults">
            <Row label="Default length" hint={`${prefs.defaultPasswordLength} characters`}>
              <div className="w-40">
                <Slider
                  min={8} max={64} step={1}
                  value={[prefs.defaultPasswordLength]}
                  onValueChange={([v]) => setPref('defaultPasswordLength', v)}
                  className="cursor-pointer"
                />
              </div>
            </Row>
            <Row label="Include uppercase letters">
              <Switch checked={prefs.defaultUppercase} onCheckedChange={v => setPref('defaultUppercase', v)} />
            </Row>
            <Row label="Include numbers">
              <Switch checked={prefs.defaultNumbers} onCheckedChange={v => setPref('defaultNumbers', v)} />
            </Row>
            <Row label="Include symbols">
              <Switch checked={prefs.defaultSymbols} onCheckedChange={v => setPref('defaultSymbols', v)} />
            </Row>
          </Section>
          <Section title="Vault defaults">
            <Row label="Default sort order" hint="How entries are ordered in the vault list.">
              <Select value={prefs.defaultSort} onValueChange={v => setPref('defaultSort', v as import('@/hooks/useVaultPreferences').DefaultSort)}>
                <SelectTrigger className="w-40 h-9 bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Last updated</SelectItem>
                  <SelectItem value="newest">Date added</SelectItem>
                  <SelectItem value="alpha">A → Z</SelectItem>
                  <SelectItem value="weakest">Weakest first</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Default new entry type" hint="Pre-selected type when creating a new entry.">
              <Select value={prefs.defaultEntryType} onValueChange={v => setPref('defaultEntryType', v as import('@/hooks/useVaultPreferences').DefaultEntryType)}>
                <SelectTrigger className="w-36 h-9 bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="note">Secure note</SelectItem>
                  <SelectItem value="card">Payment card</SelectItem>
                  <SelectItem value="identity">Identity</SelectItem>
                  <SelectItem value="wifi">Wi-Fi</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>
          <div className="bg-primary/8 border border-primary/15 rounded-xl p-4">
            <p className="text-xs text-primary/70">
              These defaults are applied when you open the password generator. You can always override them per session.
            </p>
          </div>

          <Section title="Tags">
            {allTags.length === 0 ? (
              <div className="bg-secondary/30 border border-border/50 rounded-xl px-4 py-6 text-center">
                <Tag className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground/60">No tags yet</p>
                <p className="text-xs text-muted-foreground/40 mt-0.5">Add tags to vault entries to organize and filter them.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  {allTags.length} tag{allTags.length > 1 ? 's' : ''} across {entryCount} entries. Click × to remove a tag from all entries.
                </p>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(([tag, count]) => (
                    <div key={tag} className="flex items-center gap-1.5 bg-secondary/60 border border-border/50 rounded-lg px-2.5 py-1.5 group">
                      <Tag className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-xs font-medium">{tag}</span>
                      <span className="text-xs text-muted-foreground/50 bg-background/50 rounded px-1">{count}</span>
                      <button
                        onClick={() => handleRemoveTagFromAll(tag)}
                        className="w-4 h-4 flex items-center justify-center rounded-sm text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title={`Remove "${tag}" from all entries`}
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="mt-5 space-y-6">
          <Section title="Theme">
            <Row label="Color theme" hint="Changes the app color scheme. Takes effect immediately.">
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map(t => {
                  const icons = { dark: Moon, light: Sun, system: Globe };
                  const Icon = icons[t];
                  const labels = { dark: 'Dark', light: 'Light', system: 'System' };
                  return (
                    <button
                      key={t}
                      onClick={() => setPref('theme', t)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        prefs.theme === t
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border bg-secondary/40 text-muted-foreground hover:border-border/80'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />{labels[t]}
                    </button>
                  );
                })}
              </div>
            </Row>
          </Section>
          <Section title="Display">
            <Row label="Compact view" hint="Show more entries with less vertical spacing.">
              <Switch checked={prefs.compactView} onCheckedChange={v => setPref('compactView', v)} />
            </Row>
          </Section>
        </TabsContent>

        {/* Import / Export */}
        <TabsContent value="importexport" className="mt-5 space-y-6">
          {/* Export */}
          <Section title="Export vault">
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Encrypted backup (.json)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exports your entire vault encrypted with your master password. Safe to store in cloud storage.
                    </p>
                  </div>
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 h-9" onClick={handleExportEncrypted} disabled={exportLoading || entryCount === 0}>
                  {exportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Download encrypted backup ({entryCount} entries)
                </Button>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Plain text CSV</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exports all passwords in plain text. Use only for migration to another password manager.
                    </p>
                  </div>
                </div>
                {showCsvWarning && !csvExportConfirmed && (
                  <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />Warning: This file will contain unencrypted passwords
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Anyone with access to this file can read all your passwords. Do not store this file in cloud storage or send it over email.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowCsvWarning(false)}>Cancel</Button>
                      <Button size="sm" className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white" onClick={() => { setCsvExportConfirmed(true); handleExportCSV(); }}>
                        I understand, export anyway
                      </Button>
                    </div>
                  </div>
                )}
                {!showCsvWarning && (
                  <Button variant="outline" className="w-full h-9 border-red-500/30 text-red-400 hover:bg-red-500/8" onClick={handleExportCSV}>
                    <Download className="w-4 h-4 mr-2" />Export plain CSV
                  </Button>
                )}
              </div>
            </div>
          </Section>

          {/* Import */}
          <Section title="Import vault">
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Import encrypted backup (.json)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Restores a SecureVoult encrypted backup. New entries are merged with your existing vault.
                    </p>
                  </div>
                </div>
                {backupFile ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      <strong>{backupFile.name}</strong>: enter the master password you had when this backup was made.
                    </p>
                    <Input type="password" autoComplete="off" placeholder="Master password for this backup" className="h-9 bg-secondary/50"
                      value={backupPassword} onChange={e => setBackupPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleRestoreBackup(); }} />
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setBackupFile(null); setBackupPassword(''); }}>Cancel</Button>
                      <Button size="sm" className="h-8 text-xs" onClick={handleRestoreBackup} disabled={!backupPassword || importLoading}>
                        {importLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Restoring…</> : 'Restore backup'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full h-9" onClick={() => fileInputRef.current?.click()} disabled={importLoading}>
                    <Upload className="w-4 h-4 mr-2" />Choose .json backup
                  </Button>
                )}
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <FileUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Import from another password manager</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      From NordPass: Settings → Export items → CSV. Logins, notes, cards, identities, folders and extra fields come across.
                    </p>
                  </div>
                </div>

                {csvPreview?.step === 'known' && (
                  <div className="space-y-3">
                    <div className="bg-secondary/50 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-medium text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />{csvPreview.source} export recognised
                      </p>
                      <p className="text-muted-foreground">
                        {csvPreview.total} row{csvPreview.total === 1 ? '' : 's'} in <strong>{csvPreview.file.name}</strong>.
                        Items already in your vault are skipped, so importing twice is safe.
                      </p>
                    </div>
                    <p className="text-xs text-amber-400/90">
                      After importing, delete the CSV file: it holds your passwords in plain text.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCsvPreview(null)}>Cancel</Button>
                      <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90" onClick={handleConfirmCsvImport} disabled={importLoading}>
                        {importLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Importing…</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Import from {csvPreview.source}</>}
                      </Button>
                    </div>
                  </div>
                )}

                {csvPreview && csvPreview.step !== 'known' && (
                  <div className="space-y-4">
                    {/* Step header */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${csvPreview.step === 'mapping' ? 'bg-primary text-white' : 'bg-green-500 text-white'}`}>1</span>
                      <span className={csvPreview.step === 'mapping' ? 'font-medium text-foreground' : 'text-muted-foreground/60 line-through'}>Map columns</span>
                      <span>→</span>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${csvPreview.step === 'confirm' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>2</span>
                      <span className={csvPreview.step === 'confirm' ? 'font-medium text-foreground' : ''}>Preview &amp; confirm</span>
                    </div>

                    {csvPreview.step === 'mapping' && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          <strong>{csvPreview.rows.length}+</strong> entries detected in <strong>{csvPreview.file.name}</strong>.
                          Map each SecureVoult field to the correct column from your CSV.
                        </p>
                        {/* Column mapping selects */}
                        <div className="space-y-2.5">
                          {([
                            { key: 'website',  label: 'Entry name',     required: true,  hint: 'e.g. Google, GitHub, Netflix' },
                            { key: 'url',      label: 'URL / Website',  required: false, hint: 'e.g. https://accounts.google.com' },
                            { key: 'username', label: 'Username / Email', required: false, hint: 'Login credential' },
                            { key: 'password', label: 'Password',       required: false, hint: 'Encrypted in vault' },
                            { key: 'notes',    label: 'Notes',          required: false, hint: 'Optional extra info' },
                          ] as const).map(({ key, label, required, hint }) => {
                            const currentIdx = csvPreview.mapping[key];
                            return (
                              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                                <div>
                                  <p className="text-xs font-medium">{label}{required && <span className="text-destructive ml-0.5">*</span>}</p>
                                  <p className="text-[10px] text-muted-foreground/60">{hint}</p>
                                </div>
                                <Select
                                  value={currentIdx === null ? '__none__' : String(currentIdx)}
                                  onValueChange={v => setCsvPreview(prev => prev ? {
                                    ...prev,
                                    mapping: { ...prev.mapping, [key]: v === '__none__' ? null : parseInt(v, 10) }
                                  } : null)}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border/60">
                                    <SelectValue placeholder="Not mapped" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Not mapped —</SelectItem>
                                    {csvPreview.headers.map((h, i) => (
                                      <SelectItem key={i} value={String(i)}>
                                        {h} {csvPreview.rows[0]?.[i] ? `(e.g. "${csvPreview.rows[0][i].slice(0, 20)}")` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCsvPreview(null)}>Cancel</Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-primary hover:bg-primary/90"
                            disabled={csvPreview.mapping.website === null}
                            onClick={() => setCsvPreview(prev => prev ? { ...prev, step: 'confirm' } : null)}
                          >
                            Preview data →
                          </Button>
                        </div>
                        {csvPreview.mapping.website === null && (
                          <p className="text-xs text-amber-400/80">Entry name is required to import.</p>
                        )}
                      </>
                    )}

                    {csvPreview.step === 'confirm' && (
                      <>
                        <div className="bg-secondary/50 rounded-lg overflow-auto">
                          <table className="text-xs w-full">
                            <thead>
                              <tr className="border-b border-border/50">
                                {(['website', 'username', 'password', 'url', 'notes'] as const).filter(k => csvPreview.mapping[k] !== null).map(k => (
                                  <th key={k} className="text-left py-2 px-3 text-muted-foreground font-medium capitalize">{k}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.rows.map((row, i) => (
                                <tr key={i} className="border-b border-border/20 last:border-0">
                                  {(['website', 'username', 'password', 'url', 'notes'] as const).filter(k => csvPreview.mapping[k] !== null).map(k => {
                                    const idx = csvPreview.mapping[k]!;
                                    const val = row[idx] ?? '';
                                    return (
                                      <td key={k} className="py-1.5 px-3 text-foreground/80 max-w-28 truncate">
                                        {k === 'password' ? (val ? '••••••••' : '') : val}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Showing first {csvPreview.rows.length} rows. All data will be encrypted in your vault.
                        </p>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCsvPreview(prev => prev ? { ...prev, step: 'mapping' } : null)}>← Back</Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCsvPreview(null)}>Cancel</Button>
                          <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90" onClick={handleConfirmCsvImport} disabled={importLoading}>
                            {importLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Importing…</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Import {csvPreview.rows.length}+ entries</>}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!csvPreview && (
                  <Button variant="outline" className="w-full h-9" onClick={() => csvInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />Select CSV file
                  </Button>
                )}
                <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleCsvSelect} className="hidden" />

                <p className="text-xs text-muted-foreground">
                  Recognised automatically: NordPass, Bitwarden, 1Password, LastPass, Dashlane, Proton Pass, Chrome, Edge, Firefox. Any other CSV: you choose the columns.
                </p>
              </div>
            </div>
          </Section>
        </TabsContent>

        {/* Extension */}
        <TabsContent value="extension" className="mt-5 space-y-6">
          <Section title="Browser extension">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center flex-shrink-0">
                  <Puzzle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">SecureVoult Browser Extension</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Auto-fill passwords, save new logins, and access your vault directly from your browser toolbar.
                  </p>
                </div>
              </div>
              <div className="border-t border-border/50 px-4 py-3 bg-secondary/20 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Installation</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Download the extension package from the <strong>INSTALL.md</strong> in <code className="bg-secondary px-1 rounded">extension-package/</code></li>
                  <li>Open <strong>chrome://extensions</strong> and enable Developer Mode</li>
                  <li>Click <em>Load unpacked</em> and select the extension folder</li>
                  <li>Pin the SecureVoult icon to your toolbar</li>
                </ol>
              </div>
            </div>
          </Section>
          <Section title="Extension behavior">
            <div className="bg-card border border-border rounded-xl divide-y divide-border/50">
              {[
                { label: 'Domain matching', value: 'Automatic', hint: 'Suggests credentials matching the current site' },
                { label: 'Autofill', value: 'Click to fill', hint: 'Click a suggestion to fill the active form' },
                { label: 'Save login', value: 'Prompt on sign-in', hint: 'Asks to save new credentials after login' },
                { label: 'Auto-lock', value: 'Same as web app', hint: `Currently: ${prefs.autoLockMinutes === 0 ? 'disabled' : prefs.autoLockMinutes + ' min'}` },
              ].map(({ label, value, hint }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <span className="text-xs bg-secondary/70 px-2.5 py-1 rounded-lg text-muted-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          </Section>
          <div className="bg-primary/8 border border-primary/15 rounded-xl p-4">
            <p className="text-xs text-primary/80 leading-relaxed">
              The extension communicates with your local vault using the same zero-knowledge encryption.
              Credentials are never sent to the extension in plain text.
            </p>
          </div>
        </TabsContent>

        {/* Devices */}
        <TabsContent value="devices" className="mt-5 space-y-6" onFocus={() => { if (sessions.length === 0) fetchSessions(); }}>
          <Section title="Current session">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">This browser</p>
                    <span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-semibold">Active now</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').filter(s => s.includes('/')).slice(-2).join(' ') : 'Web browser'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { lockVault(); onClose?.(); }}>
                  <Lock className="w-3 h-3 mr-1" />Lock
                </Button>
              </div>
              <div className="border-t border-border/50 px-4 py-3 bg-secondary/20 grid grid-cols-3 gap-4">
                {[
                  { label: 'Logged in', value: (user as any)?.metadata?.lastSignInTime ? new Date((user as any).metadata.lastSignInTime).toLocaleDateString() : 'This session' },
                  { label: 'Auth method', value: (user as any)?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email + password' },
                  { label: 'Vault status', value: 'Encrypted at rest' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{label}</p>
                    <p className="text-xs font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Other sessions">
            {sessionsError && (
              <div className="text-xs text-destructive px-1 mb-2">{sessionsError}</div>
            )}
            {sessions.filter(s => !s.isCurrent).length === 0 && !sessionsLoading ? (
              <div className="bg-secondary/30 border border-border/50 rounded-xl p-6 text-center space-y-2">
                <Activity className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground/70">No other active sessions</p>
                <p className="text-xs text-muted-foreground/50 max-w-xs mx-auto">You're only signed in on this device.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.filter(s => !s.isCurrent).map(s => (
                  <div key={s.sessionId} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0">
                      {s.clientType === 'extension' ? <Puzzle className="w-4 h-4 text-muted-foreground" /> : s.clientType === 'mobile' ? <Smartphone className="w-4 h-4 text-muted-foreground" /> : <Monitor className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{s.deviceLabel}</p>
                      <p className="text-xs text-muted-foreground">Last active {new Date(s.lastSeenAt).toLocaleDateString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => { await revokeSession(s.sessionId); toast({ title: 'Session revoked' }); }}>
                      <Lock className="w-3 h-3 mr-1" />Revoke
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={async () => { await revokeOtherSessions(); toast({ title: 'All other sessions revoked' }); }}>
                  Log out all other devices
                </Button>
              </div>
            )}
          </Section>

          <Section title="Connected platforms">
            <div className="space-y-2">
              {[
                { icon: Globe, label: 'Web app', desc: 'securevoult.app', status: 'Connected', color: 'text-primary', bg: 'bg-primary/15' },
                { icon: Puzzle, label: 'Browser extension', desc: 'Chrome / Edge / Firefox', status: 'Install to connect', color: 'text-muted-foreground', bg: 'bg-secondary/60' },
                { icon: Smartphone, label: 'Mobile app', desc: 'iOS / Android', status: 'Coming soon', color: 'text-muted-foreground', bg: 'bg-secondary/60' },
              ].map(({ icon: Icon, label, desc, status, color, bg }) => (
                <div key={label} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${status === 'Connected' ? 'bg-green-500/15 text-green-400' : 'bg-secondary/70 text-muted-foreground'}`}>{status}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Account security">
            <div className="bg-card border border-border rounded-xl divide-y divide-border/50">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Account email</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <span className="text-xs bg-green-500/15 text-green-400 px-2.5 py-1 rounded-lg font-medium">Verified</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">Adds a second layer of account protection</p>
                </div>
                <span className="text-xs bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-lg font-medium">Not enabled</span>
              </div>
            </div>
          </Section>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-5">
          <BillingSettings
            currentPlan={((user as unknown as { plan?: PlanId })?.plan ?? 'free') as PlanId}
            entryCount={entryCount}
            billingCycle={(user as unknown as { billingCycle?: 'monthly' | 'yearly' })?.billingCycle ?? 'monthly'}
            planExpiresAt={(user as unknown as { planExpiresAt?: string })?.planExpiresAt}
          />
        </TabsContent>

        {/* About */}
        <TabsContent value="about" className="mt-5 space-y-4">
          <Section title="SecureVoult">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">SecureVoult</p>
                  <p className="text-xs text-muted-foreground">Zero-knowledge password manager</p>
                </div>
                <span className="ml-auto text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-lg font-mono">v1.0.0</span>
              </div>
              <div className="divide-y divide-border/50">
                {[
                  { label: 'Encryption', value: 'AES-256-GCM' },
                  { label: 'Key derivation', value: 'Argon2id · 64 MiB · 3 passes' },
                  { label: 'Architecture', value: 'Zero-knowledge · client-side only' },
                  { label: 'Vault entries', value: String(entryCount) },
                  { label: 'Build', value: 'Next.js 14 · TypeScript · Tailwind CSS' },
                  { label: 'Auth', value: 'Firebase Authentication' },
                  { label: 'Storage', value: 'MongoDB Atlas (encrypted at rest)' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium text-right max-w-48">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Security commitments">
            <div className="space-y-2">
              {[
                { icon: Shield,       text: 'Master password is never transmitted or stored — not even hashed on our servers.' },
                { icon: Lock,         text: 'All encryption and decryption happens locally in your browser before any data leaves your device.' },
                { icon: RefreshCw,    text: 'Vault data synced to the server is always encrypted. The server stores ciphertext only.' },
                { icon: Eye,          text: 'No analytics, no telemetry, and no tracking of which sites you store in your vault.' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-3 bg-card border border-border/50 rounded-xl px-3.5 py-3">
                  <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Changelog">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {[
                { version: 'v1.0.0', date: 'Apr 2026', notes: 'Initial release — vault CRUD, password generator, security center, breach monitoring, extension, mobile.' },
              ].map(({ version, date, notes }) => (
                <div key={version} className="flex gap-3 px-4 py-3">
                  <div className="flex-shrink-0 text-right w-20">
                    <span className="text-xs font-mono text-primary">{version}</span>
                    <p className="text-xs text-muted-foreground/50 mt-0.5">{date}</p>
                  </div>
                  <div className="border-l border-border/50 pl-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">{notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Legal & contact">
            <div className="bg-card border border-border rounded-xl divide-y divide-border/50">
              {[
                { label: 'Privacy policy', value: 'securevoult.app/privacy' },
                { label: 'Terms of service', value: 'securevoult.app/terms' },
                { label: 'Security disclosure', value: 'security@securevoult.app' },
                { label: 'Support', value: 'support@securevoult.app' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-xs text-primary/80 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
