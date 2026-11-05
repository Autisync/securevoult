'use client';

import { Fragment, useState } from 'react';
import { Check, Minus, Shield, Zap, Building2, Server, Users, ArrowRight, BadgeCheck } from 'lucide-react';
import { PLAN_LIMITS, PLAN_PRICING, getYearlyDiscount, type PlanId, type BillingCycle } from '@/lib/plans';

type Audience = 'personal' | 'business';
type Cell = boolean | string;

interface Card {
  plan: PlanId;
  name: string;
  tagline: string;
  icon: React.ElementType;
  popular?: boolean;
  seats: string;
  cta: string;
  includesFrom?: string;
  bullets: string[];
}

const fmtMB = (mb: number) => (mb < 0 ? 'Unlimited' : mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`);
const watched = (p: PlanId) => { const n = PLAN_LIMITS[p].maxMonitoredEmails; return n < 0 ? 'Up to 25' : String(n); };
const items = (p: PlanId) => { const n = PLAN_LIMITS[p].maxEntries; return n < 0 ? 'Unlimited' : String(n); };

const CARDS: Record<Audience, Card[]> = {
  personal: [
    {
      plan: 'free', name: 'Free', tagline: 'The essentials, for one person', icon: Shield, seats: '1 user', cta: 'Get started',
      bullets: [`${items('free')} items`, 'Browser extension with autofill', 'Leaked-password check', 'Two-step sign-in', `${fmtMB(PLAN_LIMITS.free.fileStorageMB)} of encrypted files`, 'Email masking'],
    },
    {
      plan: 'pro', name: 'Pro', tagline: 'Everything, for one person', icon: Zap, popular: true, seats: '1 user', cta: 'Choose Pro', includesFrom: 'Free',
      bullets: ['Unlimited items', 'Passkey sign-in to SecureVoult', `Data breach scanner for ${watched('pro')} email addresses`, `${fmtMB(PLAN_LIMITS.pro.fileStorageMB)} of encrypted files`, 'Session control on every device', 'Priority support'],
    },
  ],
  business: [
    {
      plan: 'company', name: 'Company', tagline: 'Secure password management for your team', icon: Building2, popular: true, seats: 'Per user, any team size', cta: 'Start with Company', includesFrom: 'Pro',
      bullets: ['Admin console for the whole team', 'Security log with email alerts', 'Team invites by email', 'End any team member\'s session', `Breach scanner: ${watched('company').toLowerCase()} addresses each`, `${fmtMB(PLAN_LIMITS.company.fileStorageMB)} of encrypted files per user`],
    },
    {
      plan: 'enterprise', name: 'Enterprise', tagline: 'Runs on your own server', icon: Server, seats: 'For larger or regulated teams', cta: 'Get a quote', includesFrom: 'Company',
      bullets: ['Self-hosted inside your network', 'Your own sign-in provider', 'Unlimited encrypted file storage', 'Named contact and onboarding', 'Help with security reviews', 'SSO and SCIM (in development)'],
    },
  ],
};

const COMPARE: { section: string; rows: { label: string; hint?: string; cells: Record<PlanId, Cell> }[] }[] = [
  {
    section: 'Security',
    rows: [
      { label: 'Zero-knowledge encryption', hint: 'AES-256-GCM, key made from your master password with Argon2id', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Two-step sign-in', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Recovery Kit', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Password generator', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Password health', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Leaked-password check', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Data breach scanner', hint: 'Email addresses watched daily', cells: { free: watched('free'), pro: watched('pro'), company: watched('company'), enterprise: watched('enterprise') } },
      { label: 'Email masking', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Passkey sign-in to SecureVoult', cells: { free: false, pro: true, company: true, enterprise: true } },
    ],
  },
  {
    section: 'Everyday use',
    rows: [
      { label: 'Vault items', cells: { free: items('free'), pro: items('pro'), company: items('company'), enterprise: items('enterprise') } },
      { label: 'Encrypted file storage', cells: { free: fmtMB(PLAN_LIMITS.free.fileStorageMB), pro: fmtMB(PLAN_LIMITS.pro.fileStorageMB), company: fmtMB(PLAN_LIMITS.company.fileStorageMB), enterprise: fmtMB(PLAN_LIMITS.enterprise.fileStorageMB) } },
      { label: 'Browser extension with autofill', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Website passkeys saved in your vault', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Documents with expiry reminders', hint: 'ID card, driving licence, passport, with photos', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Cards, notes, contact info, bank accounts', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Import from NordPass, 1Password, Bitwarden, browsers', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Trash: restore deleted items for 30 days', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Works offline', cells: { free: true, pro: true, company: true, enterprise: true } },
    ],
  },
  {
    section: 'Team and admin',
    rows: [
      { label: 'Admin console', cells: { free: false, pro: false, company: true, enterprise: true } },
      { label: 'Security log with email alerts', hint: 'Every sign-in and change, with IP, device and country', cells: { free: false, pro: false, company: true, enterprise: true } },
      { label: 'Team invites by email', cells: { free: false, pro: false, company: true, enterprise: true } },
      { label: 'End sessions across the team', cells: { free: false, pro: false, company: true, enterprise: true } },
      { label: 'Self-hosting on your own server', cells: { free: false, pro: false, company: false, enterprise: true } },
      { label: 'SSO and SCIM', cells: { free: false, pro: false, company: false, enterprise: 'In development' } },
    ],
  },
  {
    section: 'Support',
    rows: [
      { label: 'Email support from people in the UK, Portugal and Angola', cells: { free: true, pro: true, company: true, enterprise: true } },
      { label: 'Priority support', cells: { free: false, pro: true, company: true, enterprise: true } },
      { label: 'Onboarding and a named contact', cells: { free: false, pro: false, company: false, enterprise: true } },
    ],
  },
];

function price(plan: PlanId, cycle: BillingCycle) {
  const p = PLAN_PRICING[plan];
  if (p.custom) return null;
  const v = cycle === 'yearly' ? p.yearly / 12 : p.monthly;
  return { value: v, text: v === 0 ? '0' : v % 1 === 0 ? String(v) : v.toFixed(2), perUser: !!p.perUser, yearly: p.yearly };
}

function CellMark({ v }: { v: Cell }) {
  if (v === true) return <span className="inline-flex w-6 h-6 rounded-full bg-primary/15 text-primary items-center justify-center" aria-label="Included"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>;
  if (v === false) return <Minus className="w-4 h-4 text-muted-foreground/40 mx-auto" aria-label="Not included" />;
  return <span className="text-sm text-foreground/90">{v}</span>;
}

/** The public pricing: Personal or Business plans, yearly or monthly, then every feature side by side. */
export function PublicPricing({ onChoose }: { onChoose: (plan: PlanId) => void }) {
  const [audience, setAudience] = useState<Audience>('business');
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const cards = CARDS[audience];
  const plans = cards.map((c) => c.plan);
  const maxSave = Math.max(...cards.map((c) => getYearlyDiscount(c.plan)));

  return (
    <div className="space-y-20">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Choose your plan */}
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold tracking-tight">Choose your plan</h3>
          <div className="inline-flex p-1 rounded-2xl border border-border bg-card" role="tablist" aria-label="Plan type">
            {(['business', 'personal'] as const).map((a) => (
              <button key={a} role="tab" aria-selected={audience === a} onClick={() => setAudience(a)}
                className={`h-11 px-5 rounded-xl text-sm font-semibold transition-colors ${audience === a ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                {a === 'business' ? 'Business' : 'Personal'}
              </button>
            ))}
          </div>
          <fieldset className="space-y-3">
            <legend className="sr-only">Billing</legend>
            {(['yearly', 'monthly'] as const).map((c) => (
              <label key={c} className="flex items-center gap-3 cursor-pointer text-sm">
                <input type="radio" name="cycle" className="peer sr-only" checked={cycle === c} onChange={() => setCycle(c)} />
                <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/50 peer-checked:border-primary peer-checked:border-[6px] transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
                <span className={cycle === c ? 'text-foreground' : 'text-muted-foreground'}>
                  {c === 'yearly' ? <>Yearly plan{maxSave > 0 && <span className="ml-1.5 text-primary font-medium">(save up to {maxSave}%)</span>}</> : 'Monthly plan'}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground leading-relaxed">Prices in pounds. Cancel any time and keep your data: export it whenever you like.</p>
        </div>

        {/* Plan cards */}
        <div className={`grid gap-5 sm:grid-cols-2 ${audience === 'personal' ? 'xl:grid-cols-3' : 'xl:grid-cols-3'}`}>
          {cards.map((c) => {
            const pr = price(c.plan, cycle);
            const save = cycle === 'yearly' ? getYearlyDiscount(c.plan) : 0;
            const Icon = c.icon;
            return (
              <div key={c.plan} className={`relative flex flex-col rounded-3xl p-6 border ${c.popular ? 'border-primary/60 bg-gradient-to-b from-primary/[0.14] to-primary/[0.04] shadow-[0_20px_60px_-30px_hsl(var(--primary)/0.6)]' : 'border-border bg-card'}`}>
                {c.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Most popular</span>}
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-5 h-5 ${c.popular ? 'text-primary' : 'text-foreground/80'}`} />
                  <h4 className="text-xl font-semibold">{c.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{c.tagline}</p>

                <div className="mt-5 min-h-[92px]">
                  {save > 0 && <span className="inline-block mb-2 px-2 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-bold">Save {save}%</span>}
                  {pr ? (
                    <>
                      <p className="flex items-start gap-1">
                        <span className="text-lg font-semibold mt-1.5">£</span>
                        <span className="text-5xl font-bold tracking-tight tabular-nums">{pr.text}</span>
                        <span className="self-end mb-1.5 text-sm text-muted-foreground ml-1">{pr.value === 0 ? 'forever' : pr.perUser ? 'per user/month' : '/month'}</span>
                      </p>
                      {pr.value > 0 && cycle === 'yearly' && <p className="text-xs text-muted-foreground mt-1">£{pr.yearly}{pr.perUser ? ' per user' : ''}, billed yearly</p>}
                    </>
                  ) : (
                    <>
                      <p className="text-4xl font-bold tracking-tight pt-1">Custom</p>
                      <p className="text-xs text-muted-foreground mt-2">Priced for your seats and setup</p>
                    </>
                  )}
                </div>

                <p className="flex items-center gap-2 text-sm text-muted-foreground mt-3"><Users className="w-4 h-4" />{c.seats}</p>

                <button onClick={() => onChoose(c.plan)}
                  className={`mt-5 h-12 rounded-xl font-semibold text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${c.popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground text-background hover:bg-foreground/90'}`}>
                  {c.cta}
                </button>

                <div className="mt-6 pt-5 border-t border-border/60 flex-1">
                  {c.includesFrom && <p className="text-sm font-semibold mb-3">Everything in {c.includesFrom}, plus:</p>}
                  <ul className="space-y-2.5">
                    {c.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm">
                        <span className={`mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 ${c.popular ? 'bg-primary text-primary-foreground' : 'bg-foreground/90 text-background'}`}><Check className="w-3 h-3" strokeWidth={3} /></span>
                        <span className={c.popular ? 'text-foreground' : 'text-foreground/85'}>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}

          {/* Third column: the way across to the other audience */}
          <div className="flex flex-col justify-between gap-6 rounded-3xl border border-dashed border-border p-6 sm:col-span-2 xl:col-span-1 xl:self-start">
            <div>
              <BadgeCheck className="w-6 h-6 text-primary" />
              <h4 className="text-lg font-semibold mt-3">{audience === 'business' ? 'Just for you?' : 'For your team?'}</h4>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {audience === 'business'
                  ? 'Personal plans start free and cover one person, with the same encryption and the same apps.'
                  : 'Company adds an admin console, a security log with alerts and team invites. Enterprise runs on your own server.'}
              </p>
            </div>
            <button onClick={() => setAudience(audience === 'business' ? 'personal' : 'business')} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4">
              See {audience === 'business' ? 'personal' : 'business'} plans <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Compare all features */}
      <div>
        <h3 className="text-3xl font-semibold tracking-tight text-center">Compare all features</h3>
        <div className="mt-8 overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[340px] border-collapse">
            <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
              <tr>
                <th className="w-[46%] sm:w-[44%] text-left py-4" />
                {cards.map((c) => (
                  <th key={c.plan} className="py-4 px-2 text-center align-bottom">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <button onClick={() => onChoose(c.plan)} className={`mt-2 min-h-9 py-1.5 px-2 w-full max-w-[160px] rounded-lg text-xs sm:text-sm font-semibold leading-tight ${c.popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground text-background hover:bg-foreground/90'}`}>{c.cta}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((g) => {
                const rows = g.rows.filter((r) => plans.some((p) => r.cells[p] !== false));
                if (!rows.length) return null;
                return (
                  <Fragment key={g.section}>
                    <tr><td colSpan={plans.length + 1} className="pt-10 pb-3 text-lg font-semibold">{g.section}</td></tr>
                    {rows.map((r) => (
                      <tr key={r.label} className="border-t border-border/60">
                        <td className="py-3.5 pr-4 text-sm">
                          {r.label}
                          {r.hint && <span className="block text-xs text-muted-foreground mt-0.5">{r.hint}</span>}
                        </td>
                        {plans.map((p) => <td key={p} className="py-3.5 px-2 text-center"><CellMark v={r.cells[p]} /></td>)}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/[0.16] to-transparent p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
        <span className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center flex-shrink-0 leading-none">
          <span className="text-2xl font-bold">14</span><span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">days</span>
        </span>
        <div>
          <p className="text-xl font-semibold">14-day money-back guarantee</p>
          <p className="text-sm text-muted-foreground mt-1">Buying for yourself? Change your mind within 14 days of your first paid subscription and get a full refund. Your vault stays yours either way.</p>
        </div>
      </div>
    </div>
  );
}
