'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Loader2, Mail, Trash2, Crown, Copy, Check, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyInfo { company: { id: string; name: string; plan: string; status: string; maxSeats: number } | null; canManage: boolean }
interface Member { firebaseUid: string; email: string; displayName?: string; role: string; isActive: boolean; isOwner: boolean; joinedAt: string }
interface Invite { _id: string; email: string; role: string; createdAt: string; expiresAt: string }

const ROLE_LABEL: Record<string, string> = { user: 'Member', companyAdmin: 'Admin', company_admin: 'Admin', admin: 'Admin' };

/** Settings → Team: who is in the company, invite people by email, change roles, remove people. */
export function TeamSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [seats, setSeats] = useState<{ used: number; max: number } | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'companyAdmin'>('user');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const load = useCallback(async () => {
    try {
      const i = await api<CompanyInfo>('/api/account/company');
      setInfo(i);
      if (i.company && i.canManage) {
        const [m, inv] = await Promise.all([
          api<{ members: Member[]; currentSeats: number; maxSeats: number }>(`/api/companies/${i.company.id}/members`),
          api<{ invites: Invite[] }>(`/api/companies/${i.company.id}/invites`),
        ]);
        setMembers(m.members); setSeats({ used: m.currentSeats, max: m.maxSeats }); setInvites(inv.invites);
      }
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the team'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cid = info?.company?.id;
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast({ title: e instanceof Error ? e.message : 'That didn\'t work', variant: 'destructive' }); }
    setBusy(null);
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cid || !email.trim()) return;
    void run('invite', async () => {
      const r = await api<{ emailSent: boolean; inviteUrl: string; message: string }>(`/api/companies/${cid}/invites`, { email: email.trim().toLowerCase(), role });
      toast({ title: r.emailSent ? `Invite emailed to ${email.trim()}` : 'Invite created', description: r.emailSent ? 'It works for 7 days.' : 'Email isn\'t set up: copy the link below and send it yourself.' });
      setLastLink(r.emailSent ? null : r.inviteUrl);
      setEmail('');
      await load();
    });
  };

  const cancelInvite = (id: string) => run(`inv:${id}`, async () => {
    const token = await (await import('@/lib/auth')).AuthService.getIdToken();
    const res = await fetch(`/api/companies/${cid}/invites/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Could not cancel the invite');
    setInvites((l) => l.filter((x) => x._id !== id));
  });

  const changeRole = (m: Member, next: string) => run(`role:${m.firebaseUid}`, async () => {
    const token = await (await import('@/lib/auth')).AuthService.getIdToken();
    const res = await fetch(`/api/companies/${cid}/members/${m.firebaseUid}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: next }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.message || 'Could not change the role');
    setMembers((l) => l.map((x) => (x.firebaseUid === m.firebaseUid ? { ...x, role: next } : x)));
    toast({ title: `${m.displayName || m.email} is now ${ROLE_LABEL[next] ?? next}` });
  });

  const remove = (m: Member) => run(`rm:${m.firebaseUid}`, async () => {
    const token = await (await import('@/lib/auth')).AuthService.getIdToken();
    const res = await fetch(`/api/companies/${cid}/members/${m.firebaseUid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.message || 'Could not remove them');
    setMembers((l) => l.filter((x) => x.firebaseUid !== m.firebaseUid));
    setRemoving(null);
    toast({ title: `${m.displayName || m.email} removed from the team`, description: 'Their own vault stays theirs. End their sessions in the admin console if needed.' });
  });

  if (error) return <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!info) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>;

  if (!info.company) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <Users className="w-7 h-7 text-primary" />
        <p className="mt-3 font-semibold">Use SecureVoult with your team</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">On the Company plan you get an admin console, a security log with email alerts, and invites by email for everyone at work.</p>
        <a href="/partners#quote" className="mt-4 inline-flex h-10 items-center px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Talk to us about Company</a>
      </div>
    );
  }

  if (!info.canManage) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="font-semibold">You&apos;re part of {info.company.name}</p>
        <p className="text-sm text-muted-foreground mt-1">Your company&apos;s admin manages the team. Your vault is still yours alone: nobody at the company can open it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{info.company.name}</p>
          {seats && <p className="text-sm text-muted-foreground">{seats.used} of {seats.max} seats used</p>}
        </div>
      </div>

      <form onSubmit={invite} className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" />Invite someone</p>
        <div className="flex flex-wrap gap-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-11 flex-1 min-w-[220px]" aria-label="Email to invite" />
          <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'companyAdmin')}>
            <SelectTrigger className="h-11 w-36" aria-label="Role"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="user">Member</SelectItem><SelectItem value="companyAdmin">Admin</SelectItem></SelectContent>
          </Select>
          <Button type="submit" className="h-11 px-5" disabled={!email.trim() || !!busy}>{busy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-1.5" />Send invite</>}</Button>
        </div>
        <p className="text-xs text-muted-foreground">They get an email with a link that works for 7 days. Admins can invite and remove people; members just use their own vault.</p>
        {lastLink && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
            <span className="text-xs truncate flex-1 font-mono">{lastLink}</span>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={async () => { await navigator.clipboard.writeText(lastLink).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </form>

      {invites.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-2">Waiting to join</p>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
            {invites.map((i) => (
              <div key={i._id} className="flex items-center gap-3 px-4 py-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0"><p className="text-sm truncate">{i.email}</p><p className="text-xs text-muted-foreground">{ROLE_LABEL[i.role] ?? i.role} · invite works until {new Date(i.expiresAt).toLocaleDateString()}</p></div>
                <Button size="sm" variant="ghost" className="h-9 text-muted-foreground hover:text-destructive" disabled={!!busy} onClick={() => cancelInvite(i._id)}>Cancel</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-2">Team</p>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
          {members.map((m) => {
            const me = m.firebaseUid === user?.id;
            const admin = m.role === 'companyAdmin' || m.role === 'company_admin';
            return (
              <div key={m.firebaseUid} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-9 h-9 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{(m.displayName || m.email).slice(0, 2).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">{m.displayName || m.email}{m.isOwner && <Crown className="w-3.5 h-3.5 text-amber-300" aria-label="Owner" />}{me && <span className="text-xs text-muted-foreground font-normal">(you)</span>}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}{!m.isActive && ' · suspended'}</p>
                </div>
                {m.isOwner || me ? (
                  <span className="text-xs text-muted-foreground px-2">{m.isOwner ? 'Owner' : ROLE_LABEL[m.role] ?? m.role}</span>
                ) : (
                  <>
                    <Select value={admin ? 'companyAdmin' : 'user'} onValueChange={(v) => changeRole(m, v)} disabled={!!busy}>
                      <SelectTrigger className="h-9 w-28" aria-label={`Role for ${m.email}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="user">Member</SelectItem><SelectItem value="companyAdmin">Admin</SelectItem></SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${m.email}`} disabled={!!busy} onClick={() => setRemoving(m)}><Trash2 className="w-4 h-4" /></Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.displayName || removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription>They leave {info.company.name} and go back to a free personal account. Their vault stays theirs; nothing in it is shared with you or deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => removing && remove(removing)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
