'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScanSearch, Loader2, RefreshCw, Trash2, ChevronDown, ShieldCheck, ShieldAlert, Plus, MailCheck, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVault } from '@/contexts/VaultContext';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api-client';

interface Breach { name: string; title: string; domain: string; date: string; count: number; dataClasses: string[]; description: string; dismissed: boolean }
interface Watched { email: string; own: boolean; verified: boolean; lastChecked: string | null; source: string | null; breaches: Breach[] }

const SOURCE = { hibp: 'Have I Been Pwned', xposedornot: 'XposedOrNot' } as Record<string, string>;
const fmtCount = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** Watches email addresses for data breaches and says what to do about each one. */
export function BreachScanner() {
  const { vault } = useVault();
  const { toast } = useToast();
  const [data, setData] = useState<{ source: string; max: number; emails: Watched[] } | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    try { setData(await api('/api/monitor')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const replace = (w: Watched) => setData((d) => d && ({ ...d, emails: d.emails.some((x) => x.email === w.email) ? d.emails.map((x) => (x.email === w.email ? w : x)) : [...d.emails, w] }));

  const act = async (key: string, body: Record<string, unknown>, done?: (r: { email?: Watched; codeSent?: boolean; recent?: boolean }) => void) => {
    setBusy(key);
    try { const r = await api<{ email?: Watched; codeSent?: boolean; recent?: boolean }>('/api/monitor', body); if (r.email) replace(r.email); done?.(r); }
    catch (e) { toast({ title: e instanceof Error ? e.message : 'That didn\'t work', variant: 'destructive' }); }
    setBusy(null);
  };

  const add = (email: string) => act(`add:${email}`, { action: 'add', email }, (r) => {
    setNewEmail('');
    if (r.codeSent) { setCodeFor(email); setCode(''); toast({ title: `Code sent to ${email}`, description: 'Enter it below to start watching this address.' }); }
    else toast({ title: `Watching ${email}` });
  });

  const emails = data?.emails ?? [];
  const watched = new Set(emails.map((e) => e.email));
  const active = emails.flatMap((e) => e.breaches.filter((b) => !b.dismissed));

  // Suggestions: email addresses used as usernames in the vault, not watched yet.
  const suggestions = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of vault?.entries ?? []) {
      const u = (e.username || '').trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(u) && !watched.has(u)) count.set(u, (count.get(u) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [vault, watched]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5"><ScanSearch className="w-6 h-6 text-primary" />Data breach scanner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We check your email addresses against known data breaches every day and tell you when one turns up. Only the address is checked, never a password.
          {data && <> Source: {SOURCE[data.source] ?? data.source}.</>}
        </p>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {!data && !error && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Checking…</div>}

      {data && (
        <>
          <div className={`rounded-2xl border px-5 py-5 flex items-center gap-4 ${active.length ? 'border-red-500/30 bg-red-500/8' : 'border-emerald-500/30 bg-emerald-500/8'}`}>
            <span className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${active.length ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {active.length ? <ShieldAlert className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
            </span>
            <div className="min-w-0">
              <p className="text-3xl font-bold leading-none">{active.length}<span className="text-base font-medium text-muted-foreground ml-2">{active.length === 1 ? 'breach needs a look' : 'breaches need a look'}</span></p>
              <p className="text-sm text-muted-foreground mt-1.5">Watching {emails.filter((e) => e.verified).length} of up to {data.max} email addresses.</p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Monitored email addresses</h2>
            {emails.map((w) => {
              const live = w.breaches.filter((b) => !b.dismissed);
              const isOpen = open === w.email;
              return (
                <div key={w.email} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <button onClick={() => setOpen(isOpen ? null : w.email)} className="flex-1 min-w-0 flex items-center gap-3 text-left" disabled={!w.verified}>
                      <span className={`min-w-[44px] h-11 px-2 rounded-xl flex items-center justify-center font-bold ${!w.verified ? 'bg-secondary text-muted-foreground' : live.length ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                        {w.verified ? live.length : '…'}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{w.email}{w.own && <span className="ml-2 text-[11px] font-medium text-primary bg-primary/10 rounded-md px-1.5 py-0.5 align-middle">Your account</span>}</span>
                        <span className="block text-xs text-muted-foreground">
                          {!w.verified ? 'Waiting for the code we emailed' : w.lastChecked ? `${live.length ? `${live.length} breach${live.length === 1 ? '' : 'es'}` : 'No breaches found'} · checked ${formatDistanceToNow(new Date(w.lastChecked), { addSuffix: true })}` : 'Not checked yet'}
                        </span>
                      </span>
                      {w.verified && w.breaches.length > 0 && <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                    </button>
                    {w.verified ? (
                      <Button variant="ghost" size="sm" className="h-9" disabled={!!busy} onClick={() => act(`check:${w.email}`, { action: 'check', email: w.email }, (r) => toast({ title: r.recent ? 'Checked a moment ago' : 'Checked just now' }))}>
                        {busy === `check:${w.email}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Check now</span></>}
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="h-9" onClick={() => { setCodeFor(w.email); setCode(''); }}>Enter code</Button>
                    )}
                    {!w.own && (
                      <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-destructive" disabled={!!busy} aria-label={`Stop watching ${w.email}`}
                        onClick={() => act(`rm:${w.email}`, { action: 'remove', email: w.email }, () => setData((d) => d && ({ ...d, emails: d.emails.filter((x) => x.email !== w.email) })))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {codeFor === w.email && !w.verified && (
                    <form className="flex flex-wrap items-center gap-2 px-4 pb-4" onSubmit={(e) => { e.preventDefault(); void act(`verify:${w.email}`, { action: 'verify', email: w.email, code }, () => { setCodeFor(null); toast({ title: `Watching ${w.email}` }); }); }}>
                      <MailCheck className="w-4 h-4 text-muted-foreground" />
                      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" className="h-10 w-36 font-mono tracking-widest" autoFocus />
                      <Button type="submit" className="h-10" disabled={code.replace(/\D/g, '').length !== 6 || !!busy}>Confirm</Button>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => add(w.email)}>Send a new code</button>
                    </form>
                  )}

                  {isOpen && w.breaches.length > 0 && (
                    <ul className="border-t border-border/60 divide-y divide-border/50">
                      {w.breaches.map((b) => (
                        <li key={b.name} className={`px-4 py-3.5 ${b.dismissed ? 'opacity-60' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{b.title}{b.domain && <span className="text-muted-foreground font-normal"> · {b.domain}</span>}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{b.date ? `Breached ${b.date}` : 'Date unknown'}{b.count ? ` · ${fmtCount(b.count)} accounts` : ''}</p>
                              {b.dataClasses.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {b.dataClasses.slice(0, 8).map((c) => (
                                    <span key={c} className={`text-[11px] px-2 py-0.5 rounded-md ${/password/i.test(c) ? 'bg-red-500/15 text-red-300' : 'bg-secondary text-muted-foreground'}`}>{c}</span>
                                  ))}
                                </div>
                              )}
                              {b.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{b.description}</p>}
                              {!b.dismissed && (
                                <p className="text-xs mt-2 text-foreground/90">
                                  {b.dataClasses.some((c) => /password/i.test(c))
                                    ? `Change your ${b.domain || b.title} password, and anywhere you used the same one. Turn on two-step sign-in if the site offers it.`
                                    : 'No passwords were in this breach, but expect more spam and phishing to this address.'}
                                </p>
                              )}
                            </div>
                            {!b.dismissed ? (
                              <Button variant="outline" size="sm" className="h-8 flex-shrink-0" disabled={!!busy} onClick={() => act(`dis:${b.name}`, { action: 'dismiss', email: w.email, name: b.name })}>
                                <Check className="w-3.5 h-3.5 mr-1.5" />Dealt with
                              </Button>
                            ) : <span className="text-xs text-muted-foreground flex-shrink-0">Dealt with</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (newEmail.trim()) void add(newEmail.trim().toLowerCase()); }}>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Add another email address to watch" className="h-11 flex-1 min-w-[220px]" />
              <Button type="submit" className="h-11 px-5" disabled={!newEmail.trim() || !!busy}><Plus className="w-4 h-4 mr-1.5" />Add email</Button>
            </form>
            <p className="text-xs text-muted-foreground">We email a code to each extra address to make sure it&apos;s yours.</p>
          </section>

          {suggestions.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Suggested from your vault</h2>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
                {suggestions.map(([email, n]) => (
                  <div key={email} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{email}</p>
                      <p className="text-xs text-muted-foreground">Used for {n} login{n === 1 ? '' : 's'} in your vault</p>
                    </div>
                    <Button size="sm" variant="secondary" className="h-9" disabled={!!busy} onClick={() => add(email)}>
                      {busy === `add:${email}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Watch'}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">Bank card monitoring isn&apos;t offered: there is no trustworthy public source for leaked card numbers. Your cards stay encrypted in your vault, and you get a reminder before each one expires.</p>
        </>
      )}
    </div>
  );
}
