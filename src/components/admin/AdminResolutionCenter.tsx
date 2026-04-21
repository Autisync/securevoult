'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Search, Plus, ChevronDown, ChevronRight, Clock, CheckCircle2, KeyRound } from 'lucide-react';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Incident {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'waiting' | 'resolved' | 'dismissed';
  affectedUserEmail?: string;
  affectedUserUid?: string;
  assignedToUid?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  timeline: { actorEmail: string; action: string; note: string; at: string }[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/25',
  high:     'bg-orange-500/15 text-orange-400 border-orange-500/25',
  medium:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  low:      'bg-blue-500/15 text-blue-400 border-blue-500/25',
};

const STATUS_COLORS: Record<string, string> = {
  open:          'bg-red-500/10 text-red-400',
  investigating: 'bg-orange-500/10 text-orange-400',
  waiting:       'bg-yellow-500/10 text-yellow-400',
  resolved:      'bg-green-500/10 text-green-400',
  dismissed:     'bg-secondary text-muted-foreground',
};

const CATEGORY_LABELS: Record<string, string> = {
  breach:             'Breach',
  suspicious_login:   'Suspicious login',
  sync_failure:       'Sync failure',
  admin_role_change:  'Role change',
  session_anomaly:    'Session anomaly',
  health_degraded:    'Health degraded',
  misconfiguration:   'Misconfiguration',
  support_flag:       'Support flag',
  other:              'Other',
};

