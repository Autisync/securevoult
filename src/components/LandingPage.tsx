'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import {
  Shield, Lock, Zap, Globe, Smartphone, Chrome, Eye,
  Key, RefreshCw, Users, CheckCircle2, Star, ChevronDown, ArrowRight,
  FileDown, AlertTriangle, ShieldAlert, Cookie, X, ExternalLink,
  Award, BadgeCheck, Server, Wifi, Settings2, UserCheck, Bug, Download,
  Database, Fingerprint, MapPin, Trash2, Info, Monitor, Apple, Laptop,
  TabletSmartphone, Layers, Puzzle,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

// â”€â”€ Scroll reveal hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// â”€â”€ Animated section wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Reveal({
  children,
  className = '',
  direction = 'up',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'left' | 'right' | 'scale';
  delay?: number;
}) {
  const { ref, inView } = useInView();
  const baseClass = direction === 'left' ? 'reveal-left' : direction === 'right' ? 'reveal-right' : direction === 'scale' ? 'reveal-scale' : 'reveal';
  return (
    <div
      ref={ref}
      className={`${baseClass} ${inView ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// â”€â”€ Animated counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView(0.5);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// â”€â”€ Cookie consent banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('sv_cookie_consent');
    if (!consent) setTimeout(() => setVisible(true), 1500);
  }, []);

  const accept = useCallback((all: boolean) => {
    localStorage.setItem('sv_cookie_consent', all ? 'all' : 'essential');
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-fade-up">
      <div className="max-w-5xl mx-auto bg-card border border-border/80 rounded-2xl shadow-2xl p-5 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Cookie className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">We use cookies</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                SecureVoult uses essential cookies to keep you signed in and functional cookies to improve your experience.
                We do <strong>not</strong> sell your data or use advertising cookies.{' '}
                <button onClick={() => setShowDetails(!showDetails)} className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity">
                  {showDetails ? 'Show less' : 'Learn more'}
                </button>
              </p>

              {showDetails && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 animate-fade-up">
                  {[
                    { name: 'Essential', desc: 'Session tokens, CSRF protection, vault state " required for the app to function.', required: true },
                    { name: 'Functional', desc: 'Theme preference, language, UI layout settings " stored locally in your browser.', required: false },
                    { name: 'Analytics', desc: 'Anonymous page view counts via privacy-preserving analytics (no cross-site tracking).', required: false },
                  ].map(c => (
                    <div key={c.name} className="bg-secondary/40 rounded-xl p-3 text-xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-semibold">{c.name}</span>
                        {c.required && <span className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full">Required</span>}
                      </div>
                      <p className="text-muted-foreground">{c.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => accept(false)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Button size="sm" className="h-8 text-xs px-4 bg-primary hover:bg-primary/90" onClick={() => accept(true)}>
            Accept all
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs px-4" onClick={() => accept(false)}>
            Essential only
          </Button>
          <span className="text-xs text-muted-foreground/60">
            Your choices are stored locally and can be changed at any time.
          </span>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FEATURES = [
  {
    icon: Shield,
    title: 'Zero-knowledge encryption',
    description: 'Your master password never leaves your device. All encryption and decryption happens locally in your browser.',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'group-hover:border-primary/30',
  },
  {
    icon: Zap,
    title: 'Instant autofill',
    description: 'Browser extension detects login forms automatically and fills your credentials in one click.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'group-hover:border-yellow-500/30',
  },
  {
    icon: Globe,
    title: 'Works everywhere',
    description: 'Access your vault from any browser, your phone, or the web app. Everything stays in sync.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'group-hover:border-green-500/30',
  },
  {
    icon: Key,
    title: 'Strong password generator',
    description: 'Generate passwords with custom length, symbols, numbers, and uppercase. Never reuse a weak password again.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'group-hover:border-violet-500/30',
  },
  {
    icon: RefreshCw,
    title: 'Security health center',
    description: 'Automatically identifies weak, reused, and outdated passwords " grouped by issue type with one-click fix guidance.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'group-hover:border-orange-500/30',
  },
  {
    icon: AlertTriangle,
    title: 'Breach monitoring',
    description: 'Checks your passwords against known data breaches using HaveIBeenPwned\'s k-anonymity API. Your actual passwords never leave your device.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'group-hover:border-red-500/30',
  },
  {
    icon: FileDown,
    title: 'Import from any manager',
    description: 'Migrate from 1Password, Bitwarden, LastPass, Dashlane, Chrome, or Firefox in minutes. Export encrypted backups anytime.',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'group-hover:border-teal-500/30',
  },
  {
    icon: Users,
    title: 'Vault sharing',
    description: 'Share specific vaults securely with team members, with granular read/write permissions.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'group-hover:border-pink-500/30',
  },
];

const SECURITY_POINTS = [
  'AES-256-GCM encryption " the same standard used by governments and banks',
  'Argon2id key derivation (64 MiB of memory per guess), making brute force attacks impractical',
  'Your master password is never transmitted, stored, or logged by any server',
  'All vault data is encrypted before it ever leaves your device',
  'Open architecture " the security model can be audited by anyone',
];

const GDPR_RIGHTS = [
  { icon: Eye,         title: 'Right to access',     desc: 'Download a full copy of your personal data at any time from Settings â†’ Export.' },
  { icon: Trash2,      title: 'Right to erasure',     desc: 'Delete your account and all associated data permanently " one click, immediate effect.' },
  { icon: Download,    title: 'Data portability',     desc: 'Export your encrypted vault in open JSON or plain CSV format " never locked in.' },
  { icon: Settings2,   title: 'Right to rectification', desc: 'Update or correct any of your personal data directly inside the app.' },
  { icon: Info,        title: 'Right to object',      desc: 'Opt out of any optional analytics or functional cookies via our cookie preferences.' },
  { icon: Lock,        title: 'Privacy by design',    desc: 'Zero-knowledge architecture means we technically cannot access your vault data by design.' },
];

const CYBER_ESSENTIALS_CONTROLS = [
  {
    icon: Wifi,
    title: 'Boundary firewalls & gateways',
    desc: 'All network traffic entering and leaving our infrastructure is filtered through managed firewalls. Internet-facing services are restricted to necessary ports and protocols only.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Settings2,
    title: 'Secure configuration',
    desc: 'All servers and devices are configured using hardened baselines. Default passwords are changed, unnecessary software is removed, and unused features are disabled.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: UserCheck,
    title: 'User access control',
    desc: 'Principle of least privilege enforced across all systems. Multi-factor authentication required for all administrator access. User accounts reviewed regularly.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Bug,
    title: 'Malware protection',
    desc: 'Anti-malware software deployed on all servers and workstations. Real-time scanning, regular definition updates, and email attachment filtering in place.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Download,
    title: 'Security update management',
    desc: 'Critical security patches applied within 14 days of release. Automated patch management for OS and application software. Unsupported software is not used in production.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
];

const FAQS = [
  {
    q: 'What happens if I forget my master password?',
    a: 'Because of zero-knowledge encryption, we cannot recover your master password. We recommend storing it in a safe place or using a memorable but strong passphrase. Use the Recovery Kit feature in Settings to print an emergency backup sheet.',
  },
  {
    q: 'Is my data stored on your servers?',
    a: 'Your vault is stored encrypted on our servers for sync purposes. The encryption happens entirely on your device " the server only ever sees ciphertext that cannot be decrypted without your master password.',
  },
  {
    q: 'Can I use SecureVoult offline?',
    a: 'Yes. Your vault is cached locally in your browser. You can read and copy entries without an internet connection. Changes sync when you reconnect.',
  },
  {
    q: 'Is SecureVoult GDPR compliant?',
    a: 'Yes. SecureVoult is built with GDPR compliance by design. We apply data minimisation, purpose limitation, and privacy by default. You can export, correct, or permanently delete all your data at any time. We never sell personal data to third parties.',
  },
  {
    q: 'What is Cyber Essentials and why does it matter?',
    a: 'Cyber Essentials is a UK Government-backed certification scheme that helps organisations protect against the most common cyber threats. It covers five technical controls: firewalls, secure configuration, access control, malware protection, and patch management. Cyber Essentials Plus includes a hands-on technical audit by an accredited assessor.',
  },
  {
    q: 'How is SecureVoult different from other password managers?',
    a: 'SecureVoult is built with a modern, clean interface that prioritises simplicity and privacy. It is cross-platform, has a built-in security analyser, and supports team vault sharing " without the bloat of legacy tools.',
  },
  {
    q: 'Can I import my passwords from another manager?',
    a: 'Yes. SecureVoult supports importing from CSV exports from 1Password, Bitwarden, LastPass, Dashlane, Chrome, Firefox, and any password manager that can export to a standard CSV format.',
  },
  {
    q: 'What encryption does SecureVoult use?',
    a: 'SecureVoult uses AES-256-GCM for encryption and Argon2id (64 MiB, 3 passes) to turn your master password into a key. Argon2id won the Password Hashing Competition and is what OWASP recommends: every guess costs an attacker real memory, which makes GPU cracking slow and expensive.',
  },
  {
    q: 'Can I export my data if I want to leave?',
    a: 'Yes, always. You own your data. You can export an encrypted JSON backup or a plain CSV at any time from Settings â†’ Import/Export. We believe in no lock-in.',
  },
];

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FAQ({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-foreground transition-colors group"
      >
        <span className="font-medium text-sm group-hover:text-primary transition-colors">{question}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-primary' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* â”€â”€ Nav â”€â”€ */}
      <nav className={`sticky top-0 z-50 border-b transition-all duration-300 ${navScrolled ? 'border-border/60 bg-background/95 backdrop-blur-xl shadow-lg shadow-black/10' : 'border-border/30 bg-background/70 backdrop-blur-md'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security</a>
            <a href="#compliance" className="hover:text-foreground transition-colors">Compliance</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#roadmap" className="hover:text-foreground transition-colors">Roadmap</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground" onClick={onSignIn}>
              Sign in
            </Button>
            <Button size="sm" className="h-9 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-200" onClick={onGetStarted}>
              Get started free
            </Button>
          </div>
        </div>
      </nav>

      {/* â”€â”€ Hero â”€â”€ */}
      <section className="relative pt-24 pb-20 px-6 text-center overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-3xl pointer-events-none animate-float-slow" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-amber-500/6 rounded-full blur-3xl pointer-events-none animate-float" style={{ animationDelay: '-2s' }} />
        <div className="absolute top-10 right-1/4 w-[250px] h-[250px] bg-primary/5 rounded-full blur-3xl pointer-events-none animate-float" style={{ animationDelay: '-4s' }} />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />

        <div className="relative max-w-3xl mx-auto animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium mb-6 animate-pulse-glow">
            <Lock className="w-3 h-3" />
            End-to-end encrypted Â· Zero-knowledge
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Passwords you can
            <span
              className="bg-gradient-to-r from-primary via-amber-300 to-primary bg-clip-text text-transparent animate-gradient-shift"
              style={{ backgroundSize: '200% auto' }}
            > actually trust</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed animate-fade-up" style={{ animationDelay: '100ms' }}>
            SecureVoult keeps all your passwords encrypted, organised, and accessible " on every device, in every browser.
            Your data stays yours, always.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap animate-fade-up" style={{ animationDelay: '200ms' }}>
            <Button
              size="lg"
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-base shadow-xl shadow-primary/25 hover:shadow-primary/45 hover:scale-105 transition-all duration-200"
              onClick={onGetStarted}
            >
              Get started free <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base hover:scale-105 transition-transform duration-200" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4 animate-fade-up" style={{ animationDelay: '300ms' }}>No credit card required. Free forever for personal use.</p>
        </div>

        {/* Stats row */}
        <div className="relative max-w-3xl mx-auto mt-14 grid grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: '350ms' }}>
          {[
            { value: 10000, suffix: '+', label: 'Passwords protected' },
            { value: 256,   suffix: '-bit', label: 'AES encryption' },
            { value: 64,    suffix: ' MiB', label: 'Argon2id memory per guess' },
          ].map(({ value, suffix, label }) => (
            <div key={label} className="bg-card/50 border border-border/50 rounded-xl py-4 px-3 hover:border-primary/30 hover:bg-card/80 transition-all duration-300">
              <div className="text-2xl font-bold text-foreground">
                <AnimatedCounter target={value} suffix={suffix} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Trust bar */}
        <div className="relative max-w-4xl mx-auto mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: '400ms' }}>
          {[
            { icon: Shield,      label: 'AES-256-GCM' },
            { icon: Lock,        label: 'Zero knowledge' },
            { icon: Globe,       label: 'Cross-platform' },
            { icon: BadgeCheck,  label: 'GDPR compliant' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2 bg-card/50 border border-border/50 rounded-xl py-3 px-4 hover:border-primary/30 hover:bg-card/70 transition-all duration-300 group">
              <Icon className="w-4 h-4 text-primary/70 flex-shrink-0 group-hover:text-primary transition-colors" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ Features â”€â”€ */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Everything a password manager should be</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Built around privacy and usability, without the legacy complexity.</p>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, description, color, bg, border }, i) => (
              <Reveal key={title} delay={i * 60} direction="up">
                <div className={`group bg-card border border-border rounded-2xl p-6 hover:border-border/80 ${border} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 h-full`}>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ Breach monitoring â”€â”€ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <Reveal direction="left">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-red-500/20 transition-colors duration-500">
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">How breach monitoring works</p>
              {[
                { step: '1', label: 'Your password is hashed locally',    note: 'SHA-1 · runs entirely in your browser' },
                { step: '2', label: 'Only the first 5 characters are sent', note: 'k-anonymity " the API never sees your full hash' },
                { step: '3', label: 'Matching hashes are returned',       note: 'Thousands of possibilities " yours is anonymous' },
                { step: '4', label: 'Result compared locally',            note: 'Breach status computed on your device only' },
              ].map(({ step, label, note }, i) => (
                <div key={step} className="flex items-start gap-3 group" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-red-400 group-hover:bg-red-500/25 transition-colors">{step}</div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal direction="right">
            <div className="inline-flex items-center gap-2 text-xs text-red-400 font-medium mb-4">
              <ShieldAlert className="w-3.5 h-3.5" />Breach monitoring
            </div>
            <h2 className="text-3xl font-bold mb-4 leading-tight">Know when your passwords have been compromised</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Data breaches happen constantly. SecureVoult automatically checks your passwords against the HaveIBeenPwned database " without ever exposing your actual passwords " and alerts you immediately.
            </p>
            <ul className="space-y-3">
              {[
                'Checks run entirely on your device " no passwords are sent over the network',
                'Uses k-anonymity: only a 5-character hash prefix is transmitted',
                'Background scan runs automatically every time you unlock your vault',
                'Instant alert if a breach is detected " with a direct link to fix it',
              ].map((point, i) => (
                <li key={point} className="flex items-start gap-2.5 text-sm group">
                  <CheckCircle2 className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* â”€â”€ Import / Export â”€â”€ */}
      <section className="py-20 px-6 bg-card">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-xs text-teal-400 font-medium mb-4">
              <FileDown className="w-3.5 h-3.5" />Import &amp; export
            </div>
            <h2 className="text-3xl font-bold mb-3">Switch in minutes, not hours</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Moving from another password manager? Import your existing passwords in one step and keep all your data intact.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: FileDown, color: 'text-teal-400', bg: 'bg-teal-500/10',
                title: 'Import from anywhere',
                body: 'Upload a CSV from any password manager. SecureVoult previews your data, lets you map columns, detects duplicates, and merges safely into your encrypted vault.',
                tags: ['1Password', 'Bitwarden', 'LastPass', 'Dashlane', 'Chrome', 'Firefox', 'Safari', 'Any CSV'],
              },
              {
                icon: Shield, color: 'text-primary', bg: 'bg-primary/10',
                title: 'Export with confidence',
                body: 'Download your encrypted vault backup at any time " your data is always yours. Plain CSV export is also available for migration, with a clear security warning.',
                tags: ['Encrypted .json', 'Plain CSV', 'Recovery kit'],
              },
            ].map(({ icon: Icon, color, bg, title, body, tags }, i) => (
              <Reveal key={title} direction={i === 0 ? 'left' : 'right'}>
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-border/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 h-full">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(name => (
                      <span key={name} className="text-xs px-2.5 py-1 bg-secondary/60 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-default">{name}</span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ Security model â”€â”€ */}
      <section id="security" className="py-20 px-6 bg-card">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <Reveal direction="left">
            <div className="inline-flex items-center gap-2 text-xs text-primary font-medium mb-4">
              <Shield className="w-3.5 h-3.5" />Security model
            </div>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Designed so that even we can't read your passwords
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Zero-knowledge means your master password never leaves your device. We store only encrypted ciphertext " mathematically impossible to read without your key.
            </p>
            <ul className="space-y-3">
              {SECURITY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm group">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal direction="right">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-primary/20 transition-colors duration-500">
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Encryption flow</p>
              {[
                { step: '1', label: 'You enter your master password', note: 'Never stored or sent anywhere' },
                { step: '2', label: 'Argon2id derives an encryption key', note: '64 MiB · 3 passes' },
                { step: '3', label: 'Vault is encrypted with AES-256-GCM', note: 'Locally, in your browser' },
                { step: '4', label: 'Ciphertext syncs to server', note: 'Server cannot decrypt it' },
              ].map(({ step, label, note }) => (
                <div key={step} className="flex items-start gap-3 group">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary group-hover:bg-primary/25 transition-colors">{step}</div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* â”€â”€ GDPR compliance â”€â”€ */}
      <section id="compliance" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs text-green-400 font-medium mb-4">
              <BadgeCheck className="w-3.5 h-3.5" />GDPR compliance
            </div>
            <h2 className="text-3xl font-bold mb-3">Built for GDPR from the ground up</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              SecureVoult is designed with privacy as a first principle " not as an afterthought. Our zero-knowledge architecture means GDPR compliance is structural, not procedural.
            </p>
          </Reveal>

          {/* GDPR rights grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {GDPR_RIGHTS.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80} direction="scale">
                <div className="group bg-card border border-border rounded-2xl p-6 hover:border-green-500/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 h-full">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="font-semibold mb-2 text-sm">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* GDPR data facts banner */}
          <Reveal>
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 grid md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-green-500/15">
              {[
                {
                  icon: MapPin,
                  title: 'Data location',
                  items: ['Vault data encrypted before leaving your device', 'Servers within EU/EEA data centres', 'No cross-border data transfers to third countries'],
                },
                {
                  icon: Database,
                  title: 'What we store',
                  items: ['Encrypted vault ciphertext only', 'Your email address (for account recovery)', 'No master passwords, no plaintext data'],
                },
                {
                  icon: Fingerprint,
                  title: 'Data processing',
                  items: ['Minimal data collected for account operation', 'No profiling, no advertising, no data sales', 'DPA available on request for enterprise'],
                },
              ].map(({ icon: Icon, title, items }, i) => (
                <div key={title} className={`${i > 0 ? 'pt-6 md:pt-0 md:pl-6' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold">{title}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* â”€â”€ Cyber Essentials â”€â”€ */}
      <section className="py-20 px-6 bg-card">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs text-primary font-medium mb-4">
              <Award className="w-3.5 h-3.5" />Cyber Essentials
            </div>
            <h2 className="text-3xl font-bold mb-3">UK Government-backed cyber security certification</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              SecureVoult is aligned with all five Cyber Essentials technical controls. The scheme is backed by the UK National Cyber Security Centre (NCSC) and provides assurance that fundamental cyber hygiene is in place.
            </p>
          </Reveal>

          {/* Certification levels */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {[
              {
                level: 'Cyber Essentials',
                tag: 'Foundation level',
                desc: 'Self-assessed questionnaire verified by an accredited certification body. Confirms that the five key technical controls are in place to protect against the most common internet-based cyber threats.',
                color: 'border-primary/40 bg-primary/5',
                badge: 'bg-primary/15 text-primary',
                icon: Shield,
                points: ['Self-assessed against IASME Consortium standard', 'Verified by NCSC-approved certification body', 'Renewed annually to reflect current configurations', 'Required for UK Government contracts handling sensitive data'],
              },
              {
                level: 'Cyber Essentials Plus',
                tag: 'Enhanced level',
                desc: 'All of Cyber Essentials plus an independent, hands-on technical verification by an accredited assessor. Includes internal and external vulnerability scanning and authenticated testing of devices.',
                color: 'border-violet-500/40 bg-violet-500/5',
                badge: 'bg-violet-500/15 text-violet-400',
                icon: BadgeCheck,
                points: ['Independent technical audit by accredited assessor', 'Internal and external vulnerability scanning', 'Authenticated device configuration testing', 'Highest assurance level in the CE scheme'],
              },
            ].map(({ level, tag, desc, color, badge, icon: Icon, points }, i) => (
              <Reveal key={level} direction={i === 0 ? 'left' : 'right'}>
                <div className={`border rounded-2xl p-6 h-full hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 ${color}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-foreground" />
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge}`}>{tag}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{level}</h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{desc}</p>
                  <ul className="space-y-2">
                    {points.map(p => (
                      <li key={p} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-foreground/60 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Five controls */}
          <Reveal className="mb-6">
            <h3 className="text-xl font-bold text-center mb-2">The five technical controls</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto">
              These controls protect against approximately 80% of cyber attacks according to the NCSC.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {CYBER_ESSENTIALS_CONTROLS.map(({ icon: Icon, title, desc, color, bg }, i) => (
              <Reveal key={title} delay={i * 80} direction="up">
                <div className="group bg-card border border-border rounded-2xl p-5 hover:border-border/80 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 h-full">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-4.5 h-4.5 ${color}`} />
                  </div>
                  <div className="text-xs font-bold text-muted-foreground/50 mb-1">Control {i + 1}</div>
                  <h4 className="font-semibold text-sm mb-2 leading-snug">{title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* NCSC attribution */}
          <Reveal className="mt-8">
            <div className="bg-card/50 border border-border/50 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cyber Essentials is a UK Government-backed scheme managed by the{' '}
                <strong className="text-foreground">National Cyber Security Centre (NCSC)</strong> and delivered through the IASME Consortium.
                Certification is renewed annually. For enterprise customers, a copy of our current certificate is available on request.
                <a href="https://www.ncsc.gov.uk/cyberessentials/overview" target="_blank" rel="noopener noreferrer" className="ml-1 text-primary underline underline-offset-2 hover:opacity-80 transition-opacity inline-flex items-center gap-0.5">
                  Learn more <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* -- Platforms -- */}
      <section id="platforms" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">One vault. Every platform.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              SecureVoult is built to work on every device and every browser you already use — with a single encrypted vault synced in real time across all of them.
            </p>
          </Reveal>

          {/* Web */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Reveal direction="scale" className="md:col-span-3">
              <div className="group bg-card border border-primary/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">Web application</h3>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-500/15 text-green-400">Live now</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    The full-featured vault dashboard. Manage, search, organise, and generate passwords — accessible instantly from any browser at <span className="text-primary font-medium">app.securevoult.co.uk</span>. No install required. Zero-knowledge encryption runs entirely in your browser.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  {['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'].map(b => (
                    <span key={b} className="text-xs px-2.5 py-1 bg-secondary/60 rounded-lg text-muted-foreground">{b}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Desktop */}
          <Reveal className="mb-3">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Desktop app</span>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              {
                icon: Monitor,
                title: 'Windows',
                sub: 'Windows 10 / 11',
                description: 'Native Windows desktop app with system tray integration, Windows Hello biometric unlock, and offline vault access. Packaged as a standard NSIS installer or portable .exe.',
                badge: 'In development',
                badgeColor: 'bg-yellow-500/15 text-yellow-400',
                tech: 'Electron · NSIS installer · Portable .exe',
                color: 'text-primary', bg: 'bg-primary/10', hover: 'hover:border-primary/25',
              },
              {
                icon: Apple,
                title: 'macOS',
                sub: 'macOS 12 Monterey+',
                description: 'Native macOS app distributed via .dmg. Supports Touch ID and Apple Silicon (M1/M2/M3). Menu bar integration for quick vault access without opening the full app. Mac App Store release planned.',
                badge: 'In development',
                badgeColor: 'bg-yellow-500/15 text-yellow-400',
                tech: 'Electron — DMG — Mac App Store release planned',
                color: 'text-foreground/70', bg: 'bg-foreground/5', hover: 'hover:border-border/80',
              },
              {
                icon: Laptop,
                title: 'Linux',
                sub: 'Ubuntu · Debian · Fedora · Arch',
                description: 'Universal Linux build distributed as AppImage (runs without install), .deb for Debian/Ubuntu, and .rpm for Fedora/RHEL. Also available via Snap and Flatpak.',
                badge: 'In development',
                badgeColor: 'bg-yellow-500/15 text-yellow-400',
                tech: 'Electron · AppImage · .deb · .rpm',
                color: 'text-orange-400', bg: 'bg-orange-500/10', hover: 'hover:border-orange-500/25',
              },
            ].map(({ icon: Icon, title, sub, description, badge, badgeColor, tech, color, bg, hover }, i) => (
              <Reveal key={title} delay={i * 80} direction="up">
                <div className={`group bg-card border border-border rounded-2xl p-6 ${hover} hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 h-full flex flex-col`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badgeColor}`}>{badge}</span>
                  </div>
                  <h3 className="font-semibold mb-0.5">{title}</h3>
                  <p className="text-xs text-muted-foreground/60 mb-3">{sub}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{description}</p>
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground/50 font-mono mb-3">{tech}</p>
                    <a
                      href="mailto:waitlist@securevoult.co.uk?subject=Desktop%20App%20Waitlist"
                      className="w-full h-8 text-xs inline-flex items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all duration-200"
                    >
                      Get notified when it ships
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Mobile */}
          <Reveal className="mb-3">
            <div className="flex items-center gap-2 mb-4">
              <TabletSmartphone className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Mobile app</span>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {[
              {
                icon: Smartphone,
                title: 'iOS',
                sub: 'iPhone · iPad · iOS 16+',
                description: 'Native iOS app built with React Native and Expo. Face ID and Touch ID unlock, autofill extension for Safari and third-party apps, and offline vault access with encrypted local storage.',
                badge: 'In development',
                badgeColor: 'bg-yellow-500/15 text-yellow-400',
                features: ['Face ID / Touch ID unlock', 'iOS autofill extension', 'iPad optimised layout', 'Offline vault access'],
                tech: 'React Native — Expo — TestFlight beta coming',
                color: 'text-primary', bg: 'bg-primary/10', hover: 'hover:border-primary/30',
              },
              {
                icon: Smartphone,
                title: 'Android',
                sub: 'Android 10+ · Phones and Tablets',
                description: 'Native Android app with biometric authentication (fingerprint, face), Android autofill service integration, and adaptive icon. APK sideload for beta testers; Play Store release planned.',
                badge: 'In development',
                badgeColor: 'bg-yellow-500/15 text-yellow-400',
                features: ['Fingerprint / face unlock', 'Android Autofill Service', 'Adaptive icons', 'Beta APK sideload'],
                tech: 'React Native — Expo — Play Store release planned',
                color: 'text-green-400', bg: 'bg-green-500/10', hover: 'hover:border-green-500/25',
              },
            ].map(({ icon: Icon, title, sub, description, badge, badgeColor, features, tech, color, bg, hover }, i) => (
              <Reveal key={title} delay={i * 80} direction={i === 0 ? 'left' : 'right'}>
                <div className={`group bg-card border border-border rounded-2xl p-6 ${hover} hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 h-full flex flex-col`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badgeColor}`}>{badge}</span>
                  </div>
                  <h3 className="font-semibold mb-0.5">{title}</h3>
                  <p className="text-xs text-muted-foreground/60 mb-3">{sub}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-1.5">
                    {features.map(feat => (
                      <div key={feat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />{feat}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground/50 font-mono mb-3">{tech}</p>
                    <a
                      href="mailto:waitlist@securevoult.co.uk?subject=Mobile%20App%20Waitlist"
                      className="w-full h-8 text-xs inline-flex items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all duration-200"
                    >
                      Get notified when it ships
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Browser extensions */}
          <Reveal className="mb-3">
            <div className="flex items-center gap-2 mb-4">
              <Puzzle className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Browser extension</span>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { name: 'Chrome',  status: 'Beta',           color: 'bg-primary/15 text-primary',          note: 'MV3 — manual install' },
              { name: 'Edge',    status: 'Beta',           color: 'bg-primary/15 text-primary',          note: 'MV3 — manual install' },
              { name: 'Brave',   status: 'Beta',           color: 'bg-primary/15 text-primary',          note: 'MV3 — manual install' },
              { name: 'Opera',   status: 'Beta',           color: 'bg-primary/15 text-primary',          note: 'MV3 — manual install' },
              { name: 'Firefox', status: 'In development', color: 'bg-yellow-500/15 text-yellow-400',      note: 'MV2 — not yet submitted' },
              { name: 'Safari',  status: 'Planned',        color: 'bg-secondary/60 text-muted-foreground', note: 'Safari Web Extension' },
            ].map(({ name, status, color, note }, i) => (
              <Reveal key={name} delay={i * 50} direction="scale">
                <div className="group bg-card border border-border rounded-xl p-4 text-center hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 transition-all duration-300">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                    <Chrome className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-xs font-semibold mb-1">{name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>{status}</span>
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5 leading-tight">{note}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Extension features strip */}
          <Reveal>
            <div className="bg-card/50 border border-border/50 rounded-2xl p-5 grid md:grid-cols-4 gap-4">
              {[
                { icon: Zap,         label: 'Instant autofill',   desc: 'Detects login forms on any site and fills credentials in one click.' },
                { icon: Key,         label: 'Password generator', desc: 'Generate strong passwords right in the browser without opening the app.' },
                { icon: ShieldAlert, label: 'Breach alerts',      desc: 'Warns you inline when a saved password appears in a known data breach.' },
                { icon: Lock,        label: 'Keyboard shortcut',  desc: 'Ctrl+Shift+F / Cmd+Shift+F fills the current page instantly.' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-0.5">{label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Extension beta install note */}
          <Reveal>
            <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-primary mb-0.5">Try the beta extension now</p>
                <p className="text-xs text-muted-foreground">
                  Chrome, Edge, Brave &amp; Opera — load unpacked in developer mode. No store install needed.
                  See <code className="text-primary/70 font-mono">extension-package/INSTALL.md</code> for full instructions.
                </p>
              </div>
              <a
                href="mailto:waitlist@securevoult.co.uk?subject=Extension%20Beta%20Feedback"
                className="h-8 px-4 text-xs flex-shrink-0 inline-flex items-center rounded-lg border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors whitespace-nowrap"
              >
                Send beta feedback
              </a>
            </div>
          </Reveal>
        </div>
      </section>


      {/* -- Roadmap -- */}
      <section id="roadmap" className="py-16 px-6 bg-card">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-xs text-primary/80 font-medium mb-4">
              <Layers className="w-3.5 h-3.5" />Product roadmap
            </div>
            <h2 className="text-2xl font-bold mb-2">Where things stand today</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">Honest status of every platform. Updated as things ship.</p>
          </Reveal>
          <div className="space-y-2">
            {[
              { label: 'Web application',          status: 'Live',           detail: 'Full vault, autofill, breach monitoring, import/export',          sc: 'bg-green-500/15 text-green-400',           dc: 'bg-green-400' },
              { label: 'Browser extension (beta)', status: 'Beta',           detail: 'Chrome, Edge, Brave, Opera — manual install; store submission not yet started', sc: 'bg-primary/15 text-primary',   dc: 'bg-primary' },
              { label: 'iOS app',                  status: 'In development', detail: 'React Native + Expo — biometrics, autofill, offline vault',        sc: 'bg-yellow-500/15 text-yellow-400',          dc: 'bg-yellow-400' },
              { label: 'Android app',              status: 'In development', detail: 'React Native + Expo — fingerprint/face unlock, autofill service',  sc: 'bg-yellow-500/15 text-yellow-400',          dc: 'bg-yellow-400' },
              { label: 'Desktop (Win/Mac/Linux)',   status: 'In development', detail: 'Electron — NSIS, DMG, AppImage — system tray + biometric unlock',  sc: 'bg-yellow-500/15 text-yellow-400',          dc: 'bg-yellow-400' },
              { label: 'Firefox extension',        status: 'In development', detail: 'MV2 manifest — Firefox Add-ons store submission not yet started',          sc: 'bg-yellow-500/15 text-yellow-400',          dc: 'bg-yellow-400' },
              { label: 'Safari extension',         status: 'Planned',        detail: 'Requires macOS app wrapper via xcrun',                             sc: 'bg-secondary/60 text-muted-foreground',     dc: 'bg-muted-foreground/30' },
              { label: 'Company plan',            status: 'In development', detail: 'Company admin UI built; billing activation pending — admin panel, breach monitoring, audit logs', sc: 'bg-yellow-500/15 text-yellow-400', dc: 'bg-yellow-400' },
              { label: 'Enterprise / SSO',         status: 'Planned',        detail: 'SAML / OIDC, SCIM provisioning, custom SLAs',                     sc: 'bg-secondary/60 text-muted-foreground',     dc: 'bg-muted-foreground/30' },
              { label: 'Passkeys (WebAuthn)',       status: 'In development', detail: 'Passwordless vault unlock via platform authenticator — Pro+ beta', sc: 'bg-yellow-500/15 text-yellow-400',          dc: 'bg-yellow-400' },
            ].map(({ label, status, detail, sc, dc }, i) => (
              <Reveal key={label} delay={i * 30}>
                <div className="flex items-center gap-4 bg-card/60 border border-border/50 rounded-xl px-5 py-3 hover:border-border hover:bg-card/80 transition-all duration-200">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dc}`} />
                  <span className="text-sm font-medium w-48 flex-shrink-0">{label}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${sc}`}>{status}</span>
                  <p className="text-xs text-muted-foreground flex-1 hidden sm:block">{detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -- Pricing -- */}
      <section id="pricing" className="py-20 px-6 bg-card">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl font-bold mb-3">Simple, honest pricing</h2>
            <p className="text-muted-foreground mb-4">Start free. Upgrade when your team needs more.</p>
            <div className="inline-flex items-center gap-2 text-xs mb-10 flex-wrap justify-center">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Free — live now
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />Pro — in development
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />Company — planned
              </span>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: 'Free',
                price: '\u00A30',
                period: 'forever',
                description: 'For personal use',
                features: ['Unlimited passwords', 'Browser extension', 'Password generator', 'Security centre', 'Encrypted backup', 'GDPR data export'],
                cta: 'Get started',
                highlight: false,
              },
              {
                name: 'Pro',
                price: '\u00A36',
                period: 'per month',
                description: 'For power users',
                features: ['Unlimited vault entries', 'Passkeys / biometric login', 'Full exposure intelligence', 'Mobile app — in development', 'Advanced security reports', 'Priority support'],
                cta: 'Coming soon',
                highlight: true,
              },
              {
                name: 'Company',
                price: '\u00A38',
                period: 'per user / month',
                description: 'For teams that take security seriously',
                features: ['Everything in Pro, per user', 'Company admin dashboard', 'Team breach monitoring', 'Incident tracking', 'Audit logs', 'Security policy enforcement'],
                cta: 'Coming soon',
                highlight: false,
              },
            ].map(({ name, price, period, description, features, cta, highlight }, i) => (
              <Reveal key={name} delay={i * 100} direction="scale">
                <div className={`bg-card border rounded-2xl p-6 text-left hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 h-full ${highlight ? 'border-primary/50 ring-1 ring-primary/20 shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30'}`}>
                  {highlight && (
                    <div className="text-xs font-medium text-primary mb-3 flex items-center gap-1">
                      <Star className="w-3 h-3" />Most popular
                    </div>
                  )}
                  <p className="font-bold text-lg">{name}</p>
                  <div className="flex items-baseline gap-1 mt-1 mb-1">
                    <span className="text-3xl font-bold">{price}</span>
                    <span className="text-xs text-muted-foreground">{period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-5">{description}</p>
                  <ul className="space-y-2 mb-6">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full h-9 transition-all duration-200 ${highlight ? 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105' : 'bg-secondary hover:bg-secondary/80 text-foreground'}`}
                    onClick={name === 'Free' ? onGetStarted : undefined}
                    disabled={name !== 'Free'}
                  >
                    {cta}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Plan-to-platform table */}
          <Reveal>
            <div className="mt-10 overflow-x-auto">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-muted-foreground/60 font-medium w-40">Platform / feature</th>
                    {['Free', 'Pro', 'Company'].map(p => (
                      <th key={p} className="py-2 px-3 text-center text-muted-foreground/60 font-medium">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Web app',                 free: '\u2713 Live',       pro: '\u2713 Live',            biz: '\u2713 Live' },
                    { label: 'Browser extension',       free: '\u2713 Beta',       pro: '\u2713 Beta + sync',     biz: '\u2713 Beta + sync' },
                    { label: 'Mobile app',              free: '\u2014',            pro: '\u23f3 In development',  biz: '\u23f3 In development' },
                    { label: 'Desktop app',             free: '\u2014',            pro: '\u23f3 In development',  biz: '\u23f3 In development' },
                    { label: 'Passkeys / biometrics',   free: '\u2014',            pro: '\u2713 Live (Pro+)',      biz: '\u2713 Live' },
                    { label: 'Breach monitoring',       free: '\u2713 Live',       pro: '\u2713 Live',            biz: '\u2713 Live' },
                    { label: 'Exposure intelligence',   free: '\u2014',            pro: '\u2713 Live',            biz: '\u2713 Live' },
                    { label: 'Company admin panel',     free: '\u2014',            pro: '\u2014',                 biz: '\u2713 Live' },
                    { label: 'Audit logs',              free: '\u2014',            pro: '\u2014',                 biz: '\u2713 Live' },
                    { label: 'SSO / SAML',              free: '\u2014',            pro: '\u2014',                 biz: 'Enterprise only' },
                  ].map(({ label, free, pro, biz }, i) => (
                    <tr key={label} className={i % 2 === 0 ? 'bg-card/30' : ''}>
                      <td className="py-2 px-3 text-muted-foreground font-medium rounded-l-lg">{label}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground/70">{free}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground/70">{pro}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground/70 rounded-r-lg">{biz}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground/40 mt-3 text-right">\u23f3 In development \u2014 available to early access users when launched</p>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="text-3xl font-bold">Frequently asked questions</h2>
          </Reveal>
          <Reveal>
            <div className="bg-card border border-border rounded-2xl px-6">
              {FAQS.map(({ q, a }) => <FAQ key={q} question={q} answer={a} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* -- CTA -- */}
      <section className="py-20 px-6 bg-gradient-to-b from-[hsl(var(--card))] to-background">
        <Reveal className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center mx-auto mb-6 animate-pulse-glow-violet">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-3">Start protecting your passwords today</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join thousands of users who have moved from sticky notes and browser-saved passwords to a secure, private vault.
          </p>
          <Button
            size="lg"
            className="h-12 px-10 bg-primary hover:bg-primary/90 text-base shadow-xl shadow-primary/25 hover:shadow-primary/45 hover:scale-105 transition-all duration-200"
            onClick={onGetStarted}
          >
            Create your free vault <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Reveal>
      </section>

      {/* -- Trust strip -- */}
      <div className="border-t border-border/30 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-center">
          <p className="text-xs text-muted-foreground/40 font-medium tracking-wide uppercase">Legal &amp; compliance</p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            {[
              { label: 'Privacy Policy',      href: '/privacy' },
              { label: 'Security Disclosure', href: '/security' },
              { label: 'Terms of Service',    href: '/terms' },
              { label: 'Cookie Policy',       href: '/cookies' },
              { label: 'DPA (GDPR Art. 28)',  href: '/dpa' },
            ].map(({ label, href }) => (
              <a key={label} href={href} className="text-xs text-muted-foreground/50 hover:text-primary transition-colors">{label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* -- Footer -- */}
      <footer className="border-t border-border/40 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Logo size="sm" />
              <p className="text-xs text-muted-foreground/60 mt-3 max-w-xs leading-relaxed">
                Zero-knowledge password manager built with privacy by design.
                Your master password never leaves your device.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {[
                  { label: 'GDPR Compliant',    color: 'bg-green-500/10 text-green-400 border border-green-500/20' },
                  { label: 'Cyber Essentials',  color: 'bg-primary/10 text-primary border border-primary/20' },
                  { label: 'AES-256 Encrypted', color: 'bg-primary/10 text-primary border border-primary/20' },
                ].map(({ label, color }) => (
                  <span key={label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${color}`}>{label}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Product</p>
              <ul className="space-y-2 text-xs text-muted-foreground/70">
                {[
                  { label: 'Features',    href: '/#features' },
                  { label: 'Security',    href: '/#security' },
                  { label: 'Pricing',     href: '/#pricing' },
                  { label: 'Roadmap',     href: '/#roadmap' },
                  { label: 'Platforms',   href: '/#platforms' },
                  { label: 'Compliance',  href: '/#compliance' },
                ].map(({ label, href }) => (
                  <li key={label}><a href={href} className="hover:text-foreground transition-colors">{label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Legal &amp; Privacy</p>
              <ul className="space-y-2 text-xs text-muted-foreground/70">
                {[
                  { label: 'Privacy Policy',             href: '/privacy' },
                  { label: 'Terms of Service',           href: '/terms' },
                  { label: 'Cookie Policy',              href: '/cookies' },
                  { label: 'Data Processing Agreement',  href: '/dpa' },
                  { label: 'Security disclosure',        href: '/security' },
                ].map(({ label, href }) => (
                  <li key={label}><a href={href} className="hover:text-foreground transition-colors">{label}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-border/40 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground/50">
              © {new Date().getFullYear()} SecureVoult Ltd. Your passwords, your privacy.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
              <span>Privacy-first</span>
              <span>·</span>
              <span>Zero knowledge</span>
              <span>·</span>
              <span>Open architecture</span>
              <span>·</span>
              <button
                onClick={() => { localStorage.removeItem('sv_cookie_consent'); window.location.reload(); }}
                className="hover:text-muted-foreground transition-colors"
              >
                Cookie settings
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* -- GDPR Cookie consent banner -- */}
      <CookieConsent />
    </div>
  );
}
