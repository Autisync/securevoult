'use client';

import { useEffect, useState } from 'react';
import { Play, X, Clock, ArrowRight, BookOpen, LayoutDashboard, KeyRound, ScanSearch, IdCard, Users } from 'lucide-react';
import { SiteShell } from '@/components/SiteShell';
import { LogoMark } from '@/components/Logo';
import { LESSONS, TOPICS, type Audience, type Lesson, type Topic } from '@/lib/training';

/** The cover of a lesson: drawn, not an image file, so every new lesson gets one for free. */
function Cover({ lesson, big = false }: { lesson: Lesson; big?: boolean }) {
  const ready = !!lesson.youtube;
  return (
    <div className={`relative aspect-video rounded-2xl overflow-hidden bg-[#141311] border border-border/60 ${big ? '' : 'group-hover:border-primary/50'} transition-colors`}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,hsl(var(--primary)/.22),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(135deg,#fff_0_1px,transparent_1px_14px)]" />
      <div className="absolute left-4 top-3.5 flex items-center gap-1.5 text-[11px] font-semibold text-white/80"><LogoMark px={16} />SecureVoult</div>
      <p className="absolute left-4 right-14 bottom-3.5 font-display text-[1.35rem] leading-[1.1] text-white text-balance">{lesson.title}</p>
      <span className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform ${ready ? 'bg-primary text-primary-foreground group-hover:scale-110' : 'bg-white/10 text-white/60'}`}>
        <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
      </span>
    </div>
  );
}

export function TrainingPage() {
  const [audience, setAudience] = useState<Audience>('employees');
  const [topic, setTopic] = useState<Topic>('start');
  const [playing, setPlaying] = useState<Lesson | null>(null);
  const lessons = LESSONS.filter((l) => l.audience === audience && l.topic === topic);
  const ready = LESSONS.filter((l) => l.youtube).length;

  useEffect(() => { setTopic(TOPICS[audience][0].id); }, [audience]);
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlaying(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  return (
    <SiteShell>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 grid gap-12 lg:grid-cols-[1.05fr_1fr] items-center">
        <div>
          <h1 className="font-display text-[2.5rem] sm:text-6xl leading-[1.04] tracking-[-0.03em] text-balance">Training videos for your team</h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Short guides, one task each: the screen, a clear voice, nothing else. For the people who use SecureVoult every day, and for whoever runs it for the company.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/#tour" className="inline-flex h-12 items-center gap-2 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90"><Play className="w-4 h-4" fill="currentColor" />Watch the full tour</a>
            <a href="/#/signin" className="inline-flex h-12 items-center px-6 rounded-xl border border-border hover:bg-secondary font-semibold">Start free</a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">75 seconds · no card needed to start</p>
        </div>
        {/* What's covered, as the app's own menu */}
        <div className="relative">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,.8)]">
            <p className="text-sm font-semibold mb-4">What the videos cover</p>
            <ul className="grid gap-2">
              {[
                [KeyRound, 'Passwords, autofill and passkeys'],
                [IdCard, 'Documents with photos and reminders'],
                [ScanSearch, 'Data breach scanner and password health'],
                [Users, 'Inviting the team'],
                [LayoutDashboard, 'Admin console and security log'],
              ].map(([Icon, t]) => {
                const I = Icon as React.ElementType;
                return <li key={t as string} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3.5 py-3 text-sm"><span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><I className="w-4 h-4" /></span>{t as string}</li>;
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Library */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-24">
        <div className="flex flex-col items-center gap-6">
          <div className="inline-flex p-1 rounded-2xl border border-border bg-card" role="tablist" aria-label="Who the videos are for">
            {([['employees', 'For employees'], ['admins', 'For IT admins']] as const).map(([a, l]) => (
              <button key={a} role="tab" aria-selected={audience === a} onClick={() => setAudience(a)}
                className={`h-11 px-5 rounded-xl text-sm font-semibold transition-colors ${audience === a ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto max-w-full no-scrollbar" role="tablist" aria-label="Topic">
            {TOPICS[audience].map((t) => (
              <button key={t.id} role="tab" aria-selected={topic === t.id} onClick={() => setTopic(t.id)}
                className={`h-10 px-4 text-sm whitespace-nowrap border-b-2 transition-colors ${topic === t.id ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {lessons.map((l) => (
            <article key={l.id} className="group">
              <button onClick={() => l.youtube && setPlaying(l)} disabled={!l.youtube} className="block w-full text-left disabled:cursor-default" aria-label={l.youtube ? `Play: ${l.title}` : `${l.title}, coming soon`}>
                <Cover lesson={l} />
              </button>
              <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md bg-secondary text-muted-foreground">
                <Clock className="w-3 h-3" />Video · {l.minutes} minute{l.minutes === 1 ? '' : 's'}{!l.youtube && <span className="text-primary"> · coming soon</span>}
              </p>
              <h3 className="mt-3 font-semibold leading-snug">{l.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{l.summary}</p>
            </article>
          ))}
        </div>
        {ready === 0 && <p className="mt-10 text-center text-sm text-muted-foreground">The first videos are being recorded. Until then, the <a href="/support" className="text-primary hover:underline">help pages</a> cover every step in writing.</p>}
      </section>

      {/* Written guide */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-24">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 grid gap-8 md:grid-cols-[auto_1fr] items-center">
          <span className="w-20 h-20 rounded-2xl bg-primary/15 text-primary flex items-center justify-center"><BookOpen className="w-9 h-9" /></span>
          <div>
            <p className="inline-block text-[11px] font-bold px-2 py-1 rounded-md bg-primary text-primary-foreground">Quick guide</p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">Prefer reading? The help pages</h2>
            <p className="mt-2 text-muted-foreground max-w-2xl">Forgotten master password, quick unlock, moving from another manager, sync and the extension: every common question answered in plain steps.</p>
            <a href="/support" className="mt-4 inline-flex items-center gap-2 font-semibold text-primary hover:underline underline-offset-4">Open the help pages <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-24 text-center">
        <h2 className="font-display text-4xl sm:text-5xl tracking-[-0.02em] text-balance">Don&apos;t have SecureVoult yet?</h2>
        <p className="mt-4 text-muted-foreground text-lg">Breach alerts, a security log and expiry reminders for your whole team.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="/#/signin" className="inline-flex h-12 items-center px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">Start free</a>
          <a href="/partners#quote" className="inline-flex h-12 items-center px-6 rounded-xl border border-border hover:bg-secondary font-semibold">Get a quote</a>
        </div>
      </section>

      {playing && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={playing.title} onClick={() => setPlaying(null)}>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 text-white">
              <p className="font-semibold">{playing.title}</p>
              <button onClick={() => setPlaying(null)} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="aspect-video rounded-2xl overflow-hidden bg-black">
              <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playing.youtube)}?autoplay=1&rel=0&modestbranding=1`}
                title={playing.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}
