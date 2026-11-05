'use client';

import { useMemo, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useVault } from '@/contexts/VaultContext';
import { CryptoService } from '@/lib/crypto';
import { checkMultiplePasswords, BreachResult } from '@/lib/breach';
import { PasswordEntry } from '@/types/vault';
import { ShieldAlert, AlertTriangle, CheckCircle2, Globe, Lock, RefreshCw, Zap, Loader2, Info, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FixPasswordDialog, type FixReason } from '@/components/FixPasswordDialog';

interface SecurityIssue {
  entry: PasswordEntry;
  issues: string[];
  severity: 'high' | 'medium' | 'low';
}

interface SecurityCenterProps {
  onEditEntry?: (entry: PasswordEntry) => void;
}

// Explanations shown in the score breakdown
const SCORE_FACTORS = [
  { key: 'weak',    label: 'Weak passwords',    description: 'Short or predictable passwords that are easy to crack. Aim for 16+ characters with symbols.', penalty: '−10 pts each', color: 'text-red-400',    bg: 'bg-red-500/8',    border: 'border-red-500/15' },
  { key: 'reused',  label: 'Reused passwords',  description: 'The same password used on multiple sites. If one site is breached, all accounts sharing that password are at risk.', penalty: '−8 pts each', color: 'text-orange-400', bg: 'bg-orange-500/8', border: 'border-orange-500/15' },
  { key: 'stale',   label: 'Stale passwords',   description: 'Passwords unchanged for 90+ days. Regular rotation reduces the window of exposure after a silent breach.', penalty: '−3 pts each', color: 'text-yellow-400', bg: 'bg-yellow-500/8',  border: 'border-yellow-500/15' },
];

