'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, RefreshCw, Search, Plus, Building2, ChevronDown, ChevronRight,
  Users, Shield, ShieldOff, StickyNote, CheckCircle2, XCircle, ShieldAlert,
} from 'lucide-react';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface AdminNote {
  authorUid: string;
  text: string;
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'company' | 'enterprise';
  isActive: boolean;
  ownerFirebaseUid: string;
  ownerEmail: string;
  ownerName: string;
  memberCount: number;
  breachSummary: { total: number; critical: number; high: number; medium: number; low: number };
  adminNotes: AdminNote[];
  createdAt: string;
  updatedAt: string;
}

const PLAN_COLORS: Record<string, string> = {
  free:       'bg-secondary text-muted-foreground',
  pro:        'bg-primary/15 text-primary border-primary/25',
  company:    'bg-violet-500/15 text-violet-400 border-violet-500/25',
  enterprise: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
};

export function AdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [planFilter, setPlanFilter]     = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [noteText, setNoteText]   = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName]     = useState('');
  const [newSlug, setNewSlug]     = useState('');
  const [newOwner, setNewOwner]   = useState('');
  const [newPlan, setNewPlan]     = useState('free');
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AuthService.getIdToken();
      const params = new URLSearchParams({ limit: '50' });
      if (planFilter !== 'all') params.set('plan', planFilter);
      if (activeFilter !== 'all') params.set('active', activeFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/companies?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load companies');
      const data = await res.json();
      setCompanies(data.companies ?? []);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [planFilter, activeFilter, search, toast]);

  useEffect(() => { load(); }, [load]);

  const update = async (companyId: string, patch: Record<string, unknown>) => {
    try {
      setActionLoading(true);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, ...patch }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Update failed');
      }
      toast({ title: 'Updated', description: 'Company updated.' });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setNoteText('');
    }
  };

  const create = async () => {
    if (!newName.trim() || !newSlug.trim() || !newOwner.trim()) {
      toast({ title: 'Missing fields', description: 'Name, slug, and owner UID are required.', variant: 'destructive' });
      return;
    }
    try {
      setActionLoading(true);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName, slug: newSlug, ownerFirebaseUid: newOwner, plan: newPlan }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Create failed');
      toast({ title: 'Company created', description: `${newName} has been created.` });
      setCreateOpen(false);
      setNewName(''); setNewSlug(''); setNewOwner(''); setNewPlan('free');
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const stats = {
    total:      companies.length,
    active:     companies.filter(c => c.isActive).length,
    enterprise: companies.filter(c => c.plan === 'enterprise').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Companies</h2>
          <p className="text-sm text-muted-foreground">Manage tenant organisations and their settings.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
          </Button>
          <Button size="sm" className="h-8 bg-primary hover:bg-primary/90" onClick={() => setCreateOpen(!createOpen)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />New company
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total companies', value: stats.total,      icon: Building2 },
          { label: 'Active',          value: stats.active,     icon: CheckCircle2 },
          { label: 'Enterprise',      value: stats.enterprise, icon: Shield },
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

      {/* Create form */}
      {createOpen && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold">Create new company</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Company name" value={newName} onChange={e => {
              setNewName(e.target.value);
              setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            }} className="h-9 bg-secondary/50" />
            <Input placeholder="Slug (e.g. acme-corp)" value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="h-9 bg-secondary/50" />
            <Input placeholder="Owner Firebase UID" value={newOwner} onChange={e => setNewOwner(e.target.value.trim())} className="h-9 bg-secondary/50 col-span-2" />
          </div>
          <div className="flex items-center gap-3">
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger className="h-9 w-32 bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9 bg-primary hover:bg-primary/90" onClick={create} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
            </Button>
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 bg-secondary/50 border-border/60 text-sm" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-28 h-9 bg-secondary/50 text-sm"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-28 h-9 bg-secondary/50 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
          No companies found. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map(company => {
            const isExpanded = expanded === company.id;
            return (
              <div key={company.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Row */}
                <button
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                  onClick={() => setExpanded(isExpanded ? null : company.id)}
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    {company.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{company.name}</p>
                      <code className="text-[10px] bg-secondary px-1 py-0.5 rounded text-muted-foreground">{company.slug}</code>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">Owner: {company.ownerEmail || company.ownerFirebaseUid}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={PLAN_COLORS[company.plan]}>{company.plan}</Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />{company.memberCount}
                    </div>
                    {!company.isActive && (
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Suspended</Badge>
                    )}
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    }
                  </div>
                </button>

                {/* Detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    {/* Breach summary */}
                    {company.breachSummary.total > 0 && (
                      <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-lg space-y-2">
                        <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {company.breachSummary.total} active breach finding{company.breachSummary.total !== 1 ? 's' : ''}
                        </p>
                        <div className="flex gap-3 text-[10px]">
                          {company.breachSummary.critical > 0 && <span className="text-red-400">{company.breachSummary.critical} critical</span>}
                          {company.breachSummary.high > 0 && <span className="text-orange-400">{company.breachSummary.high} high</span>}
                          {company.breachSummary.medium > 0 && <span className="text-yellow-400">{company.breachSummary.medium} medium</span>}
                          {company.breachSummary.low > 0 && <span className="text-primary">{company.breachSummary.low} low</span>}
                        </div>
                      </div>
                    )}
                    {company.breachSummary.total === 0 && (
                      <div className="flex items-center gap-2 p-3 bg-green-500/8 border border-green-500/20 rounded-lg text-xs text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />No active breach findings.
                      </div>
                    )}

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                        <p>{formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Owner UID</p>
                        <p className="font-mono text-xs truncate">{company.ownerFirebaseUid}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Members</p>
                        <p>{company.memberCount} user{company.memberCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                        <p className={company.isActive ? 'text-green-400' : 'text-red-400'}>
                          {company.isActive ? 'Active' : 'Suspended'}
                        </p>
                      </div>
                    </div>

                    {/* Plan selector */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Plan:</span>
                      <Select
                        value={company.plan}
                        onValueChange={plan => update(company.id, { plan })}
                        disabled={actionLoading}
                      >
                        <SelectTrigger className="h-8 w-32 bg-secondary/50 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 text-xs ${company.isActive ? 'text-red-400 border-red-500/30 hover:bg-red-500/10' : 'text-green-400 border-green-500/30 hover:bg-green-500/10'}`}
                        onClick={() => update(company.id, { isActive: !company.isActive })}
                        disabled={actionLoading}
                      >
                        {company.isActive
                          ? <><ShieldOff className="w-3 h-3 mr-1" />Suspend</>
                          : <><Shield className="w-3 h-3 mr-1" />Activate</>
                        }
                      </Button>
                    </div>

                    {/* Admin notes */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <StickyNote className="w-3 h-3" />Internal notes (admin-only)
                      </p>
                      {company.adminNotes.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                          {company.adminNotes.map((n, i) => (
                            <div key={i} className="text-xs bg-secondary/50 rounded-lg px-3 py-2">
                              <p className="text-foreground/90">{n.text}</p>
                              <p className="text-muted-foreground/60 mt-0.5">
                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 mb-3">No notes yet.</p>
                      )}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add internal note..."
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          className="h-8 text-xs bg-secondary/50 flex-1"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && noteText.trim()) {
                              update(company.id, { note: noteText });
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-primary/90 hover:bg-primary"
                          disabled={!noteText.trim() || actionLoading}
                          onClick={() => update(company.id, { note: noteText })}
                        >
                          {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add note'}
                        </Button>
                      </div>
                    </div>

                    {/* Suspension notice */}
                    {!company.isActive && (
                      <div className="flex items-center gap-2 p-2.5 bg-red-500/8 border border-red-500/15 rounded-lg text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        This company is suspended. Users in this organisation cannot access the vault.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
