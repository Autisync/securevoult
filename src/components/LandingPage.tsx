'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Logo, LogoMark } from '@/components/Logo';
import { PublicPricing } from '@/components/PublicPricing';
import {
  ArrowRight, Check, ChevronDown, Fingerprint, Play, ShieldCheck, KeyRound, CreditCard, Landmark,
  StickyNote, Paperclip, UserCircle, Wifi, Smartphone, Globe, Lock, Server, Laptop, X, Menu,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

// ── Small helpers ────────────────────────────────────────────────────────────

/** Fades a block in once it scrolls into view (content is visible without JS). */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'hidden' | 'shown'>('idle');
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setState('hidden');
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState('shown'); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${className} transition-all duration-700 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${state === 'hidden' ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0'}`}
      style={{ transitionDelay: state === 'shown' ? `${delay}ms` : '0ms' }}>
      {children}
    </div>
  );
}

function useTotp() {
  const [code, setCode] = useState('481 203');
  useEffect(() => {
    const id = setInterval(() => {
      const n = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
      setCode(`${n.slice(0, 3)} ${n.slice(3)}`);
    }, 30000);
    return () => clearInterval(id);
  }, []);
  return code;
}

// ── Hero visual: the vault door opens, the vault slides out ─────────────────

function VaultDoor() {
  const code = useTotp();
  return (
    <div className="relative mx-auto w-full max-w-[520px] aspect-square" aria-hidden="true">
      <div className="sv-glow absolute inset-[8%] rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/.35),transparent)] blur-2xl" />

      {/* Door */}
      <div className="sv-door absolute inset-[6%]">
        <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-[0_30px_60px_rgba(0,0,0,.55)]">
          <defs>
            <radialGradient id="door-face" cx="40%" cy="35%" r="75%">
              <stop offset="0" stopColor="#2c2b28" /><stop offset="1" stopColor="#121211" />
            </radialGradient>
            <linearGradient id="door-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--logo-hi)" /><stop offset=".5" stopColor="var(--logo-mid)" /><stop offset="1" stopColor="var(--logo-lo)" />
            </linearGradient>
          </defs>
          <circle cx="200" cy="200" r="196" fill="url(#door-face)" stroke="url(#door-gold)" strokeOpacity=".6" strokeWidth="2" />
          <circle cx="200" cy="200" r="176" fill="none" stroke="#ffffff" strokeOpacity=".05" strokeWidth="1" />
          {/* bolts */}
          {Array.from({ length: 12 }).map((_, i) => (
            <g key={i} transform={`rotate(${i * 30} 200 200)`}>
              <g className="sv-bolt"><rect x="193" y="10" width="14" height="30" rx="7" fill="url(#door-gold)" opacity=".9" /></g>
            </g>
          ))}
          {/* dial */}
          <g className="sv-dial">
            <circle cx="200" cy="200" r="118" fill="#151514" stroke="url(#door-gold)" strokeWidth="3" />
            {Array.from({ length: 60 }).map((_, i) => (
              <line key={i} x1="200" y1={i % 5 === 0 ? 90 : 94} x2="200" y2="100" stroke="var(--logo-mid)" strokeOpacity={i % 5 === 0 ? 0.9 : 0.35}
                strokeWidth={i % 5 === 0 ? 2 : 1} transform={`rotate(${i * 6} 200 200)`} />
            ))}
            {[0, 120, 240].map((a) => (
              <rect key={a} x="196" y="120" width="8" height="46" rx="4" fill="url(#door-gold)" transform={`rotate(${a} 200 200)`} />
            ))}
          </g>
          <circle cx="200" cy="200" r="42" fill="#121211" stroke="url(#door-gold)" strokeOpacity=".5" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><LogoMark px={64} /></div>
      </div>

      {/* What's inside */}
      <div className="sv-card-in absolute right-0 bottom-[4%] w-[68%] min-w-[250px] rounded-2xl border border-white/10 bg-[#171716]/90 backdrop-blur-xl shadow-2xl shadow-black/60 p-3 text-left">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-[11px] font-medium text-stone-400">Your vault</span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Synced</span>
        </div>
        {[
          { icon: KeyRound, name: 'GitHub', sub: 'helio@autisync.com', extra: <span className="font-mono text-[13px] text-[#E9CB82] tabular-nums">{code}</span> },
          { icon: Landmark, name: 'Business account', sub: 'Sort code 40-•• ••', extra: <Lock className="w-3.5 h-3.5 text-stone-500" /> },
          { icon: Paperclip, name: 'Passport scan.pdf', sub: '1.2 MB · encrypted', extra: <Check className="w-3.5 h-3.5 text-emerald-400" /> },
        ].map(({ icon: Icon, name, sub, extra }) => (
          <div key={name} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[.03]">
            <div className="w-8 h-8 rounded-lg bg-[#CDA24C]/12 text-[#E9CB82] flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-stone-100 truncate">{name}</p>
              <p className="text-[11px] text-stone-500 truncate">{sub}</p>
            </div>
            {extra}
          </div>
        ))}
        <div className="mx-2 mt-1 h-0.5 rounded bg-white/5 overflow-hidden"><div className="sv-tick h-full bg-[#CDA24C]/70" /></div>
      </div>
    </div>
  );
}

