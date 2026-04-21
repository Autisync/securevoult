import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const adminPanel = `'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/lib/auth';
import { Users, Shield, Activity, Chrome, Search, Loader2, Package, Info } from 'lucide-react';

interface AdminUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  provider: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
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

const ACTION_COLORS: Record<string, string> = {
  update_role: 'bg-violet-500/15 text-violet-400',
  deactivate_user: 'bg-red-500/15 text-red-400',
  activate_user: 'bg-green-500/15 text-green-400',
};

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const makeAdminRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = await AuthService.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(\`/api/admin\${endpoint}\`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\`, ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, a] = await Promise.all([makeAdminRequest('/users'), makeAdminRequest('/activities')]);
      setUsers(u.users || []);
      setActivities(a.activities || []);
    } catch (err) {
      toast({ title: 'Failed to load admin data', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await makeAdminRequest('/users', { method: 'PUT', body: JSON.stringify({ userId, isActive }) });
      await loadData();
      toast({ title: 'User updated', description: \`User \${isActive ? 'activated' : 'deactivated'}.\` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const updateUserRole = async (firebaseUid: string, role: 'user' | 'admin') => {
    try {
      await makeAdminRequest('/users', { method: 'PUT', body: JSON.stringify({ firebaseUid, role }) });
      await loadData();
      toast({ title: 'Role updated', description: \`Role set to \${role}.\` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const downloadExtension = () => {
    toast({ title: 'Browser extension', description: 'Load extension-package/ folder in Chrome via chrome://extensions (developer mode).' });
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />Admin panel
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage users, permissions and system settings.</p>
        </div>
        <Button variant="outline" className="h-9" onClick={downloadExtension}>
          <Chrome className="w-4 h-4 mr-1.5" />Extension
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total users', value: users.length, icon: Users },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: Shield },
          { label: 'Active users', value: users.filter(u => u.isActive).length, icon: Activity },
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

      <Tabs defaultValue="users">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="users">Users ({filteredUsers.length})</TabsTrigger>
          <TabsTrigger value="activities">Activity log</TabsTrigger>
          <TabsTrigger value="extension">Extension</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-secondary/50 border-border/60"
            />
          </div>
          <div className="space-y-2">
            {filteredUsers.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl">
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.displayName} className="w-9 h-9 rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-violet-500/30 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    {(u.displayName || u.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.displayName || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={u.emailVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-secondary text-muted-foreground'}>
                    {u.emailVerified ? 'Verified' : 'Unverified'}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={u.role === 'admin'} onCheckedChange={v => updateUserRole(u.firebaseUid, v ? 'admin' : 'user')} />
                    <span className="text-xs text-muted-foreground">Admin</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={u.isActive} onCheckedChange={v => updateUserStatus(u.id, v)} />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">No users match your search.</div>
            )}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activities" className="mt-4">
          <div className="space-y-2">
            {activities.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">No activities recorded yet.</div>
            ) : (
              activities.map(act => (
                <div key={act.id} className="flex items-start gap-3 px-4 py-3 bg-card border border-border rounded-xl">
                  <Activity className="w-4 h-4 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{act.admin.displayName || act.admin.email}</span>
                      <span className={['text-[10px] px-1.5 py-0.5 rounded font-medium', ACTION_COLORS[act.action] ?? 'bg-secondary text-muted-foreground'].join(' ')}>
                        {act.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {act.target && (
                      <p className="text-xs text-muted-foreground">Target: {act.target.displayName || act.target.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground/50">{new Date(act.timestamp).toLocaleString()} · {act.ipAddress}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Extension Tab */}
        <TabsContent value="extension" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-start gap-3 p-3 bg-primary/8 border border-primary/15 rounded-lg">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-primary/80">The browser extension auto-fills passwords directly in browsers using secure client-side encryption.</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Features</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {['Auto-detect login forms on websites', 'One-click password filling', 'Secure client-side encryption', 'Context menu integration', 'Built-in password generation'].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary/50 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Button onClick={downloadExtension} className="w-full bg-primary hover:bg-primary/90">
              <Package className="w-4 h-4 mr-2" />Download extension package
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
`;

writeFileSync(join(root, 'src/components/AdminPanel.tsx'), adminPanel, 'utf8');
console.log('AdminPanel written:', adminPanel.split('\n').length, 'lines');
