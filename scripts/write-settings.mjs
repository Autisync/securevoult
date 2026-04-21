import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const settings = `'use client';

import { useState, useRef } from 'react';
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
import {
  User, Shield, Palette, FileDown, FileUp, Info, AlertTriangle,
  Download, Upload, CheckCircle2, Loader2, Lock, Clock, Clipboard,
  Eye, EyeOff, RefreshCw
} from 'lucide-react';

interface SettingsProps {
  onClose?: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { vault, exportVault, exportVaultCSV, importVault, importFromCSV, lockVault } = useVault();
  const { user } = useAuth();
  const { toast } = useToast();

  // Password defaults
  const [pwLength, setPwLength] = useState(20);
  const [pwUppercase, setPwUppercase] = useState(true);
  const [pwNumbers, setPwNumbers] = useState(true);
  const [pwSymbols, setPwSymbols] = useState(true);

  // Security settings
  const [autoLock, setAutoLock] = useState('15');
  const [clipboardTimeout, setClipboardTimeout] = useState('30');

  // Appearance
  const [compactView, setCompactView] = useState(false);

  // Export states
  const [exportLoading, setExportLoading] = useState(false);
  const [showCsvWarning, setShowCsvWarning] = useState(false);
  const [csvExportConfirmed, setCsvExportConfirmed] = useState(false);

  // Import states
  const [importLoading, setImportLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{ rows: string[][]; headers: string[]; file: File } | null>(null);
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
      a.download = \`securevoult-backup-\${new Date().toISOString().split('T')[0]}.json\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Encrypted backup downloaded', description: \`\${entryCount} entries exported.\` });
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
    a.download = \`securevoult-export-\${new Date().toISOString().split('T')[0]}.csv\`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: 'CSV exported', description: 'Passwords exported in plain text. Store this file securely.' });
    setShowCsvWarning(false); setCsvExportConfirmed(false);
  };

  // ── Import JSON ─────────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const text = await file.text();
      await importVault(text);
      toast({ title: 'Vault imported', description: 'Backup restored successfully.' });
    } catch (err) {
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Invalid file.', variant: 'destructive' });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Import CSV ──────────────────────────────────────────────────────────────
  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\\n').filter(Boolean);
    if (lines.length < 2) { toast({ title: 'CSV empty', variant: 'destructive' }); return; }
    const headers = lines[0].split(',').map(h => h.replace(/^\"|\"$/g, '').trim());
    const previewRows = lines.slice(1, 6).map(l =>
      (l.match(/(?:"([^"]*(?:""[^"]*)*)")|([^,]*)/g) ?? []).map(c => c.replace(/^\"|\"$/g, '').replace(/""/g, '"'))
    );
    setCsvPreview({ rows: previewRows, headers, file });
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleConfirmCsvImport = async () => {
    if (!csvPreview) return;
    setImportLoading(true);
    try {
      const text = await csvPreview.file.text();
      const { imported, skipped } = await importFromCSV(text);
      toast({ title: 'CSV imported', description: \`\${imported} entries imported, \${skipped} skipped.\` });
      setCsvPreview(null);
    } catch (err) {
      toast({ title: 'CSV import failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
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

      <Tabs defaultValue="security">
        <TabsList className="bg-secondary/50 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="security"><Shield className="w-3.5 h-3.5 mr-1.5" />Security</TabsTrigger>
          <TabsTrigger value="vault"><Lock className="w-3.5 h-3.5 mr-1.5" />Vault</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="w-3.5 h-3.5 mr-1.5" />Appearance</TabsTrigger>
          <TabsTrigger value="importexport"><FileDown className="w-3.5 h-3.5 mr-1.5" />Import / Export</TabsTrigger>
          <TabsTrigger value="about"><Info className="w-3.5 h-3.5 mr-1.5" />About</TabsTrigger>
        </TabsList>

        {/* Security */}
        <TabsContent value="security" className="mt-5 space-y-6">
          <Section title="Auto-lock">
            <Row label="Lock after inactivity" hint="Automatically lock your vault when inactive.">
              <Select value={autoLock} onValueChange={setAutoLock}>
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
            <Row label="Clear clipboard after" hint="Automatically clear copied passwords from clipboard.">
              <Select value={clipboardTimeout} onValueChange={setClipboardTimeout}>
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
        </TabsContent>

        {/* Vault preferences */}
        <TabsContent value="vault" className="mt-5 space-y-6">
          <Section title="Password generator defaults">
            <Row label="Default length" hint={\`\${pwLength} characters\`}>
              <div className="w-40">
                <Slider
                  min={8} max={64} step={1}
                  value={[pwLength]}
                  onValueChange={([v]) => setPwLength(v)}
                  className="cursor-pointer"
                />
              </div>
            </Row>
            <Row label="Include uppercase letters">
              <Switch checked={pwUppercase} onCheckedChange={setPwUppercase} />
            </Row>
            <Row label="Include numbers">
              <Switch checked={pwNumbers} onCheckedChange={setPwNumbers} />
            </Row>
            <Row label="Include symbols">
              <Switch checked={pwSymbols} onCheckedChange={setPwSymbols} />
            </Row>
          </Section>
          <div className="bg-primary/8 border border-primary/15 rounded-xl p-4">
            <p className="text-xs text-primary/70">
              These defaults are applied when you open the password generator. You can always override them per session.
            </p>
          </div>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="mt-5 space-y-6">
          <Section title="Display">
            <Row label="Compact view" hint="Show more entries with less vertical spacing.">
              <Switch checked={compactView} onCheckedChange={setCompactView} />
            </Row>
          </Section>
          <div className="bg-secondary/40 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              SecureVoult uses a dark theme by default. Light mode and system theme preferences are coming in a future update.
            </p>
          </div>
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
                <Button variant="outline" className="w-full h-9" onClick={() => fileInputRef.current?.click()} disabled={importLoading}>
                  {importLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Import .json backup
                </Button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
              </div>

              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <FileUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Import from CSV</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Import from 1Password, Bitwarden, Chrome, or any password manager CSV export.
                    </p>
                  </div>
                </div>

                {csvPreview && (
                  <div className="space-y-3">
                    <div className="bg-secondary/50 rounded-lg p-3 overflow-auto">
                      <p className="text-xs text-muted-foreground mb-2">Preview (first 5 rows):</p>
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="border-b border-border/50">
                            {csvPreview.headers.slice(0, 5).map((h, i) => (
                              <th key={i} className="text-left pb-1 pr-3 text-muted-foreground font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.rows.map((row, i) => (
                            <tr key={i} className="border-b border-border/20">
                              {row.slice(0, 5).map((cell, j) => (
                                <td key={j} className="py-1 pr-3 text-foreground/80 max-w-24 truncate">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => setCsvPreview(null)}>Cancel</Button>
                      <Button size="sm" className="h-8 bg-primary hover:bg-primary/90" onClick={handleConfirmCsvImport} disabled={importLoading}>
                        {importLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                        Import {csvPreview.rows.length}+ entries
                      </Button>
                    </div>
                  </div>
                )}

                {!csvPreview && (
                  <Button variant="outline" className="w-full h-9" onClick={() => csvInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />Select CSV file
                  </Button>
                )}
                <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleCsvSelect} className="hidden" />

                <p className="text-xs text-muted-foreground">
                  Compatible with: 1Password, Bitwarden, LastPass, Dashlane, Chrome, Firefox, Safari, and any standard CSV.
                </p>
              </div>
            </div>
          </Section>
        </TabsContent>

        {/* About */}
        <TabsContent value="about" className="mt-5 space-y-4">
          <Section title="SecureVoult">
            <div className="bg-card border border-border rounded-xl divide-y divide-border/50">
              {[
                { label: 'Version', value: '1.0.0' },
                { label: 'Encryption', value: 'AES-256-GCM' },
                { label: 'Key derivation', value: 'PBKDF2 (SHA-256, 100k rounds)' },
                { label: 'Architecture', value: 'Zero-knowledge, client-side only' },
                { label: 'Vault entries', value: String(entryCount) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>
          </Section>
          <div className="bg-primary/8 border border-primary/15 rounded-xl p-4">
            <p className="text-xs text-primary/80 leading-relaxed">
              SecureVoult never sends your master password or unencrypted vault data to any server.
              All encryption and decryption happens locally in your browser.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
`;

writeFileSync(join(root, 'src/components/Settings.tsx'), settings, 'utf8');
console.log('Settings written:', settings.split('\n').length, 'lines');
