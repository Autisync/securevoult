'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, ShieldAlert, RefreshCw, Search, AlertTriangle, CheckCircle2,
  ScanLine, Mail, Info, ArrowRight, RotateCcw, XCircle, ShieldCheck,
  ChevronDown, ChevronRight, Clipboard,
} from 'lucide-react';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface BreachSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}

interface BreachFinding {
  id: string;
  firebaseUid: string;
  entryLabel: string;
  entryUrl: string;
  breachType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'investigating' | 'resolved' | 'ignored' | 'false_positive';
  hibpCount: number;
  firstDetectedAt: string;
  lastCheckedAt: string;
  resolvedAt?: string;
  notes: { authorUid: string; text: string; createdAt: string }[];
}

interface EmailCheckResult {
  email: string;
  breaches: { Name: string; Title: string; BreachDate: string; Description: string; DataClasses: string[] }[];
  notConfigured?: boolean;
  error?: string;
}

interface PasteCheckResult {
  email: string;
  pastes: { Source: string; Id: string; Title: string | null; Date: string | null; EmailCount: number }[];
  notConfigured?: boolean;
  error?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/25',
  high:     'bg-orange-500/15 text-orange-400 border-orange-500/25',
  medium:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  low:      'bg-blue-500/15 text-blue-400 border-blue-500/25',
};

const STATUS_COLORS: Record<string, string> = {
  new:            'bg-red-500/10 text-red-400',
  investigating:  'bg-orange-500/10 text-orange-400',
  resolved:       'bg-green-500/10 text-green-400',
  ignored:        'bg-secondary text-muted-foreground',
  false_positive: 'bg-secondary text-muted-foreground',
};

const BREACH_TYPE_LABELS: Record<string, string> = {
  password_exposed:   'Password exposed in data breach',
  email_exposed:      'Email address exposed',
  credential_reuse:   'Credentials reused across sites',
  stale_password:     'Stale / aged password',
};

const REMEDIATION: Record<string, { priority: string; steps: string[] }> = {
  password_exposed: {
    priority: 'Immediate action required',
    steps: [
      'Change the password for this account immediately.',
      'If the same password is used elsewhere, change those too.',
      'Enable two-factor authentication on the affected account.',
      'Review recent account activity for unauthorized access.',
    ],
  },
  email_exposed: {
    priority: 'Monitor and take precautions',
    steps: [
      'Be vigilant for phishing emails targeting this address.',
      'Review accounts that use this email as a recovery address.',
      'Enable spam filtering / extra scrutiny on sign-in notifications.',
    ],
  },
  credential_reuse: {
    priority: 'High — multiple accounts at risk',
    steps: [
      'Generate a unique password for each account using the vault generator.',
      'Update the reused password on all affected sites.',
      'Enable 2FA where available.',
    ],
  },
  stale_password: {
    priority: 'Rotate credentials',
    steps: [
      'Generate a new strong password using the vault generator.',
      'Update the password on the affected website.',
      'Consider a 90-day rotation reminder if the site is sensitive.',
    ],
  },
};

