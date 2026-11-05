'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Database, Shield, Zap, Package, CheckCircle2, AlertTriangle, XCircle, Archive, HardDrive, Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';

interface HealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  checks: {
    database: { status: string; pingMs: number | null; configured: boolean };
    firebaseAdmin: { status: string };
    rateLimiting: { mode: string };
    backups?: { visible: boolean; count: number; latestAt: string | null; latestBytes: number; totalBytes: number };
    disk?: { freeBytes: number; totalBytes: number } | null;
    files?: { count: number; bytes: number } | null;
  };
  build: {
    version: string;
    commit?: string;
    nodeEnv: string;
    uptimeSeconds?: number;
  };
}

const size = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
const uptime = (s?: number) => s === undefined ? '' : s > 86400 ? `up ${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s > 3600 ? `up ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `up ${Math.max(1, Math.floor(s / 60))}m`;

function StatusIcon({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok')   return <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
}

export function AdminSystemHealth() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/system-health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      toast({ title: 'Health check failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dbOk    = health?.checks.database.status === 'connected';
  const fbOk    = health?.checks.firebaseAdmin.status === 'configured';
  const overall = health?.status === 'healthy';

  const checks = health ? [
    {
      label: 'MongoDB',
      icon: Database,
      status: (dbOk ? 'ok' : 'error') as 'ok' | 'warn' | 'error',
      detail: dbOk
        ? `Connected${health.checks.database.pingMs !== null ? ` · ${health.checks.database.pingMs}ms` : ''}`
        : 'Not connected',
    },
    {
      label: 'Firebase Admin SDK',
      icon: Shield,
      status: (fbOk ? 'ok' : 'error') as 'ok' | 'warn' | 'error',
      detail: fbOk ? 'Credentials configured' : 'Missing environment variables',
    },
    (() => {
      const b = health.checks.backups;
      const ageH = b?.latestAt ? (Date.now() - new Date(b.latestAt).getTime()) / 3.6e6 : Infinity;
      return {
        label: 'Backups',
        icon: Archive,
        status: (!b?.visible ? 'warn' : ageH < 26 ? 'ok' : ageH < 50 ? 'warn' : 'error') as 'ok' | 'warn' | 'error',
        detail: !b?.visible
          ? 'Backup folder not visible to the app (redeploy to mount it)'
          : !b.latestAt
            ? 'No backups yet: the first one runs within 24 hours of the backup container starting'
            : `Nightly · last ${formatDistanceToNow(new Date(b.latestAt), { addSuffix: true })} (${size(b.latestBytes)}) · ${b.count} kept, ${size(b.totalBytes)}`,
      };
    })(),
    ...(health.checks.disk ? [(() => {
      const d = health.checks.disk!; const pct = d.totalBytes ? (d.freeBytes / d.totalBytes) * 100 : 100;
      return {
        label: 'Disk space',
        icon: HardDrive,
        status: (pct > 15 ? 'ok' : pct > 5 ? 'warn' : 'error') as 'ok' | 'warn' | 'error',
        detail: `${size(d.freeBytes)} free of ${size(d.totalBytes)} (${pct.toFixed(0)}%)`,
      };
    })()] : []),
    ...(health.checks.files ? [{
      label: 'Encrypted files',
      icon: Paperclip,
      status: 'ok' as 'ok' | 'warn' | 'error',
      detail: `${health.checks.files.count} file${health.checks.files.count === 1 ? '' : 's'} · ${size(health.checks.files.bytes)} stored`,
    }] : []),
    {
      label: 'Rate limiting',
      icon: Zap,
      status: 'ok' as 'ok' | 'warn' | 'error',
      detail: health.checks.rateLimiting.mode === 'redis'
        ? 'Shared Redis (Upstash)'
        : 'In this server\'s memory: right for a single server',
    },
    {
      label: 'Application',
      icon: Package,
      status: 'ok' as 'ok' | 'warn' | 'error',
      detail: [`v${health.build.version}`, health.build.commit && health.build.commit !== 'dev' ? `commit ${health.build.commit}` : null, health.build.nodeEnv, uptime(health.build.uptimeSeconds)].filter(Boolean).join(' · '),
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System health</h2>
          <p className="text-sm text-muted-foreground">Live infrastructure and configuration status.</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </Button>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${overall ? 'bg-green-500/8 border-green-500/20' : 'bg-red-500/8 border-red-500/20'}`}>
        {overall
          ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          : <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
        }
        <div className="flex-1">
          <p className={`text-sm font-semibold ${overall ? 'text-green-400' : 'text-red-400'}`}>
            {overall ? 'All systems operational' : 'System degraded'}
          </p>
          <p className="text-xs text-muted-foreground">
            Last checked: {health ? new Date(health.timestamp).toLocaleString() : '—'}
          </p>
        </div>
        <Badge className={overall ? 'bg-green-500/15 text-green-400 border-green-500/25' : 'bg-red-500/15 text-red-400 border-red-500/25'}>
          {health?.status ?? 'unknown'}
        </Badge>
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {checks.map(({ label, icon: Icon, status, detail }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{detail}</p>
            </div>
            <StatusIcon status={status} />
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
        <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
          <li>The database is backed up every night on the server; the last 14 are kept. Vaults and files in them stay encrypted.</li>
          <li>Backups live on the same server. For off-site protection, copy the backups folder somewhere else from time to time.</li>
          <li>Rate limits are kept in memory, which is right for one server. Add Upstash Redis only if you run several app servers.</li>
          <li>No secrets or environment values are shown here, only whether things are set up.</li>
        </ul>
      </div>
    </div>
  );
}
