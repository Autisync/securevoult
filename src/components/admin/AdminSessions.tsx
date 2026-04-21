'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Search, Monitor, Puzzle, Smartphone, ShieldX, Globe } from 'lucide-react';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface SessionRecord {
  id: string;
  sessionId: string;
  firebaseUid: string;
  userEmail: string;
  userName: string;
  clientType: 'web' | 'extension' | 'mobile';
  userAgent: string;
  ipAddress: string;
  lastSeenAt: string;
  createdAt: string;
}

interface SessionSummary {
  totalActive: number;
  web: number;
  extension: number;
  mobile: number;
}

const CLIENT_ICONS: Record<string, React.ElementType> = {
  web:       Monitor,
  extension: Puzzle,
  mobile:    Smartphone,
};

const CLIENT_COLORS: Record<string, string> = {
  web:       'bg-blue-500/15 text-blue-400 border-blue-500/25',
  extension: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  mobile:    'bg-green-500/15 text-green-400 border-green-500/25',
};

export function AdminSessions() {
  const [sessions, setSessions]       = useState<SessionRecord[]>([]);
  const [summary, setSummary]         = useState<SessionSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [revoking, setRevoking]       = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AuthService.getIdToken();
      const params = new URLSearchParams({ limit: '100' });
      if (clientFilter !== 'all') params.set('clientType', clientFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/sessions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [clientFilter, search, toast]);

  useEffect(() => { load(); }, [load]);

  const revoke = async (sessionId: string) => {
    try {
      setRevoking(sessionId);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Revoke failed');
      toast({ title: 'Session revoked', description: 'The session has been invalidated.' });
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      if (summary) setSummary({ ...summary, totalActive: Math.max(0, summary.totalActive - 1) });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Active sessions</h2>
          <p className="text-sm text-muted-foreground">View and revoke live user sessions across all devices.</p>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total active', value: summary.totalActive, icon: Globe },
            { label: 'Web',          value: summary.web,         icon: Monitor },
            { label: 'Extension',    value: summary.extension,   icon: Puzzle },
            { label: 'Mobile',       value: summary.mobile,      icon: Smartphone },
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
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search by email, IP, or user agent..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 bg-secondary/50 border-border/60 text-sm"
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-32 h-9 bg-secondary/50 text-sm">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="extension">Extension</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Monitor className="w-8 h-8 mx-auto mb-2 opacity-20" />
          No active sessions found.
        </div>
      ) : (
        <div className="space-y-1.5">
          {sessions.map(session => {
            const ClientIcon = CLIENT_ICONS[session.clientType] ?? Monitor;
            return (
              <div
                key={session.id}
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl"
              >
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <ClientIcon className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{session.userEmail || session.firebaseUid}</p>
                    <Badge className={`text-[10px] ${CLIENT_COLORS[session.clientType]}`}>
                      {session.clientType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate" title={session.userAgent}>
                    {session.ipAddress}
                    {session.userAgent ? ` · ${session.userAgent.slice(0, 60)}${session.userAgent.length > 60 ? '…' : ''}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <div className="hidden sm:block">
                    <p className="text-xs text-muted-foreground">Last seen</p>
                    <p className="text-xs">
                      {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => revoke(session.sessionId)}
                    disabled={revoking === session.sessionId}
                  >
                    {revoking === session.sessionId
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <><ShieldX className="w-3 h-3 mr-1" />Revoke</>
                    }
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground/50 text-center">
        Revoking a session immediately prevents that device from making authenticated requests — the user will be prompted to sign in again.
      </p>
    </div>
  );
}