export function AdminBreachCenter() {
  const [summary, setSummary]       = useState<BreachSummary | null>(null);
  const [findings, setFindings]     = useState<BreachFinding[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter]   = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [noteText, setNoteText]     = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Email check
  const [emailCheckOpen, setEmailCheckOpen] = useState(false);
  const [emailQuery, setEmailQuery] = useState('');
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailCheckResult | null>(null);

  // Paste check
  const [pasteCheckOpen, setPasteCheckOpen] = useState(false);
  const [pasteQuery, setPasteQuery] = useState('');
  const [pasteChecking, setPasteChecking] = useState(false);
  const [pasteResult, setPasteResult] = useState<PasteCheckResult | null>(null);

  // Scan-all
  const [scanAllLoading, setScanAllLoading] = useState(false);

  const { toast } = useToast();

  const loadFindings = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AuthService.getIdToken();
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      const res = await fetch(`/api/admin/breach-findings?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load breach findings');
      const data = await res.json();
      setSummary(data.summary);
      setFindings(data.findings ?? []);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, toast]);

  useEffect(() => { loadFindings(); }, [loadFindings]);

  const updateFinding = async (findingId: string, status: string, note?: string) => {
    try {
      setActionLoading(true);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/breach-findings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ findingId, status, note }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast({ title: 'Finding updated' });
      setNoteText('');
      setExpanded(null);
      await loadFindings();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const addNote = async (findingId: string) => {
    if (!noteText.trim()) return;
    try {
      setActionLoading(true);
      const token = await AuthService.getIdToken();
      await fetch('/api/admin/breach-findings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ findingId, note: noteText.trim() }),
      });
      toast({ title: 'Note added' });
      setNoteText('');
      await loadFindings();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const runEmailCheck = async () => {
    const email = emailQuery.trim();
    if (!email || !email.includes('@')) {
      toast({ title: 'Enter a valid email address', variant: 'destructive' });
      return;
    }
    try {
      setEmailChecking(true);
      setEmailResult(null);
      const token = await AuthService.getIdToken();
      const res = await fetch(`/api/admin/breach-findings/email-check?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok && !data.notConfigured) throw new Error(data.error ?? 'Check failed');
      setEmailResult(data);
    } catch (err) {
      toast({ title: 'Email check failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setEmailChecking(false);
    }
  };

  const runPasteCheck = async () => {
    const email = pasteQuery.trim();
    if (!email || !email.includes('@')) {
      toast({ title: 'Enter a valid email address', variant: 'destructive' });
      return;
    }
    try {
      setPasteChecking(true);
      setPasteResult(null);
      const token = await AuthService.getIdToken();
      const res = await fetch(`/api/admin/breach-findings/paste-check?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok && !data.notConfigured) throw new Error(data.error ?? 'Paste check failed');
      setPasteResult(data);
    } catch (err) {
      toast({ title: 'Paste check failed', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setPasteChecking(false);
    }
  };

  const filtered = findings.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.entryLabel.toLowerCase().includes(q) ||
      f.entryUrl.toLowerCase().includes(q) ||
      f.firebaseUid.toLowerCase().includes(q)
    );
  });

  const runScanAll = async () => {
    try {
      setScanAllLoading(true);
      const token = await AuthService.getIdToken();
      const res = await fetch('/api/admin/breach-findings/scan-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scan trigger failed');
      toast({ title: 'Rescan queued', description: data.message });
      await loadFindings();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    } finally {
      setScanAllLoading(false);
    }
  };

  const totalActive = (summary?.critical ?? 0) + (summary?.high ?? 0) + (summary?.medium ?? 0) + (summary?.low ?? 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />Exposure Monitoring
          </h2>
          <p className="text-sm text-muted-foreground">
            Breach intelligence — credential exposures, email risk analysis, and remediation tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setEmailCheckOpen(!emailCheckOpen)}>
            <Mail className="w-3.5 h-3.5" />Email check
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setPasteCheckOpen(!pasteCheckOpen)}>
            <Clipboard className="w-3.5 h-3.5" />Paste check
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={runScanAll} disabled={scanAllLoading}>
            {scanAllLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Scan all
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={loadFindings}>
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </Button>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-2.5 p-3 bg-blue-500/8 border border-blue-500/20 rounded-lg">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-300/90">
          Password exposure checks use k-anonymity — only a 5-char SHA-1 prefix is transmitted. Plaintext passwords never leave your device. Email and paste exposure checks use the HIBP API (configure <code className="bg-blue-500/15 px-0.5 rounded">HIBP_API_KEY</code>).
        </p>
      </div>

      {/* Email check panel */}
      {emailCheckOpen && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />Email breach check
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEmailCheckOpen(false); setEmailResult(null); }}>
              Close
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Check if an email appears in known data breaches via HaveIBeenPwned. Requires <code className="bg-secondary px-1 rounded">HIBP_API_KEY</code>.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={emailQuery}
              onChange={e => setEmailQuery(e.target.value)}
              className="h-9 bg-secondary/50 border-border/60 flex-1"
              onKeyDown={e => { if (e.key === 'Enter') runEmailCheck(); }}
            />
            <Button size="sm" className="h-9 bg-primary hover:bg-primary/90" onClick={runEmailCheck} disabled={emailChecking}>
              {emailChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check'}
            </Button>
          </div>

          {emailResult && (
            <div className="space-y-2">
              {emailResult.notConfigured ? (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">HIBP API key not configured</p>
                    <p className="opacity-80 mt-0.5">
                      Add <code className="bg-yellow-500/15 px-1 rounded">HIBP_API_KEY=your_key</code> to your environment.
                    </p>
                  </div>
                </div>
              ) : emailResult.error ? (
                <div className="flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg text-xs text-red-400">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />{emailResult.error}
                </div>
              ) : emailResult.breaches.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/8 border border-green-500/20 rounded-lg text-xs text-green-400">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <strong>{emailResult.email}</strong>&nbsp;— not found in any known breaches.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg text-xs text-red-400">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <strong>{emailResult.email}</strong>&nbsp;appears in <strong>{emailResult.breaches.length}</strong> breach{emailResult.breaches.length !== 1 ? 'es' : ''}.
                  </div>
                  {emailResult.breaches.slice(0, 5).map(b => (
                    <div key={b.Name} className="text-xs bg-secondary/50 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{b.Title}</p>
                        <p className="text-muted-foreground">{b.BreachDate}</p>
                      </div>
                      <p className="text-muted-foreground/80 line-clamp-2">
                        {b.Description.replace(/<[^>]+>/g, '').slice(0, 200)}
                      </p>
                      {b.DataClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {b.DataClasses.slice(0, 6).map(dc => (
                            <span key={dc} className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded">{dc}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Paste check panel */}
      {pasteCheckOpen && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-primary" />Paste exposure check
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setPasteCheckOpen(false); setPasteResult(null); }}>
              Close
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Check if an email has appeared in paste exposure dumps (Pastebin, GitHub Gist, etc.) via HaveIBeenPwned. Requires <code className="bg-secondary px-1 rounded">HIBP_API_KEY</code>.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={pasteQuery}
              onChange={e => setPasteQuery(e.target.value)}
              className="h-9 bg-secondary/50 border-border/60 flex-1"
              onKeyDown={e => { if (e.key === 'Enter') runPasteCheck(); }}
            />
            <Button size="sm" className="h-9 bg-primary hover:bg-primary/90" onClick={runPasteCheck} disabled={pasteChecking}>
              {pasteChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check'}
            </Button>
          </div>

          {pasteResult && (
            <div className="space-y-2">
              {pasteResult.notConfigured ? (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">HIBP API key not configured</p>
                    <p className="opacity-80 mt-0.5">
                      Add <code className="bg-yellow-500/15 px-1 rounded">HIBP_API_KEY=your_key</code> to your environment.
                    </p>
                  </div>
                </div>
              ) : pasteResult.error ? (
                <div className="flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg text-xs text-red-400">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />{pasteResult.error}
                </div>
              ) : pasteResult.pastes.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-green-500/8 border border-green-500/20 rounded-lg text-xs text-green-400">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <strong>{pasteResult.email}</strong>&nbsp;— not found in any known paste dumps.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg text-xs text-red-400">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <strong>{pasteResult.email}</strong>&nbsp;appears in <strong>{pasteResult.pastes.length}</strong> paste dump{pasteResult.pastes.length !== 1 ? 's' : ''}.
                  </div>
                  {pasteResult.pastes.slice(0, 8).map(p => (
                    <div key={p.Id} className="text-xs bg-secondary/50 rounded-lg px-3 py-2 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{p.Title ?? p.Id}</p>
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{p.Source}</span>
                      </div>
                      <div className="flex gap-3 text-muted-foreground/70">
                        {p.Date && <span>{p.Date.slice(0, 10)}</span>}
                        {p.EmailCount > 0 && <span>{p.EmailCount.toLocaleString()} emails in dump</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {[
            { label: 'Critical', count: summary.critical, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
            { label: 'High',     count: summary.high,     cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
            { label: 'Medium',   count: summary.medium,   cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
            { label: 'Low',      count: summary.low,      cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
            { label: 'Resolved', count: summary.resolved, cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
          ].map(({ label, count, cls }) => (
            <div key={label} className={`border rounded-xl p-3 text-center ${cls}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5 opacity-80">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            placeholder="Search entry, URL, user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-secondary/50 border-border/60"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 bg-secondary/50 border-border/60">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
            <SelectItem value="false_positive">False positive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-9 w-36 bg-secondary/50 border-border/60">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Findings list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-green-400/50 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {totalActive === 0 ? 'No breach findings recorded yet.' : 'No findings match your filters.'}
          </p>
          {totalActive === 0 && (
            <p className="text-xs text-muted-foreground/60">
              Findings are created automatically when users run breach checks from their vault Security Center.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Clickable row header */}
              <button
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
                onClick={() => setExpanded(expanded === f.id ? null : f.id)}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{f.entryLabel || '(unnamed entry)'}</p>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${SEVERITY_COLORS[f.severity] ?? ''}`}>
                      {f.severity}
                    </Badge>
                    <Badge className={`text-[10px] h-4 ${STATUS_COLORS[f.status] ?? ''}`}>
                      {f.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{BREACH_TYPE_LABELS[f.breachType] ?? f.breachType}</p>
                  {f.entryUrl && (
                    <p className="text-xs text-muted-foreground/60 truncate">{f.entryUrl}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
                    {f.hibpCount > 0 && <span>Seen {f.hibpCount.toLocaleString()}× in breaches</span>}
                    <span>Detected {formatDistanceToNow(new Date(f.firstDetectedAt), { addSuffix: true })}</span>
                    <span>Checked {formatDistanceToNow(new Date(f.lastCheckedAt), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 mt-0.5">
                  {expanded === f.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === f.id && (
                <div className="border-t border-border px-4 py-3 bg-secondary/20 space-y-3">
                  {/* Remediation guidance */}
                  {REMEDIATION[f.breachType] && (
                    <div className="flex items-start gap-2.5 p-3 bg-orange-500/8 border border-orange-500/20 rounded-lg">
                      <ArrowRight className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-orange-400">{REMEDIATION[f.breachType].priority}</p>
                        <ul className="space-y-1">
                          {REMEDIATION[f.breachType].steps.map((step, i) => (
                            <li key={i} className="text-xs text-orange-300/80 flex gap-1.5">
                              <span className="text-orange-400/60 flex-shrink-0">{i + 1}.</span>{step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {f.notes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Admin notes</p>
                      {f.notes.map((n, i) => (
                        <div key={i} className="text-xs bg-card border border-border rounded-lg px-3 py-2">
                          <p>{n.text}</p>
                          <p className="text-muted-foreground/50 mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add note */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add admin note..."
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      className="h-8 text-xs bg-card border-border/60"
                    />
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={() => addNote(f.id)} disabled={actionLoading || !noteText.trim()}>
                      Add note
                    </Button>
                  </div>

                  {/* Status actions */}
                  <div className="flex flex-wrap gap-2">
                    {f.status === 'new' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-orange-400 border-orange-500/30" onClick={() => updateFinding(f.id, 'investigating')} disabled={actionLoading}>
                        Mark investigating
                      </Button>
                    )}
                    {f.status !== 'resolved' && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-400 border-green-500/30" onClick={() => updateFinding(f.id, 'resolved')} disabled={actionLoading}>
                          Mark resolved
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground" onClick={() => updateFinding(f.id, 'ignored')} disabled={actionLoading}>
                          Ignore
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground" onClick={() => updateFinding(f.id, 'false_positive')} disabled={actionLoading}>
                          False positive
                        </Button>
                      </>
                    )}
                    {(f.status === 'resolved' || f.status === 'ignored' || f.status === 'false_positive') && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-orange-400 border-orange-500/30 gap-1" onClick={() => updateFinding(f.id, 'investigating')} disabled={actionLoading}>
                        <RotateCcw className="w-3 h-3" />Reopen
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Scan info */}
      <div className="flex items-start gap-2.5 p-3 bg-secondary/30 border border-border rounded-lg">
        <ScanLine className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium">How scans work</p>
          <p className="mt-0.5">Users trigger breach checks from their vault Security Center. Results are recorded here for admin visibility. Findings are created per vault entry — not per user account.</p>
        </div>
      </div>
    </div>
  );
}
