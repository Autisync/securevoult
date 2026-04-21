'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Users, Shield, Activity, AlertTriangle, ShieldAlert, RefreshCw,
  Building2, TrendingUp, Zap,
} from 'lucide-react';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { PLAN_META, PlanId } from '@/lib/plans';

interface OverviewMetrics {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  activeSessions: number;
  newUsersToday: number;
  newUsersWeek: number;
  openIncidents: number;
  criticalIncidents: number;
  totalBreachFindings: number;
  unresolvedBreaches: number;
  totalCompanies: number;
  activeCompanies: number;
  companiesAtRisk: number;
  planDistribution: Record<string, number>;
  companyPlanDistribution: Record<string, number>;
}

interface RecentIncident {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  createdAt: string;
  affectedUserEmail?: string;
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

interface Props {
  onNavigate: (section: string) => void;
}

export function AdminOverview({ onNavigate }: Props) {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<RecentIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load overview');
      const data = await res.json();
      setMetrics(data.metrics);
      setRecentIncidents(data.recentIncidents ?? []);
    } catch (err) {
      toast({ title: 'Failed to load overview', description: err instanceof Error ? err.message : '', variant: 'destructive' });
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

  if (!metrics) return null;

  const statCards = [
    { label: 'Total users',          value: metrics.totalUsers,          sub: `${metrics.newUsersToday} today`,                                      icon: Users,       color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { label: 'Active users',         value: metrics.activeUsers,         sub: `${metrics.adminCount} admins`,                                        icon: Shield,      color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Active sessions',      value: metrics.activeSessions,      sub: 'last 24 hours',                                                       icon: Activity,    color: 'text-green-400',  bg: 'bg-green-500/10' },
    { label: 'Open incidents',       value: metrics.openIncidents,       sub: `${metrics.criticalIncidents} critical`,                               icon: AlertTriangle, color: metrics.criticalIncidents > 0 ? 'text-red-400' : 'text-orange-400', bg: metrics.criticalIncidents > 0 ? 'bg-red-500/10' : 'bg-orange-500/10' },
    { label: 'Exposure findings',    value: metrics.totalBreachFindings, sub: `${metrics.unresolvedBreaches} unresolved`,                            icon: ShieldAlert, color: metrics.unresolvedBreaches > 0 ? 'text-red-400' : 'text-muted-foreground', bg: metrics.unresolvedBreaches > 0 ? 'bg-red-500/10' : 'bg-secondary' },
    { label: 'Companies',            value: metrics.totalCompanies,      sub: `${metrics.activeCompanies} active · ${metrics.companiesAtRisk} at risk`, icon: Building2, color: metrics.companiesAtRisk > 0 ? 'text-orange-400' : 'text-teal-400', bg: metrics.companiesAtRisk > 0 ? 'bg-orange-500/10' : 'bg-teal-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System overview</h2>
          <p className="text-sm text-muted-foreground">Real-time snapshot of platform activity.</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'View incidents',     section: 'resolution', color: 'text-orange-400' },
          { label: 'Exposure center',    section: 'breach',     color: 'text-red-400' },
          { label: 'Manage users',       section: 'users',      color: 'text-blue-400' },
          { label: 'System health',      section: 'health',     color: 'text-green-400' },
        ].map(({ label, section, color }) => (
          <button
            key={section}
            onClick={() => onNavigate(section)}
            className={`px-3 py-2.5 bg-card border border-border rounded-lg text-sm font-medium ${color} hover:bg-secondary/50 transition-colors text-left`}
          >
            {label} →
          </button>
        ))}
      </div>

      {/* Plan distribution */}
      {metrics.planDistribution && Object.keys(metrics.planDistribution).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User plan distribution */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">User plan distribution</p>
            </div>
            <div className="space-y-2">
              {(['free', 'pro', 'company', 'enterprise'] as PlanId[]).map(plan => {
                const count = metrics.planDistribution[plan] ?? 0;
                const pct = metrics.totalUsers > 0 ? Math.round((count / metrics.totalUsers) * 100) : 0;
                const meta = PLAN_META[plan];
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={meta.color}>{meta.name}</span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Platform health</p>
            </div>
            <div className="space-y-2">
              {[
                {
                  label: 'Companies at risk',
                  value: metrics.companiesAtRisk,
                  warn: metrics.companiesAtRisk > 0,
                  action: () => onNavigate('companies'),
                },
                {
                  label: 'Critical incidents',
                  value: metrics.criticalIncidents,
                  warn: metrics.criticalIncidents > 0,
                  action: () => onNavigate('resolution'),
                },
                {
                  label: 'Unresolved exposures',
                  value: metrics.unresolvedBreaches,
                  warn: metrics.unresolvedBreaches > 0,
                  action: () => onNavigate('breach'),
                },
                {
                  label: 'New users this week',
                  value: metrics.newUsersWeek,
                  warn: false,
                  action: () => onNavigate('users'),
                },
              ].map(({ label, value, warn, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center justify-between text-xs py-1.5 hover:opacity-80 transition-opacity"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${warn ? 'text-red-400' : 'text-foreground'}`}>{value}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent incidents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent incidents</h3>
          <button onClick={() => onNavigate('resolution')} className="text-xs text-primary hover:underline">View all →</button>
        </div>
        {recentIncidents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl py-8 text-center">
            <p className="text-sm text-muted-foreground">No incidents — platform looks healthy.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentIncidents.map(inc => (
              <div key={inc.id} className="flex items-start gap-3 px-4 py-3 bg-card border border-border rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{inc.title}</p>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${SEVERITY_COLORS[inc.severity] ?? ''}`}>
                      {inc.severity}
                    </Badge>
                  </div>
                  {inc.affectedUserEmail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{inc.affectedUserEmail}</p>
                  )}
                  <p className="text-xs text-muted-foreground/50 mt-0.5">
                    {inc.category.replace(/_/g, ' ')} · {formatDistanceToNow(new Date(inc.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Badge className={`text-[10px] h-5 ${STATUS_COLORS[inc.status] ?? ''} flex-shrink-0`}>
                  {inc.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
