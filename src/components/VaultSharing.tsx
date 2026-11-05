'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/lib/auth';
import { Share2, Users, Plus, Mail, Shield, Loader2, Lock, ShieldCheck, Key, AlertCircle } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description: string;
  owner: { id: string; email: string; displayName: string };
  members: Array<{ id: string; email: string; displayName: string; role: string; permissions: string[]; joinedAt: string }>;
  isOwner: boolean;
  createdAt: string;
}

function ShareVaultDialog({ onShare, isLoading }: { onShare: (name: string, desc: string, emails: string[], perms: string[]) => void; isLoading: boolean }) {
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [userEmails, setUserEmails] = useState('');
  const [permissions, setPermissions] = useState(['read']);
  const [open, setOpen] = useState(false);

  const togglePerm = (perm: string, checked: boolean) =>
    setPermissions(checked ? [...permissions, perm] : permissions.filter(p => p !== perm));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !userEmails.trim()) return;
    const emails = userEmails.split(',').map(e => e.trim()).filter(Boolean);
    onShare(teamName, description, emails, permissions);
    setTeamName(''); setDescription(''); setUserEmails(''); setPermissions(['read']); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 h-9">
          <Plus className="w-4 h-4 mr-1.5" />Share vault
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-border bg-card p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle>Share your vault</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Team name</Label>
            <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Marketing Team" className="h-10 bg-secondary/50 border-border/60 focus:border-primary" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." rows={2} className="bg-secondary/50 border-border/60 focus:border-primary resize-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">User emails</Label>
            <Textarea value={userEmails} onChange={e => setUserEmails(e.target.value)} placeholder="user1@example.com, user2@example.com" rows={2} className="bg-secondary/50 border-border/60 focus:border-primary resize-none text-sm" required />
            <p className="text-xs text-muted-foreground">Separate multiple emails with commas.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Permissions</Label>
            <div className="flex gap-4">
              {['read', 'write'].map(perm => (
                <div key={perm} className="flex items-center gap-2">
                  <Checkbox id={perm} checked={permissions.includes(perm)} onCheckedChange={v => togglePerm(perm, !!v)} />
                  <Label htmlFor={perm} className="text-sm capitalize">{perm === 'read' ? 'View passwords' : 'Add / edit'}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share vault'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VaultSharing() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => { loadSharedVaults(); }, []);

  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = await AuthService.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`/api/vault${endpoint}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const loadSharedVaults = async () => {
    try {
      setLoading(true);
      const res = await makeRequest('/share');
      setTeams(res.teams || []);
    } catch (err) {
      toast({ title: 'Failed to load shared vaults', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleShareVault = async (teamName: string, description: string, userEmails: string[], permissions: string[]) => {
    try {
      setShareLoading(true);
      await makeRequest('/share', { method: 'POST', body: JSON.stringify({ teamName, description, userEmails, permissions }) });
      toast({ title: 'Vault shared', description: `Shared with ${userEmails.length} user(s).` });
      await loadSharedVaults();
    } catch (err) {
      toast({ title: 'Share failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setShareLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sharedByMe = teams.filter(t => t.isOwner);
  const sharedWithMe = teams.filter(t => !t.isOwner);

  const TeamCard = ({ team }: { team: Team }) => (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{team.name}</p>
          {team.description && <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>}
          <p className="text-xs text-muted-foreground/60 mt-1">
            {team.isOwner ? `Created ${new Date(team.createdAt).toLocaleDateString()}` : `Owner: ${team.owner.displayName || team.owner.email}`}
          </p>
        </div>
        <Badge className={team.isOwner ? 'bg-primary/15 text-primary border-primary/20' : 'bg-violet-500/15 text-violet-400 border-violet-500/20'}>
          {team.isOwner ? 'Owner' : 'Member'}
        </Badge>
      </div>
      {team.members.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Members ({team.members.length})</p>
          <div className="space-y-1">
            {team.members.map(m => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span>{m.displayName || m.email}</span>
                </div>
                <div className="flex gap-1">
                  {m.permissions.map(p => (
                    <span key={p} className="bg-secondary/80 text-muted-foreground px-1.5 py-0.5 rounded text-[10px]">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />Vault sharing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Share your vault with team members securely.</p>
        </div>
        <ShareVaultDialog onShare={handleShareVault} isLoading={shareLoading} />
      </div>

      {/* Security trust callout */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-3.5">
        <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-foreground">End-to-end encrypted sharing</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Shared credentials are encrypted with each recipient's public key before leaving your device.
            SecureVoult servers never see plaintext passwords.
          </p>
        </div>
      </div>

      <Tabs defaultValue="shared">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="shared">Shared by me ({sharedByMe.length})</TabsTrigger>
          <TabsTrigger value="received">Shared with me ({sharedWithMe.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="shared" className="mt-4">
          {sharedByMe.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Key className="w-6 h-6 text-primary" />
              </div>
              <p className="font-semibold text-sm mb-1">No shared vaults yet</p>
              <p className="text-xs text-muted-foreground mb-1 max-w-xs leading-relaxed">
                Share selected entries or your full vault with teammates.
                They will only see what you choose to share.
              </p>
              <p className="text-[11px] text-muted-foreground/60 mb-5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />Encrypted before sharing
              </p>
              <ShareVaultDialog onShare={handleShareVault} isLoading={shareLoading} />
            </div>
          ) : (
            <div className="space-y-3">{sharedByMe.map(t => <TeamCard key={t.id} team={t} />)}</div>
          )}
        </TabsContent>

        <TabsContent value="received" className="mt-4">
          {sharedWithMe.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="font-semibold text-sm mb-1">No vaults shared with you</p>
              <p className="text-xs text-muted-foreground mb-1 max-w-xs leading-relaxed">
                When a teammate shares a vault or entry with you, it will appear here.
              </p>
              <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />Ask a teammate to share using your account email
              </p>
            </div>
          ) : (
            <div className="space-y-3">{sharedWithMe.map(t => <TeamCard key={t.id} team={t} />)}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