// ── VSL ──────────────────────────────────────────────────────────────────────

const CHAPTERS = [
  { t: 0, label: 'Why your logins need a vault' },
  { t: 15, label: 'Move in from NordPass' },
  { t: 30, label: 'Autofill, only on the real site' },
  { t: 45, label: 'Windows Hello, two-step sign-in, Recovery Kit' },
  { t: 60, label: 'Leaked passwords, fixed step by step' },
];

function VideoSalesLetter({ onGetStarted }: { onGetStarted: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [missing, setMissing] = useState(false);

  const play = (at?: number) => {
    const v = video.current;
    if (!v) return;
    if (typeof at === 'number') v.currentTime = at;
    v.muted = false;
    void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const active = CHAPTERS.reduce((a, c, i) => (now >= c.t ? i : a), 0);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-6 items-start">
      <div className="relative rounded-[1.25rem] overflow-hidden border border-white/10 bg-black shadow-[0_40px_120px_-30px_rgba(205,162,76,.35)] aspect-video">
        {!missing ? (
          <video
            ref={video}
            className="absolute inset-0 w-full h-full object-cover"
            poster="/media/vsl-poster.jpg"
            preload="metadata"
            playsInline
            controls={playing}
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onEnded={() => setPlaying(false)}
          >
            <source src="/media/securevoult-vsl.mp4" type="video/mp4" />
            <source src="/media/securevoult-vsl.webm" type="video/webm" onError={() => setMissing(true)} />
          </video>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#2a2620,#0d0d0c)]"><LogoMark px={96} /></div>
        )}
        {!playing && !missing && (
          <button type="button" onClick={() => play()} className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/70 via-black/10 to-transparent">
            <span className="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 transition-transform duration-300 group-hover:scale-110">
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" style={{ animationDuration: '2.4s' }} />
              <Play className="relative w-8 h-8 translate-x-0.5" fill="currentColor" />
            </span>
            <span className="text-sm font-medium text-white/90">Watch the 75-second tour</span>
          </button>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground mb-2">In the video</p>
        {CHAPTERS.map((c, i) => (
          <button key={c.t} type="button" onClick={() => play(c.t)}
            className={`w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${playing && i === active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
            <span className="font-mono text-xs pt-0.5 tabular-nums text-primary/80">{`${Math.floor(c.t / 60)}:${String(c.t % 60).padStart(2, '0')}`}</span>
            <span className="text-sm">{c.label}</span>
          </button>
        ))}
        <Button className="w-full mt-3 h-11 font-semibold" onClick={onGetStarted}>Create your vault<ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </div>
  );
}

// ── Feature illustrations (real UI, drawn small) ─────────────────────────────

function AutofillDemo() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground mb-4">
        <Lock className="w-3 h-3 text-emerald-400" />github.com/login
      </div>
      <p className="text-sm font-medium mb-3">Sign in to GitHub</p>
      <div className="relative">
        <div className="h-10 rounded-lg border border-primary/60 ring-2 ring-primary/20 bg-background px-3 flex items-center text-sm">helio@autisync.com</div>
        <div className="absolute left-0 right-6 top-12 z-10 rounded-xl border border-border bg-popover shadow-2xl p-1.5">
          <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2">
            <LogoMark px={18} />
            <div className="flex-1 min-w-0"><p className="text-sm">GitHub</p><p className="text-[11px] text-muted-foreground">helio@autisync.com</p></div>
            <span className="text-[11px] text-primary">Fill</span>
          </div>
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-muted-foreground">Matched to github.com</p>
        </div>
      </div>
      <div className="h-10 rounded-lg border border-border bg-background mt-3" />
      <div className="h-10 rounded-lg bg-emerald-600/80 mt-3" />
    </div>
  );
}

function UnlockDemo() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/20 max-w-sm mx-auto w-full text-center">
      <div className="flex justify-center mb-4"><LogoMark px={40} tile /></div>
      <p className="font-display text-xl mb-1">Unlock your vault</p>
      <p className="text-xs text-muted-foreground mb-5">Welcome back, Helio</p>
      <div className="h-12 rounded-xl border border-primary/40 bg-primary/5 flex items-center justify-center gap-2 text-sm font-medium">
        <Fingerprint className="w-5 h-5 text-primary" />Unlock with Windows Hello
      </div>
      <div className="flex items-center gap-3 my-4 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <div className="h-11 rounded-xl border border-border bg-background" />
      <label className="flex items-center gap-2 mt-4 text-xs text-left text-muted-foreground">
        <span className="w-4 h-4 rounded border border-primary bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-primary-foreground" /></span>
        Keep me unlocked on this device for 30 days
      </label>
    </div>
  );
}

function BreachDemo() {
  const steps = ['Open the site’s password page', 'Generate a new password', 'Save it here'];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 mb-4">
        <ShieldCheck className="w-5 h-5 text-red-400" />
        <div className="flex-1"><p className="text-sm font-medium">3 passwords found in data breaches</p><p className="text-xs text-muted-foreground">Checked privately: only 5 characters of a hash leave your device</p></div>
      </div>
      <div className="flex items-center gap-3 px-1 mb-3">
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-semibold">D</div>
        <div className="flex-1"><p className="text-sm">Dropbox</p><p className="text-[11px] text-muted-foreground">Seen in 2 breaches</p></div>
        <span className="text-xs text-primary">Fix it</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${i < 2 ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>
              {i < 2 ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

const ITEM_TYPES = [
  { icon: KeyRound, label: 'Logins & 2FA codes' },
  { icon: CreditCard, label: 'Payment cards' },
  { icon: Landmark, label: 'Bank accounts' },
  { icon: UserCircle, label: 'Identities' },
  { icon: StickyNote, label: 'Secure notes' },
  { icon: Wifi, label: 'Wi-Fi' },
  { icon: Paperclip, label: 'Files up to 25 MB' },
];

// ── Copy ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Can Autisync see my passwords?',
    a: 'No. Your vault is locked and unlocked on your own device with a key made from your master password (Argon2id, then AES-256-GCM). Our server only ever stores the locked copy, and the master password never leaves your device.',
  },
  {
    q: 'What if I forget my master password?',
    a: 'When you create your vault you get a Recovery Kit with a 32-character recovery key. With it you can set a new master password. Without the master password or the key, nobody can open the vault, including us.',
  },
  {
    q: 'How do I move from NordPass or another manager?',
    a: 'Export a CSV from your current manager and import it in Settings → Import. SecureVoult recognises NordPass, 1Password, Bitwarden, LastPass, Dashlane, Proton Pass, Chrome and Firefox exports, including 2FA secrets, cards and extra web addresses.',
  },
  {
    q: 'Do I have to type my master password every time?',
    a: 'No. Turn on Windows Hello (or Touch ID, or a fingerprint) in Settings → Security, or tick “Keep me unlocked on this device” for up to 30 days on your own computer.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. Each device keeps an encrypted copy, so you can open and copy items without a connection. Changes upload when you are back online and merge item by item with your other devices.',
  },
  {
    q: 'Can I take my data with me?',
    a: 'Any time. Export an encrypted backup or a CSV from Settings. There is no lock-in.',
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const nav = [['Tour', '#tour'], ['Features', '#features'], ['Security', '#security'], ['Pricing', '#pricing'], ['Training', '/training'], ['Partners', '/partners']];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-background/85 backdrop-blur-xl border-b border-border/60' : 'border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="#top" aria-label="SecureVoult home"><Logo size="sm" /></a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            {nav.map(([l, h]) => <a key={h} href={h} className="hover:text-foreground transition-colors">{l}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex h-9" onClick={onSignIn}>Sign in</Button>
            <Button size="sm" className="h-9 px-4 font-semibold" onClick={onGetStarted}>Get started</Button>
            <button type="button" className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary" onClick={() => setMenu((m) => !m)} aria-label="Menu">
              {menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
            {nav.map(([l, h]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-secondary">{l}</a>)}
            <button type="button" onClick={onSignIn} className="block w-full text-left rounded-lg px-3 py-2.5 text-sm hover:bg-secondary">Sign in</button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative">
        <div className="absolute inset-x-0 top-0 h-[720px] pointer-events-none bg-[radial-gradient(60%_50%_at_70%_30%,hsl(var(--primary)/.10),transparent)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-16 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-10 lg:gap-6 items-center">
          <div>
            <p className="sv-rise inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-primary mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />Zero-knowledge, from Autisync
            </p>
            <h1 className="sv-rise font-display text-[2.6rem] leading-[1.04] sm:text-6xl lg:text-[4.4rem] font-normal tracking-[-0.03em] text-balance" style={{ animationDelay: '80ms' }}>
              A private vault for everything you log in with.
            </h1>
            <p className="sv-rise mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed" style={{ animationDelay: '160ms' }}>
              Passwords, 2FA codes, cards, bank details and documents, locked on your device before they ever reach a server. Unlock with Windows Hello. Fill in on the real site, and only there.
            </p>
            <div className="sv-rise mt-8 flex flex-col sm:flex-row gap-3" style={{ animationDelay: '240ms' }}>
              <Button size="lg" className="h-12 px-7 text-base font-semibold shadow-xl shadow-primary/20" onClick={onGetStarted}>
                Create your free vault<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <a href="#tour"><Play className="w-4 h-4 mr-2" />Watch the tour</a>
              </Button>
            </div>
            <p className="sv-rise mt-5 text-sm text-muted-foreground" style={{ animationDelay: '320ms' }}>
              Free for up to 50 items. No card needed. Bring everything from NordPass in two minutes.
            </p>
          </div>
          <VaultDoor />
        </div>

        {/* What it holds */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="flex flex-wrap justify-center gap-2">
            {ITEM_TYPES.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-sm text-muted-foreground">
                <Icon className="w-3.5 h-3.5 text-primary" />{label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Tour / VSL */}
      <section id="tour" className="scroll-mt-20 border-y border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <Reveal className="max-w-2xl mb-10">
            <h2 className="font-display text-4xl sm:text-5xl tracking-[-0.02em] text-balance">See the whole thing in 75 seconds.</h2>
            <p className="mt-4 text-muted-foreground text-lg">From importing your old manager to fixing a leaked password, filmed in the real app.</p>
          </Reveal>
          <Reveal><VideoSalesLetter onGetStarted={onGetStarted} /></Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-24 space-y-28">
        {[
          {
            title: 'Fills in on the real site. Nowhere else.',
            body: 'The browser extension matches each login to its own website, so a look-alike phishing page gets nothing. Save new logins as you sign up, and update them when you change a password.',
            points: ['Chrome, Edge, Brave and other Chromium browsers', '2FA codes filled in right after the password', 'Never offers to fill on pages it shouldn’t'],
            demo: <AutofillDemo />,
          },
          {
            title: 'Your fingerprint, not your master password, all day.',
            body: 'Set up Windows Hello, Touch ID or a fingerprint once per device. Or stay unlocked for up to 30 days on a computer only you use. The master password stays the key to everything, and never leaves your device.',
            points: ['Windows Hello, Touch ID or fingerprint, where your browser supports it', 'Auto-lock after the time you choose', 'Two-step sign-in with any authenticator app'],
            demo: <UnlockDemo />,
          },
          {
            title: 'Finds leaked passwords, then walks you through the fix.',
            body: 'SecureVoult checks every password against known breaches without sending it anywhere, flags weak and reused ones, and takes you to each site’s change-password page with a strong new password ready to go.',
            points: ['Breach, weak, reused and old-password checks', 'Step-by-step fix for each one', 'Password history, so nothing is lost'],
            demo: <BreachDemo />,
          },
        ].map((f, i) => (
          <div key={f.title} className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
            <Reveal>
              <h3 className="font-display text-3xl sm:text-4xl tracking-[-0.02em] leading-tight text-balance">{f.title}</h3>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">{f.body}</p>
              <ul className="mt-6 space-y-2.5">
                {f.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm"><Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />{p}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}>{f.demo}</Reveal>
          </div>
        ))}
      </section>

      {/* Switch */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid md:grid-cols-[minmax(0,1fr)_auto] gap-8 items-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl tracking-[-0.02em]">Moving in takes an afternoon. Usually less.</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl">Export a CSV from your current manager and drop it in. Logins, 2FA secrets, cards, notes and extra web addresses come across. Import twice and nothing is duplicated.</p>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-wrap gap-2 md:max-w-sm md:justify-end">
              {['NordPass', '1Password', 'Bitwarden', 'LastPass', 'Dashlane', 'Proton Pass', 'Chrome', 'Firefox'].map((n) => (
                <span key={n} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">{n}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <Reveal className="max-w-2xl mb-12">
          <h2 className="font-display text-4xl sm:text-5xl tracking-[-0.02em] text-balance">Locked on your device. Stored locked on ours.</h2>
          <p className="mt-4 text-muted-foreground text-lg">Zero-knowledge means the server holds a copy it can’t read. Here is exactly what happens.</p>
        </Reveal>
        <Reveal>
          <div className="grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 md:gap-6 items-stretch">
            <div className="rounded-2xl border border-primary/30 bg-primary/[.04] p-6">
              <p className="flex items-center gap-2 text-sm font-medium mb-5"><Laptop className="w-4 h-4 text-primary" />On your device</p>
              <ol className="space-y-4 text-sm">
                {[
                  ['Master password', 'Typed by you, never sent anywhere'],
                  ['Argon2id · 64 MiB · 3 passes', 'Turns it into a key; every guess costs an attacker memory'],
                  ['AES-256-GCM', 'Locks the vault and each file, and detects any tampering'],
                ].map(([t, d]) => (
                  <li key={t} className="border-l-2 border-primary/50 pl-4">
                    <p className="font-mono text-[13px] text-foreground">{t}</p><p className="text-muted-foreground mt-0.5">{d}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex md:flex-col items-center justify-center gap-2 text-xs text-muted-foreground py-2">
              <span className="h-px w-10 md:h-10 md:w-px bg-border" />
              <span className="rounded-full border border-border px-3 py-1 font-mono">ciphertext only</span>
              <span className="h-px w-10 md:h-10 md:w-px bg-border" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="flex items-center gap-2 text-sm font-medium mb-5"><Server className="w-4 h-4 text-muted-foreground" />On Autisync’s server</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {['A locked vault and locked files it cannot open', 'Your email and sign-in, so you can sync', 'Two-step sign-in secret, itself encrypted', 'A version number, so devices never overwrite each other'].map((x) => (
                  <li key={x} className="flex items-start gap-3"><Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{x}</li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-muted-foreground/80">Not stored: your master password, your recovery key, or any readable vault data.</p>
            </div>
          </div>
        </Reveal>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-border bg-border">
          {[
            { icon: KeyRound, t: 'Recovery Kit', d: 'A printable key that resets your master password. Only you hold it.' },
            { icon: Smartphone, t: 'Two-step sign-in', d: 'Authenticator-app codes and backup codes, built in.' },
            { icon: Globe, t: 'UK GDPR', d: 'Autisync is the data controller. Export or delete your data on request.' },
            { icon: ShieldCheck, t: 'Cyber Essentials', d: 'We are working towards UK Cyber Essentials certification.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="bg-background p-6">
              <Icon className="w-5 h-5 text-primary mb-4" />
              <p className="font-medium">{t}</p>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
          <Reveal className="max-w-3xl mb-14">
            <h2 className="font-display text-4xl sm:text-6xl tracking-[-0.02em] text-balance">How much does SecureVoult cost?</h2>
            <p className="mt-4 text-muted-foreground text-lg">Start free. Pay when your team needs more.</p>
          </Reveal>
          <PublicPricing onChoose={(plan) => {
            if (plan === 'enterprise') { window.location.href = '/partners#quote'; return; }
            onGetStarted();
          }} />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <h2 className="font-display text-4xl tracking-[-0.02em] mb-8">Questions people ask first</h2>
        <div className="divide-y divide-border border-y border-border">
          {FAQS.map((f, i) => (
            <div key={f.q}>
              <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}
                className="w-full flex items-center justify-between gap-4 py-5 text-left">
                <span className="font-medium">{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-all duration-300 ${openFaq === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <p className="overflow-hidden text-muted-foreground leading-relaxed pb-0 [&:not(:empty)]:pb-5">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[radial-gradient(80%_120%_at_50%_0%,hsl(var(--primary)/.16),transparent)] px-6 py-16 text-center">
          <div className="flex justify-center mb-6"><LogoMark px={56} tile /></div>
          <h2 className="font-display text-4xl sm:text-5xl tracking-[-0.02em] text-balance">Keep the keys. Lose the worry.</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">Your vault is ready in under a minute.</p>
          <Button size="lg" className="mt-8 h-12 px-8 text-base font-semibold" onClick={onGetStarted}>Create your free vault<ArrowRight className="w-4 h-4 ml-2" /></Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <div>
            <Logo size="sm" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">The private password manager from Autisync.</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#tour" className="hover:text-foreground">Tour</a></li>
              <li><a href="#security" className="hover:text-foreground">Security</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><a href="/support" className="hover:text-foreground">Support</a></li>
              <li><a href="/training" className="hover:text-foreground">Training videos</a></li>
              <li><a href="/partners" className="hover:text-foreground">Become a partner</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/privacy" className="hover:text-foreground">Privacy policy</a></li>
              <li><a href="/terms" className="hover:text-foreground">Terms of service</a></li>
              <li><a href="/cookies" className="hover:text-foreground">Cookies</a></li>
              <li><a href="/dpa" className="hover:text-foreground">Data processing (business)</a></li>
              <li><a href="/security" className="hover:text-foreground">Security details</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <p className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-muted-foreground">© {new Date().getFullYear()} MAHELDOM CONSULTING, LDA., trading as Autisync. SecureVoult is an Autisync product.</p>
        </div>
      </footer>
    </div>
  );
}
