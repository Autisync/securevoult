'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/lib/auth';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminBreachCenter } from '@/components/admin/AdminBreachCenter';
import { AdminResolutionCenter } from '@/components/admin/AdminResolutionCenter';
import { AdminSystemHealth } from '@/components/admin/AdminSystemHealth';
import { AdminCompanies } from '@/components/admin/AdminCompanies';
import { AdminSessions } from '@/components/admin/AdminSessions';
import {
  LayoutDashboard, Users, Shield, Activity, ShieldAlert, AlertTriangle,
  Globe, LogOut, Loader2, Search, Chrome, Package, Info, ChevronRight,
  HeartPulse, Building2, Monitor, Download, CheckCircle2, Copy, Terminal,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  provider: string;
  emailVerified: boolean;
  role: 'user' | 'companyAdmin' | 'admin';
  isActive: boolean;
  createdAt: string;
}

interface AdminActivity {
  id: string;
  admin: { id: string; email: string; displayName: string };
  action: string;
  target?: { id: string; email: string; displayName: string };
  details: unknown;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

type Section =
  | 'overview' | 'companies' | 'users' | 'sessions' | 'breach' | 'resolution'
  | 'audit' | 'health' | 'extension';

interface NavItem {
  id: Section;
  label: string;
  icon: React.ElementType;
  group: 'main' | 'ops' | 'system';
}

const ACTION_COLORS: Record<string, string> = {
  update_role:     'bg-violet-500/15 text-violet-400',
  deactivate_user: 'bg-red-500/15 text-red-400',
  activate_user:   'bg-green-500/15 text-green-400',
  vault_accessed:  'bg-primary/15 text-primary',
};

// ── Props ──────────────────────────────────────────────────────────────────

interface AdminPanelProps {
  onBackToVault: () => void;
  onViewPublicSite: () => void;
}

// ── Extension install section ──────────────────────────────────────────────

type BrowserTab = 'chrome' | 'edge' | 'brave' | 'firefox' | 'safari';

const BROWSER_TABS: { id: BrowserTab; label: string; icon: string }[] = [
  { id: 'chrome',  label: 'Chrome',  icon: '🌐' },
  { id: 'edge',    label: 'Edge',    icon: '🔷' },
  { id: 'brave',   label: 'Brave',   icon: '🦁' },
  { id: 'firefox', label: 'Firefox', icon: '🦊' },
  { id: 'safari',  label: 'Safari',  icon: '🧭' },
];

const FEATURES = [
  'Auto-detect login forms on websites',
  'One-click password autofill',
  'AES-256 client-side encryption',
  'Context menu integration',
  'Built-in password generator',
  'Keyboard shortcut: Ctrl+Shift+F',
];

function CodeLine({ children }: { children: string }) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between gap-2 bg-[#0d1117] border border-border/40 rounded-lg px-3 py-2 font-mono text-xs text-green-400">
      <span className="truncate">{children}</span>
      <button
        onClick={() => { navigator.clipboard.writeText(children); toast({ title: 'Copied!' }); }}
        className="text-muted-foreground hover:text-foreground flex-shrink-0"
        aria-label="Copy"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{n}</span>
      <p className="text-sm text-muted-foreground pt-0.5">{children}</p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">{children}</code>;
}

function ExtensionSection() {
  const [tab, setTab] = useState<BrowserTab>('chrome');
  const { toast } = useToast();

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = '/api/extension/download';
    a.download = 'securevoult-extension.zip';
    a.click();
    toast({ title: 'Downloading extension package…', description: 'Unzip and load the folder via developer mode.' });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Browser extension</h2>
        <p className="text-sm text-muted-foreground">Install the SecureVoult extension in any major browser.</p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3.5 bg-primary/8 border border-primary/15 rounded-xl">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-primary/80">The extension auto-fills passwords using secure client-side AES-256 encryption. Your vault key never leaves your device.</p>
      </div>

      {/* Features */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">Included features</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
          {FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Download */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">Step 1 — Download the extension package</p>
        <p className="text-sm text-muted-foreground">Download the latest extension package, then follow the browser-specific steps below to load it.</p>
        <div className="flex items-start gap-2 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg">
          <Info className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-500/80">After extracting the zip, select the <strong>extracted folder itself</strong> (not a subfolder inside it). Chrome requires <Code>manifest.json</Code> to be at the root of the folder you select.</p>
        </div>
        <Button className="w-full bg-primary hover:bg-primary/90 h-10" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />Download extension package (.zip)
        </Button>
      </div>

      {/* Per-browser steps */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-border overflow-x-auto">
          {BROWSER_TABS.map(b => (
            <button
              key={b.id}
              onClick={() => setTab(b.id)}
              className={[
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === b.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <span>{b.icon}</span>{b.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-3">
          {tab === 'chrome' && (
            <>
              <p className="text-sm font-medium">Step 2 — Load in Chrome</p>
              <div className="space-y-2.5">
                <Step n={1}>Open <Code>chrome://extensions</Code> in your browser address bar.</Step>
                <Step n={2}>Toggle <strong>Developer mode</strong> on (top-right corner).</Step>
                <Step n={3}>Click <strong>Load unpacked</strong> and select the <strong>extracted folder</strong> (the one containing <Code>manifest.json</Code>).</Step>
                <Step n={4}>The SecureVoult shield icon appears in your toolbar. Click it to sign in.</Step>
              </div>
              <CodeLine>chrome://extensions</CodeLine>
            </>
          )}
          {tab === 'edge' && (
            <>
              <p className="text-sm font-medium">Step 2 — Load in Microsoft Edge</p>
              <div className="space-y-2.5">
                <Step n={1}>Open <Code>edge://extensions</Code> in your browser address bar.</Step>
                <Step n={2}>Enable <strong>Developer mode</strong> in the left sidebar.</Step>
                <Step n={3}>Click <strong>Load unpacked</strong> and select the <strong>extracted folder</strong> (the one containing <Code>manifest.json</Code>).</Step>
                <Step n={4}>The SecureVoult icon appears in your toolbar.</Step>
              </div>
              <CodeLine>edge://extensions</CodeLine>
            </>
          )}
          {tab === 'brave' && (
            <>
              <p className="text-sm font-medium">Step 2 — Load in Brave</p>
              <div className="space-y-2.5">
                <Step n={1}>Open <Code>brave://extensions</Code> in your browser address bar.</Step>
                <Step n={2}>Enable <strong>Developer mode</strong> (top-right toggle).</Step>
                <Step n={3}>Click <strong>Load unpacked</strong> and select the <strong>extracted folder</strong> (the one containing <Code>manifest.json</Code>).</Step>
                <Step n={4}>Brave is Chromium-based — fully compatible with the Chrome MV3 manifest.</Step>
              </div>
              <CodeLine>brave://extensions</CodeLine>
            </>
          )}
          {tab === 'firefox' && (
            <>
              <p className="text-sm font-medium">Step 2 — Load in Firefox</p>
              <div className="space-y-2.5">
                <Step n={1}>Unzip the package. Firefox needs the <Code>manifest-firefox.json</Code> file renamed to <Code>manifest.json</Code> first.</Step>
                <Step n={2}>Run the commands below in the unzipped folder, then open <Code>about:debugging</Code>.</Step>
                <Step n={3}>Click <strong>This Firefox</strong> → <strong>Load Temporary Add-on…</strong></Step>
                <Step n={4}>Select the <Code>manifest.json</Code> file inside the folder. Note: temporary add-ons are removed on restart.</Step>
              </div>
              <CodeLine>copy manifest-firefox.json manifest.json</CodeLine>
              <CodeLine>about:debugging#/runtime/this-firefox</CodeLine>
            </>
          )}
          {tab === 'safari' && (
            <>
              <p className="text-sm font-medium">Step 2 — Convert for Safari (macOS)</p>
              <div className="space-y-2.5">
                <Step n={1}>Requires <strong>Xcode 15+</strong> on macOS. Install from the App Store if needed.</Step>
                <Step n={2}>Run the converter command below from your terminal inside the unzipped folder.</Step>
                <Step n={3}>Open the generated Xcode project and run it — this sideloads the extension into Safari.</Step>
                <Step n={4}>In Safari → Preferences → Extensions → enable <strong>SecureVoult</strong>.</Step>
              </div>
              <div className="flex items-start gap-2 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg">
                <Terminal className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-500/80">Requires a free or paid Apple Developer account to run in Safari.</p>
              </div>
              <CodeLine>xcrun safari-web-extension-converter extension-package/ --project-location ./safari-ext --app-name SecureVoult</CodeLine>
            </>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">Keyboard shortcuts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { action: 'Autofill password', keys: 'Ctrl+Shift+F', mac: '⌘⇧F' },
            { action: 'Open vault popup', keys: 'Ctrl+Shift+P', mac: '⌘⇧P' },
          ].map(s => (
            <div key={s.action} className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2">
              <span className="text-sm text-muted-foreground">{s.action}</span>
              <div className="flex gap-1">
                <Code>{s.keys}</Code>
                <Code>{s.mac}</Code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function AdminPanel({ onBackToVault, onViewPublicSite }: AdminPanelProps) {
  const [section, setSection] = useState<Section>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (section === 'users' && users.length === 0) loadUsers();
    if (section === 'audit' && activities.length === 0) loadActivities();
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const adminFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = await AuthService.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`/api/admin${endpoint}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await adminFetch('/users');
      setUsers(data.users ?? []);
    } catch (err) {
      toast({ title: 'Failed to load users', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally { setUsersLoading(false); }
  };

  const loadActivities = async () => {
    try {
      setAuditLoading(true);
      const data = await adminFetch('/activities');
      setActivities(data.activities ?? []);
    } catch (err) {
      toast({ title: 'Failed to load audit log', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally { setAuditLoading(false); }
  };

  const updateUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await adminFetch('/users', { method: 'PUT', body: JSON.stringify({ userId, isActive }) });
      await loadUsers();
      toast({ title: 'User updated', description: `User ${isActive ? 'activated' : 'deactivated'}.` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const updateUserRole = async (firebaseUid: string, role: 'user' | 'companyAdmin' | 'admin') => {
    try {
      await adminFetch('/users', { method: 'PUT', body: JSON.stringify({ firebaseUid, role }) });
      await loadUsers();
      toast({ title: 'Role updated', description: `Role set to ${role}.` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const navItems: NavItem[] = [
    { id: 'overview',   label: 'Overview',         icon: LayoutDashboard, group: 'main' },
    { id: 'companies',  label: 'Companies',         icon: Building2,       group: 'main' },
    { id: 'users',      label: 'Users',             icon: Users,           group: 'main' },
    { id: 'sessions',   label: 'Sessions',          icon: Monitor,         group: 'main' },
    { id: 'audit',      label: 'Audit log',         icon: Activity,        group: 'main' },
    { id: 'breach',     label: 'Breach Center',     icon: ShieldAlert,     group: 'ops' },
    { id: 'resolution', label: 'Resolution Center', icon: AlertTriangle,   group: 'ops' },
    { id: 'health',     label: 'System Health',     icon: HeartPulse,      group: 'system' },
    { id: 'extension',  label: 'Extension',         icon: Chrome,          group: 'system' },
  ];

  const groups: { key: NavItem['group']; label: string }[] = [
    { key: 'main',   label: 'Operations' },
    { key: 'ops',    label: 'Security' },
    { key: 'system', label: 'System' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-card/50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Admin console</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-sm text-muted-foreground capitalize">{section.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground gap-1" onClick={onViewPublicSite}>
              <Globe className="w-3.5 h-3.5" />Public site
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onBackToVault}>
              ← Vault
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => AuthService.signOut()}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" />Sign out
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full px-5 py-6 gap-6">

        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 space-y-4">
          {groups.map(({ key, label }) => {
            const items = navItems.filter(n => n.group === key);
            return (
              <div key={key}>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-semibold mb-1.5 px-2">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const Icon = item.icon;
                    const active = section === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSection(item.id)}
                        className={[
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                          active
                            ? 'bg-primary/15 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                        ].join(' ')}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {section === 'overview' && (
            <AdminOverview onNavigate={(s) => setSection(s as Section)} />
          )}

          {section === 'companies' && <AdminCompanies />}

          {section === 'sessions' && <AdminSessions />}

          {section === 'breach' && <AdminBreachCenter />}

          {section === 'resolution' && <AdminResolutionCenter />}

          {section === 'health' && <AdminSystemHealth />}

          {/* Users */}
          {section === 'users' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Users</h2>
                  <p className="text-sm text-muted-foreground">Manage accounts, roles, and access.</p>
                </div>
                <Button variant="outline" size="sm" className="h-8" onClick={loadUsers}>
                  <Activity className="w-3.5 h-3.5 mr-1.5" />Refresh
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total users',  value: users.length,                               icon: Users },
                  { label: 'Admins',       value: users.filter(u => u.role === 'admin').length, icon: Shield },
                  { label: 'Active users', value: users.filter(u => u.isActive).length,        icon: Activity },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <Icon className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 bg-secondary/50 border-border/60"
                />
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className="w-9 h-9 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-amber-600/30 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                          {(u.displayName || u.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.displayName || u.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <Badge className={u.emailVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-secondary text-muted-foreground'}>
                          {u.emailVerified ? 'Verified' : 'Unverified'}
                        </Badge>
                        <select
                          value={u.role}
                          onChange={e => updateUserRole(u.firebaseUid, e.target.value as 'user' | 'companyAdmin' | 'admin')}
                          className="h-7 text-xs rounded-md border border-border bg-secondary px-2 text-foreground"
                        >
                          <option value="user">User</option>
                          <option value="companyAdmin">Company admin</option>
                          <option value="admin">Global admin</option>
                        </select>
                        <div className="flex items-center gap-1.5">
                          <Switch checked={u.isActive} onCheckedChange={v => updateUserStatus(u.id, v)} />
                          <span className="text-xs text-muted-foreground">Active</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && !usersLoading && (
                    <div className="text-center py-10 text-sm text-muted-foreground">No users match your search.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Audit log */}
          {section === 'audit' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Audit log</h2>
                  <p className="text-sm text-muted-foreground">Admin action history.</p>
                </div>
                <Button variant="outline" size="sm" className="h-8" onClick={loadActivities}>
                  <Activity className="w-3.5 h-3.5 mr-1.5" />Refresh
                </Button>
              </div>

              {auditLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">No activities recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {activities.map(act => (
                    <div key={act.id} className="flex items-start gap-3 px-4 py-3 bg-card border border-border rounded-xl">
                      <Activity className="w-4 h-4 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{act.admin?.displayName || act.admin?.email || 'Unknown'}</span>
                          <span className={['text-[10px] px-1.5 py-0.5 rounded font-medium', ACTION_COLORS[act.action] ?? 'bg-secondary text-muted-foreground'].join(' ')}>
                            {act.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {act.target && (
                          <p className="text-xs text-muted-foreground">Target: {act.target?.displayName || act.target?.email || 'Unknown'}</p>
                        )}
                        <p className="text-xs text-muted-foreground/50">{new Date(act.timestamp).toLocaleString()} · {act.ipAddress}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Extension */}
          {section === 'extension' && <ExtensionSection />}
        </main>
      </div>
    </div>
  );
}