export function SecurityCenter({ onEditEntry }: SecurityCenterProps) {
  const { vault } = useVault();

  const [fix, setFix] = useState<{ entry: PasswordEntry; reason: FixReason } | null>(null);
  const [breachLoading, setBreachLoading] = useState(false);
  const [breachProgress, setBreachProgress] = useState(0);
  const [breachResults, setBreachResults] = useState<Map<string, BreachResult> | null>(null);
  const [breachError, setBreachError] = useState<string | null>(null);
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const [issueGroupExpanded, setIssueGroupExpanded] = useState<Record<string, boolean>>({});

  const runBreachCheck = useCallback(async () => {
    if (!vault?.entries.length) return;
    const passwords = vault.entries.map(e => e.password).filter(Boolean) as string[];
    setBreachLoading(true);
    setBreachProgress(0);
    setBreachError(null);
    try {
      const results = await checkMultiplePasswords(
        passwords,
        (done, total) => setBreachProgress(Math.round((done / total) * 100)),
        3,
      );
      setBreachResults(results);
    } catch (err) {
      setBreachError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBreachLoading(false);
    }
  }, [vault]);

  const breachedEntries = useMemo(() => {
    if (!breachResults || !vault?.entries) return [];
    return vault.entries.filter(e => e.password && (breachResults.get(e.password)?.breached ?? false));
  }, [breachResults, vault]);

  const breachErrorCount = useMemo(() => {
    if (!breachResults) return 0;
    return Array.from(breachResults.values()).filter(r => r.error).length;
  }, [breachResults]);

  const issues = useMemo<SecurityIssue[]>(() => {
    if (!vault?.entries.length) return [];
    const entries = vault.entries;
    const results: SecurityIssue[] = [];
    const passwordCounts = new Map<string, number>();
    // Only items that have a password: cards, notes, bank details and passkey-only logins are not "weak" or "reused".
    const hasPassword = (e: PasswordEntry) => !!e.password && ['login', 'wifi'].includes(e.type ?? 'login');
    for (const e of entries) {
      if (hasPassword(e)) passwordCounts.set(e.password, (passwordCounts.get(e.password) ?? 0) + 1);
    }
    const now = Date.now();
    const ninetyDays  = 90  * 24 * 60 * 60 * 1000;
    const oneEightyDays = 180 * 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!hasPassword(entry)) continue;
      const entryIssues: string[] = [];
      let severity: SecurityIssue['severity'] = 'low';
      const strength = CryptoService.checkPasswordStrength(entry.password);
      if (strength.strength === 'weak') {
        entryIssues.push('Weak password');
        severity = 'high';
      } else if (strength.strength === 'fair') {
        entryIssues.push('Password could be stronger');
        severity = 'medium' as SecurityIssue['severity'];
      }
      if ((passwordCounts.get(entry.password) ?? 0) > 1) {
        entryIssues.push('Reused password');
        severity = 'high';
      }
      const age = now - new Date(entry.updatedAt).getTime();
      if (age > oneEightyDays) {
        entryIssues.push(`Not updated in ${formatDistanceToNow(new Date(entry.updatedAt))}`);
        if (severity !== 'high') severity = 'medium';
      } else if (age > ninetyDays) {
        entryIssues.push(`Not updated in ${formatDistanceToNow(new Date(entry.updatedAt))}`);
      }
      if (!entry.url && entry.type !== 'note' && entry.type !== 'wifi' && entry.type !== 'identity') {
        entryIssues.push('No URL — autofill won\'t work');
      }
      const has2faTag = !!entry.totp || (entry.tags ?? []).some(t => ['2fa', '2-fa', 'mfa'].includes(t.toLowerCase()));
      if (!has2faTag && (entry.type === 'login' || !entry.type) && entry.url) {
        entryIssues.push('No 2FA tag — consider enabling two-factor authentication');
      }
      if (entryIssues.length > 0) results.push({ entry, issues: entryIssues, severity });
    }
    return results.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [vault]);

  const highCount   = issues.filter((i) => i.severity === 'high').length;
  const medCount    = issues.filter((i) => i.severity === 'medium').length;
  const lowCount    = issues.filter((i) => i.severity === 'low').length;
  const weakCount   = issues.filter(i => i.issues.some(s => s.includes('Weak'))).length;
  const reusedCount = issues.filter(i => i.issues.some(s => s.includes('Reused'))).length;
  const staleCount  = issues.filter(i => i.issues.some(s => s.includes('Not updated'))).length;
  const noUrlCount  = issues.filter(i => i.issues.some(s => s.includes('No URL'))).length;
  const no2faCount  = issues.filter(i => i.issues.some(s => s.includes('2FA'))).length;
  const total = vault?.entries.length ?? 0;

  const score = total === 0 ? 100 : Math.max(0, Math.round(
    100
    - (weakCount   / total) * 50
    - (reusedCount / total) * 35
    - (staleCount  / total) * 15
  ));

  const scoreColor  = score >= 80 ? 'text-green-400'  : score >= 50 ? 'text-yellow-400'  : 'text-red-400';
  const scoreStroke = score >= 80 ? '#4ade80'          : score >= 50 ? '#facc15'           : '#f87171';
  const scoreLabel  = score >= 80 ? 'Good standing'   : score >= 50 ? 'Needs attention'  : 'At risk';

  const badgeVariant = (sev: 'high' | 'medium' | 'low') =>
    sev === 'high'   ? 'bg-red-500/15 text-red-400 border-red-500/20'
    : sev === 'medium' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20'
    : 'bg-primary/15 text-primary border-primary/20';

  // Group issues by type
  const groupedIssues = useMemo(() => {
    const groups: { label: string; key: string; entries: SecurityIssue[]; icon: React.ElementType; color: string; bg: string; severity: 'high'|'medium'|'low' }[] = [
      { label: 'Weak passwords', key: 'weak', entries: issues.filter(i => i.issues.some(s => s.includes('Weak'))), icon: Lock, color: 'text-red-400', bg: 'bg-red-500/15', severity: 'high' as const },
      { label: 'Reused passwords', key: 'reused', entries: issues.filter(i => i.issues.some(s => s.includes('Reused'))), icon: RefreshCw, color: 'text-orange-400', bg: 'bg-orange-500/15', severity: 'high' as const },
      { label: 'Stale passwords', key: 'stale', entries: issues.filter(i => i.issues.some(s => s.includes('Not updated'))), icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/15', severity: 'medium' as const },
      { label: 'Missing URL', key: 'nourl', entries: issues.filter(i => i.issues.some(s => s.includes('No URL'))), icon: Globe, color: 'text-primary', bg: 'bg-primary/15', severity: 'low' as const },
      { label: 'No 2FA', key: 'no2fa', entries: issues.filter(i => i.issues.some(s => s.includes('2FA'))), icon: ShieldAlert, color: 'text-violet-400', bg: 'bg-violet-500/15', severity: 'low' as const },
    ].filter(g => g.entries.length > 0);
    return groups;
  }, [issues]);

  const toggleGroup = (key: string) => setIssueGroupExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // Fix-now guidance per issue type
  const FIX_GUIDANCE: Record<string, string> = {
    weak:    'Open each entry and use the password generator to create a strong, unique password.',
    reused:  'Generate a unique password for each entry listed below. Using the same password across sites is the #1 cause of account takeovers.',
    stale:   'Update these passwords — especially on banking, email, and social media accounts.',
    nourl:   'Add a URL so the browser extension can auto-fill credentials on the matching site.',
    no2fa:   'Turn on two-factor authentication on the site and paste its setup key into the item: SecureVoult then shows the codes.',
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold">Security center</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Review and fix security issues in your vault.</p>
      </div>

      {/* Score card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 80 80" className="w-20 h-20">
              <circle cx="40" cy="40" r="30" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="30"
                fill="none"
                stroke={scoreStroke}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 188.5} 188.5`}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${scoreColor}`}>{score}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{scoreLabel}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                score >= 80 ? 'bg-green-500/15 text-green-400' : score >= 50 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
              }`}>Score {score}/100</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {issues.length === 0
                ? 'No issues found. Your vault is in great shape.'
                : score >= 80 ? `${highCount > 0 ? `${highCount} high-priority issue${highCount > 1 ? 's' : ''} to address.` : `${issues.length} minor issue${issues.length > 1 ? 's' : ''} to review.`}`
                : score >= 50 ? `${highCount} critical issue${highCount !== 1 ? 's' : ''} and ${medCount} warning${medCount !== 1 ? 's' : ''} need attention.`
                : `${highCount} critical, ${medCount} medium — your vault needs immediate attention.`}
            </p>
            <div className="flex gap-4 mt-2.5 text-xs">
              <span className="text-red-400 font-medium"><strong>{highCount}</strong> High</span>
              <span className="text-yellow-400 font-medium"><strong>{medCount}</strong> Medium</span>
              <span className="text-primary font-medium"><strong>{lowCount}</strong> Low</span>
            </div>
          </div>
        </div>

        {/* Score breakdown explainer */}
        <button
          onClick={() => setScoreExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />How is this score calculated?</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${scoreExpanded ? 'rotate-180' : ''}`} />
        </button>
        {scoreExpanded && (
          <div className="space-y-2 pt-1">
            {SCORE_FACTORS.map(({ key, label, description, penalty, color, bg, border }) => (
              <div key={key} className={`flex items-start gap-3 ${bg} border ${border} rounded-xl px-3 py-2.5`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${color}`}>{label}</span>
                    <span className="text-xs text-muted-foreground/60">{penalty}</span>
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground/50 px-1">
              Score = 100 − (50 × weak%) − (35 × reused%) − (15 × stale%). "Missing URL" and "No 2FA tag" are informational and do not reduce your score.
            </p>
          </div>
        )}
      </div>

      {/* Summary chips */}
      {issues.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { icon: Lock,          label: 'Weak',       count: weakCount,   color: 'text-red-400',    bg: 'bg-red-500/10' },
            { icon: RefreshCw,     label: 'Reused',     count: reusedCount, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { icon: AlertTriangle, label: 'Stale',      count: staleCount,  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { icon: Globe,         label: 'Missing URL',count: noUrlCount,  color: 'text-primary',   bg: 'bg-primary/10' },
            { icon: ShieldAlert,   label: 'No 2FA', count: no2faCount,  color: 'text-amber-300', bg: 'bg-amber-500/10' },
          ].map(({ icon: Icon, label, count, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-bold">{count}</p>
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Breach monitoring */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Breach monitoring</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Checks your passwords against <strong>HaveIBeenPwned</strong> using a k-anonymity model —
                only a 5-character hash prefix is sent. Your actual password never leaves your device.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={breachResults ? 'outline' : 'default'}
            className="flex-shrink-0 h-8 text-xs"
            onClick={runBreachCheck}
            disabled={breachLoading || !vault?.entries.length}
          >
            {breachLoading
              ? <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />{breachProgress}%</>
              : breachResults
              ? <><RefreshCw className="w-3 h-3 mr-1.5" />Re-check</>
              : <><Zap className="w-3 h-3 mr-1.5" />Check now</>}
          </Button>
        </div>

        {breachLoading && (
          <div className="space-y-1.5">
            <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${breachProgress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Checking {vault?.entries.length} passwords… {breachProgress}% complete</p>
          </div>
        )}

        {!breachLoading && breachResults && (
          <>
            {breachedEntries.length === 0 ? (
              <div className="flex items-center gap-2.5 bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-400">No breached passwords found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    None of your {vault!.entries.length} passwords appeared in known data breach databases.
                    {breachErrorCount > 0 && ` (${breachErrorCount} check${breachErrorCount > 1 ? 's' : ''} failed — try re-checking)`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                  <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">
                      {breachedEntries.length} password{breachedEntries.length > 1 ? 's' : ''} found in known data breaches
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      These passwords were exposed in publicly known security incidents. Change them as soon as possible — especially if used for email, banking, or social media.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {breachedEntries.map(entry => {
                    const result = breachResults.get(entry.password)!;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl">
                        <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.website}</p>
                          <p className="text-xs text-muted-foreground">
                            Seen in {result.count.toLocaleString()} breach record{result.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 border-red-500/30 text-red-400 hover:bg-red-500/10 flex-shrink-0"
                          onClick={() => setFix({ entry, reason: 'breached' })}
                        >
                          Fix now <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {!breachLoading && breachError && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Breach check failed: {breachError}. Check your internet connection and try again.
          </div>
        )}

        {!breachResults && !breachLoading && (
          <p className="text-xs text-muted-foreground/60">
            Vault health checks run locally. Breach checks require a single network request per password hash prefix — never your actual password.
          </p>
        )}
      </div>

      {/* Grouped issues */}
      {issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="font-semibold mb-1">All clear!</h3>
          <p className="text-sm text-muted-foreground">No security issues detected in your vault.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{issues.length} issue{issues.length > 1 ? 's' : ''} found across {total} entries</h3>
          </div>
          {groupedIssues.map(({ label, key, entries, icon: Icon, color, bg, severity }) => {
            const expanded = issueGroupExpanded[key] !== false; // default open
            return (
              <div key={key} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Group header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
                  onClick={() => toggleGroup(key)}
                >
                  <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${badgeVariant(severity)}`}>{entries.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{FIX_GUIDANCE[key]}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Entry list */}
                {expanded && (
                  <div className="border-t border-border/50 divide-y divide-border/30">
                    {entries.map(({ entry, issues: entryIssues }) => (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.website}</p>
                          <p className="text-xs text-muted-foreground/70 truncate">
                            {entryIssues.filter(s => {
                              if (key === 'weak')   return s.includes('Weak') || s.includes('stronger');
                              if (key === 'reused') return s.includes('Reused');
                              if (key === 'stale')  return s.includes('Not updated');
                              if (key === 'nourl')  return s.includes('No URL');
                              if (key === 'no2fa')  return s.includes('2FA');
                              return false;
                            }).join(' · ')}
                          </p>
                        </div>
                        {['weak', 'reused', 'stale'].includes(key) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 flex-shrink-0"
                            onClick={() => setFix({ entry, reason: key === 'stale' ? 'old' : (key as FixReason) })}
                          >
                            Fix <ArrowRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        ) : onEditEntry && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                            onClick={() => onEditEntry(entry)}
                          >
                            Edit <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {fix && <FixPasswordDialog entry={fix.entry} reason={fix.reason} onClose={() => setFix(null)} />}
    </div>
  );
}
