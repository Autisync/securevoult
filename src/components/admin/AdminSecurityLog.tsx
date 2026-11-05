'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { AlertOctagon, AlertTriangle, ChevronDown, Info, Loader2, Mail, RefreshCw, Search } from 'lucide-react';

interface EventRow {
  id: string; at: string; type: string; label: string; severity: 'info' | 'warning' | 'critical';
  email?: string; actorEmail?: string; ip?: string; country?: string; device?: string; userAgent?: string;
  method?: string; path?: string; summary?: string; details?: unknown; alerted?: boolean;
}
interface Data {
  events: EventRow[];
  counts: { critical24h: number; warning24h: number };
  types: { type: string; label: string }[];
  email: { configured: boolean; alertTo: string[] };
}

const SEV = {
  critical: { icon: AlertOctagon, cls: 'text-red-400 bg-red-500/10 border-red-500/25', label: 'Critical' },
  warning: { icon: AlertTriangle, cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25', label: 'Warning' },
  info: { icon: Info, cls: 'text-muted-foreground bg-secondary/60 border-border', label: 'Info' },
} as const;

async function api(path: string, init: RequestInit = {}) {
  const token = await AuthService.getIdToken();
  const res = await fetch(`/api/admin${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

/** Everything that happened, with IP, country, device and details; serious events are emailed. */
export function AdminSecurityLog() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<'' | 'critical' | 'warning' | 'info'>('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: '150' });
      if (severity) p.set('severity', severity);
      if (type) p.set('type', type);
      if (q.trim()) p.set('q', q.trim());
      setData(await api(`/security-events?${p}`));
    } catch (e) {
      toast({ title: 'Could not load the security log', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [severity, type, q, toast]);

  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, q]);

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await api('/security-events', { method: 'POST', body: JSON.stringify({ action: 'test' }) });
      toast({ title: r.success ? 'Test alert sent' : 'Email not working yet', description: r.message, variant: r.success ? undefined : 'destructive' });
      if (r.success) void load();
    } catch (e) {
      toast({ title: 'Test failed', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally { setTesting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Security log</h2>
          <p className="text-sm text-muted-foreground">Sign-ins, two-step changes, admin actions and blocked requests, with where they came from.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={sendTest} disabled={testing}>
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}Send test alert
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={load}><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
        </div>
      </div>

      {data && (
        <div className="grid sm:grid-cols-3 gap-2">
          <button type="button" onClick={() => setSeverity(severity === 'critical' ? '' : 'critical')}
            className={`text-left rounded-xl border px-4 py-3 transition-colors ${severity === 'critical' ? 'border-red-500/50 bg-red-500/10' : 'border-border bg-card hover:border-red-500/30'}`}>
            <p className="text-2xl font-semibold tabular-nums text-red-400">{data.counts.critical24h}</p>
            <p className="text-xs text-muted-foreground">Critical in the last 24 hours</p>
          </button>
          <button type="button" onClick={() => setSeverity(severity === 'warning' ? '' : 'warning')}
            className={`text-left rounded-xl border px-4 py-3 transition-colors ${severity === 'warning' ? 'border-amber-500/50 bg-amber-500/10' : 'border-border bg-card hover:border-amber-500/30'}`}>
            <p className="text-2xl font-semibold tabular-nums text-amber-300">{data.counts.warning24h}</p>
            <p className="text-xs text-muted-foreground">Warnings in the last 24 hours</p>
          </button>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className={`text-sm font-medium ${data.email.configured ? 'text-emerald-400' : 'text-amber-300'}`}>{data.email.configured ? 'Alerts by email: on' : 'Alerts by email: not set up'}</p>
            <p className="text-xs text-muted-foreground truncate">{data.email.configured ? `Critical events go to ${data.email.alertTo.join(', ')}` : 'On the server run: bash ~/securevoult/scripts/mail-setup.sh'}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, IP address, device…" className="pl-9 h-9" />
        </div>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
          <option value="">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm sm:max-w-[16rem]">
          <option value="">All events</option>
          {data?.types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : !data?.events.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nothing recorded{severity || type || q ? ' that matches' : ' yet'}.</div>
      ) : (
        <div className={`rounded-xl border border-border divide-y divide-border overflow-hidden ${loading ? 'opacity-60' : ''}`}>
          {data.events.map((e) => {
            const s = SEV[e.severity] ?? SEV.info; const Icon = s.icon; const isOpen = open === e.id;
            return (
              <div key={e.id} className="bg-card">
                <button type="button" onClick={() => setOpen(isOpen ? null : e.id)} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors">
                  <span className={`mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${s.cls}`}><Icon className="w-3.5 h-3.5" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium">{e.label}</span>
                      {e.email && <span className="text-xs text-muted-foreground">{e.email}</span>}
                      {e.alerted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">emailed</span>}
                    </span>
                    {e.summary && e.summary !== e.label && <span className="block text-xs text-muted-foreground mt-0.5">{e.summary}</span>}
                    <span className="block text-xs text-muted-foreground/70 mt-0.5 tabular-nums">
                      {formatDistanceToNow(new Date(e.at), { addSuffix: true })} · {e.ip ?? '—'}{e.country ? ` (${e.country})` : ''}{e.device ? ` · ${e.device}` : ''}{e.actorEmail ? ` · by ${e.actorEmail}` : ''}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 mt-1 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <dl className="px-4 pb-4 pl-14 grid sm:grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    <dt className="text-muted-foreground">Time</dt><dd className="tabular-nums">{new Date(e.at).toLocaleString()}</dd>
                    <dt className="text-muted-foreground">Event</dt><dd className="font-mono">{e.type} · {s.label}</dd>
                    {e.email && (<><dt className="text-muted-foreground">Account</dt><dd>{e.email}</dd></>)}
                    {e.actorEmail && (<><dt className="text-muted-foreground">Done by</dt><dd>{e.actorEmail}</dd></>)}
                    <dt className="text-muted-foreground">IP address</dt><dd className="font-mono">{e.ip ?? '—'}{e.country ? ` · ${e.country}` : ''}</dd>
                    {e.device && (<><dt className="text-muted-foreground">Device</dt><dd>{e.device}</dd></>)}
                    {e.userAgent && (<><dt className="text-muted-foreground">Browser string</dt><dd className="font-mono break-all text-muted-foreground">{e.userAgent}</dd></>)}
                    {e.path && (<><dt className="text-muted-foreground">Request</dt><dd className="font-mono">{e.method} {e.path}</dd></>)}
                    {e.details !== undefined && e.details !== null && (<><dt className="text-muted-foreground">Details</dt><dd><pre className="font-mono whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(e.details, null, 2)}</pre></dd></>)}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Kept for two years. Critical events are emailed at most once every 30 minutes per account and address, so a burst doesn&apos;t flood your inbox.</p>
    </div>
  );
}
