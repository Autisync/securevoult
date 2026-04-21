'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Database, Shield, Zap, Package, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';

interface HealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  checks: {
    database: { status: string; pingMs: number | null; configured: boolean };
    firebaseAdmin: { status: string };
    rateLimiting: { mode: string };
  };
  build: {
    version: string;
    nodeEnv: string;
  };
}

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
    {
      label: 'Rate limiting',
      icon: Zap,
      status: (health.checks.rateLimiting.mode === 'redis' ? 'ok' : 'warn') as 'ok' | 'warn' | 'error',
      detail: health.checks.rateLimiting.mode === 'redis'
        ? 'Redis — distributed'
        : 'In-memory — single process (upgrade to Redis for production scale)',
    },
    {
      label: 'Application',
      icon: Package,
      status: 'ok' as 'ok' | 'warn' | 'error',
      detail: `v${health.build.version} · ${health.build.nodeEnv}`,
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
          <li>Rate limiting is currently in-memory. For multi-region production deployments, configure a Redis adapter.</li>
          <li>Backup and export scheduling is not yet automated — export vault data manually from the admin panel.</li>
          <li>No secrets or environment variable values are exposed here — only configuration readiness status.</li>
        </ul>
      </div>
    </div>
  );
}
