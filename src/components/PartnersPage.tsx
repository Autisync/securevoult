'use client';

import { useEffect, useState } from 'react';
import { Handshake, Server, Building2, Languages, ShieldCheck, ScanSearch, IdCard, LayoutDashboard, Loader2, Check, ArrowRight } from 'lucide-react';
import { SiteShell } from '@/components/SiteShell';
import { LEGAL } from '@/lib/legal';

const KINDS = [
  { icon: Building2, title: 'IT support companies', body: 'Add password management to the support you already give your clients, and manage their teams from one place.' },
  { icon: Handshake, title: 'Resellers and distributors', body: 'Sell SecureVoult in your market, in Portuguese or English, with a margin on every seat you bring.' },
  { icon: Server, title: 'Companies that must keep data in-house', body: 'Banks, clinics, law firms and public bodies can run SecureVoult on their own server, inside their own network.' },
];

const WHY = [
  { icon: ShieldCheck, title: 'Zero-knowledge by design', body: 'Vaults are encrypted on each person\'s device. Not even the server, yours or ours, can read them.' },
  { icon: LayoutDashboard, title: 'A log the client can read', body: 'Every sign-in and change with IP, device and country, and an email the moment something serious happens.' },
  { icon: ScanSearch, title: 'Breach alerts', body: 'Email addresses checked against known data breaches every day, with clear steps for what to change.' },
  { icon: IdCard, title: 'More than passwords', body: 'ID documents with photos and expiry reminders, cards, notes and contact info, all in the same vault.' },
  { icon: Languages, title: 'Local, human support', body: 'A team in the UK, Portugal and Angola, in English and Portuguese, on the same time zones as your clients.' },
  { icon: Server, title: 'Your server or ours', body: 'Start on our servers in minutes, or move to a self-hosted install when a client needs it.' },
];

const STEPS = [
  ['Tell us about you', 'Fill in the form below. We reply within two working days.'],
  ['See it working', 'A short call and a demo account for you to try with your own team first.'],
  ['Bring your first client', 'We help set up their company, invite their staff and import their old passwords.'],
  ['Grow from there', 'One contact at Autisync for billing, questions and anything a client asks you.'],
];

export function PartnersPage() {
  const [kind, setKind] = useState<'partner' | 'quote'>('partner');
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', country: '', seats: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  // /partners#quote (from the pricing table) opens the form on "Enterprise quote".
  useEffect(() => {
    if (window.location.hash === '#quote') { setKind('quote'); document.getElementById('contact')?.scrollIntoView(); }
  }, []);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending'); setError('');
    try {
      const res = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, kind }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Something went wrong.');
      setState('sent');
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); setState('error'); }
  };

  const input = 'w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <SiteShell>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 grid gap-12 lg:grid-cols-[1.1fr_1fr] items-center">
        <div>
          <h1 className="font-display text-[2.5rem] sm:text-6xl leading-[1.04] tracking-[-0.03em] text-balance">Offer your clients a password manager they&apos;ll actually use</h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">Partner with Autisync to sell, set up and support SecureVoult for the businesses you look after, on our servers or theirs.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#contact" onClick={() => setKind('partner')} className="inline-flex h-12 items-center gap-2 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">Become a partner<ArrowRight className="w-4 h-4" /></a>
            <a href="#contact" onClick={() => setKind('quote')} className="inline-flex h-12 items-center px-6 rounded-xl border border-border hover:bg-secondary font-semibold">Get an Enterprise quote</a>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <p className="text-sm font-semibold text-muted-foreground">Who we work with</p>
          <ul className="mt-5 space-y-5">
            {KINDS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span>
                <div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-28">
        <h2 className="font-display text-4xl sm:text-5xl tracking-[-0.02em] text-balance max-w-2xl">Why your clients will say yes</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <Icon className="w-6 h-6 text-primary" />
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-28">
        <h2 className="font-display text-4xl sm:text-5xl tracking-[-0.02em]">How it works</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="relative pt-6 border-t-2 border-primary/60">
              <span className="absolute -top-4 left-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">{i + 1}</span>
              <p className="font-semibold mt-2">{t}</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="contact" className="scroll-mt-24 max-w-6xl mx-auto px-4 sm:px-6 mt-28">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-display text-4xl tracking-[-0.02em]">Let&apos;s talk</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">Tell us a little about you and your clients. We reply within two working days, in English or Portuguese.</p>
            <p className="mt-6 text-sm text-muted-foreground">Prefer email? <span className="text-foreground font-medium select-all">{LEGAL.email}</span></p>
          </div>

          {state === 'sent' ? (
            <div className="rounded-2xl bg-primary/10 border border-primary/30 p-8 flex flex-col items-start justify-center">
              <span className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="w-6 h-6" /></span>
              <p className="mt-4 text-xl font-semibold">Thanks, {form.name.split(' ')[0] || 'we got it'}.</p>
              <p className="mt-2 text-muted-foreground">We&apos;ll be in touch at {form.email} within two working days.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 inline-flex p-1 rounded-xl border border-border bg-background w-fit" role="radiogroup" aria-label="Enquiry type">
                {([['partner', 'Become a partner'], ['quote', 'Enterprise quote']] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                    className={`h-9 px-4 rounded-lg text-sm font-semibold ${kind === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
                ))}
              </div>
              <label className="grid gap-1.5 text-sm font-medium">Full name *<input className={input} value={form.name} onChange={set('name')} required autoComplete="name" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Work email *<input className={input} type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Company *<input className={input} value={form.company} onChange={set('company')} required autoComplete="organization" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Phone <span className="sr-only">(optional)</span><input className={input} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="Optional" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Country
                <select className={input} value={form.country} onChange={set('country')}>
                  <option value="">Choose…</option>
                  {['Angola', 'Portugal', 'United Kingdom', 'Mozambique', 'Cabo Verde', 'Brazil', 'Other'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">{kind === 'quote' ? 'How many people?' : 'Clients you look after'}
                <select className={input} value={form.seats} onChange={set('seats')}>
                  <option value="">Choose…</option>
                  {(kind === 'quote' ? ['Under 50', '50 to 200', '200 to 1,000', 'Over 1,000'] : ['1 to 10', '10 to 50', '50 to 200', 'Over 200']).map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2 grid gap-1.5 text-sm font-medium">Message
                <textarea className={`${input} h-28 py-3 resize-none`} value={form.message} onChange={set('message')} maxLength={2000}
                  placeholder={kind === 'quote' ? 'Self-hosted or on our servers? Anything your IT or compliance team needs to see?' : 'Who are your clients, and how do you work with them today?'} />
              </label>
              {/* Bots fill this; people never see it. */}
              <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} aria-hidden="true" />
              {state === 'error' && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                <button type="submit" disabled={state === 'sending'} className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 inline-flex items-center gap-2">
                  {state === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}Send
                </button>
                <p className="text-xs text-muted-foreground">We use these details only to reply to you. See our <a href="/privacy" className="underline">privacy policy</a>.</p>
              </div>
            </form>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