export function AdminResolutionCenter() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [forceResetLoading, setForceResetLoading] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [newDescription, setNewDescription] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AuthService.getIdToken();
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/incidents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load incidents');
      const data = await res.json();
      setIncidents(data.incidents ?? []);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, categoryFilter, search, toast]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (incidentId: string, status: string, note?: string) => {
    try {
      setActionLoading(true);
      const token = await AuthService.getIdToken();
      await fetch('/api/admin/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ incidentId, status, note }),
      });
      toast({ title: 'Incident updated' });
      setNoteText('');
      await load();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const forcePasswordReset = async (incident: Incident) => {
    const uid = incident.affectedUserUid;
    if (!uid) {
      toast({ title: 'No user UID on this incident', variant: 'destructive' });
      return;
    }
    try {
      setForceResetLoading(incident.id);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/users/force-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firebaseUid: uid, reason: `Forced via incident: ${incident.title}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Reset failed');
      toast({ title: 'Password reset forced', description: data.message });
      // Auto-add a timeline note
      await updateStatus(incident.id, incident.status, `Force password reset triggered for ${incident.affectedUserEmail ?? uid}.`);
    } catch (err) {
      toast({ title: 'Reset failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setForceResetLoading(null);
    }
  };

  const addNote = async (incidentId: string) => {
    if (!noteText.trim()) return;
    try {
      setActionLoading(true);
      const token = await AuthService.getIdToken();
      await fetch('/api/admin/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ incidentId, note: noteText.trim() }),
      });
      toast({ title: 'Note added' });
      setNoteText('');
      await load();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const createIncident = async () => {
    if (!newTitle.trim()) return;
    try {
      setActionLoading(true);
      const token = await AuthService.getIdToken();
      await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          severity: newSeverity,
          description: newDescription.trim(),
          affectedUserEmail: newEmail.trim() || undefined,
        }),
      });
      toast({ title: 'Incident created' });
      setCreateOpen(false);
      setNewTitle(''); setNewDescription(''); setNewEmail('');
      await load();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Resolution Center</h2>
          <p className="text-sm text-muted-foreground">Operations inbox — track, investigate, and resolve platform issues.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreateOpen(v => !v)}>
            <Plus className="w-3.5 h-3.5" />New incident
          </Button>
        </div>
      </div>

      {/* Create panel */}
      {createOpen && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">Create incident</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input placeholder="Title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-9 bg-secondary/50" />
            <Input placeholder="Affected user email (optional)" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-9 bg-secondary/50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="h-9 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newSeverity} onValueChange={setNewSeverity}>
              <SelectTrigger className="h-9 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Description (optional)" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="h-9 bg-secondary/50" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-8" onClick={createIncident} disabled={actionLoading || !newTitle.trim()}>
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Search incidents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-secondary/50 border-border/60"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 bg-secondary/50 border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-9 w-36 bg-secondary/50 border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-40 bg-secondary/50 border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Incidents list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-green-400/50 mx-auto" />
          <p className="text-sm text-muted-foreground">No incidents found.</p>
          <p className="text-xs text-muted-foreground/60">Adjust filters or create a new incident manually.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map(inc => (
            <div key={inc.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
                onClick={() => setExpanded(expanded === inc.id ? null : inc.id)}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{inc.title}</p>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${SEVERITY_COLORS[inc.severity] ?? ''}`}>
                      {inc.severity}
                    </Badge>
                    <Badge className={`text-[10px] h-4 ${STATUS_COLORS[inc.status] ?? ''}`}>
                      {inc.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground/60 flex-wrap">
                    <span>{CATEGORY_LABELS[inc.category] ?? inc.category}</span>
                    {inc.affectedUserEmail && <span>{inc.affectedUserEmail}</span>}
                    <span>{formatDistanceToNow(new Date(inc.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
                {expanded === inc.id
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                }
              </button>

              {/* Expanded */}
              {expanded === inc.id && (
                <div className="border-t border-border px-4 py-3 bg-secondary/10 space-y-4">
                  {inc.description && (
                    <p className="text-sm text-muted-foreground">{inc.description}</p>
                  )}

                  {/* Timeline */}
                  {inc.timeline.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline</p>
                      {inc.timeline.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground/40" />
                          <span className="font-medium">{t.actorEmail || 'Admin'}</span>
                          <span className="opacity-70">{t.action.replace(/_/g, ' ')}</span>
                          {t.note && <span className="italic opacity-60">— {t.note}</span>}
                          <span className="ml-auto opacity-40 flex-shrink-0">{formatDistanceToNow(new Date(t.at), { addSuffix: true })}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Note input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add internal note..."
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      className="h-8 text-xs bg-card border-border/60"
                    />
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={() => addNote(inc.id)} disabled={actionLoading || !noteText.trim()}>
                      Add
                    </Button>
                  </div>

                  {/* Status actions */}
                  <div className="flex flex-wrap gap-2">
                    {inc.status === 'open' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-orange-400 border-orange-500/30" onClick={() => updateStatus(inc.id, 'investigating')} disabled={actionLoading}>
                        Start investigating
                      </Button>
                    )}
                    {['open', 'investigating', 'waiting'].includes(inc.status) && (
                      <>
                        {inc.status !== 'waiting' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-yellow-400 border-yellow-500/30" onClick={() => updateStatus(inc.id, 'waiting')} disabled={actionLoading}>
                            Mark waiting
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-400 border-green-500/30" onClick={() => updateStatus(inc.id, 'resolved')} disabled={actionLoading}>
                          Mark resolved
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground" onClick={() => updateStatus(inc.id, 'dismissed')} disabled={actionLoading}>
                          Dismiss
                        </Button>
                      </>
                    )}
                    {['resolved', 'dismissed'].includes(inc.status) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-orange-400 border-orange-500/30" onClick={() => updateStatus(inc.id, 'open')} disabled={actionLoading}>
                        Reopen
                      </Button>
                    )}
                    {/* Force password reset — only if incident has an affected user */}
                    {inc.affectedUserUid && !['resolved', 'dismissed'].includes(inc.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-400 border-red-500/30 gap-1"
                        onClick={() => forcePasswordReset(inc)}
                        disabled={forceResetLoading === inc.id}
                      >
                        {forceResetLoading === inc.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <KeyRound className="w-3 h-3" />
                        }
                        Force password reset
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
