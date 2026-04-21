import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const landing = `'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import {
  Shield, Lock, Zap, Globe, Smartphone, Chrome, Eye, EyeOff,
  Key, RefreshCw, Users, CheckCircle2, Star, ChevronDown, ArrowRight
} from 'lucide-react';
import { useState } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const FEATURES = [
  {
    icon: Shield,
    title: 'Zero-knowledge encryption',
    description: 'Your master password never leaves your device. All encryption and decryption happens locally in your browser.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Zap,
    title: 'Instant autofill',
    description: 'Browser extension detects login forms automatically and fills your credentials in one click.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: Globe,
    title: 'Works everywhere',
    description: 'Access your vault from any browser, your phone, or the web app. Everything stays in sync.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Key,
    title: 'Strong password generator',
    description: 'Generate passwords with custom length, symbols, numbers, and uppercase. Never reuse a weak password again.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: RefreshCw,
    title: 'Security health center',
    description: 'Automatically identifies weak, reused, and outdated passwords and helps you fix them.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Users,
    title: 'Vault sharing',
    description: 'Share specific vaults securely with team members, with granular read/write permissions.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
];

const SECURITY_POINTS = [
  'AES-256-GCM encryption — the same standard used by governments and banks',
  'PBKDF2 key derivation with 100,000 rounds — making brute force attacks infeasible',
  'Your master password is never transmitted, stored, or logged by any server',
  'All vault data is encrypted before it ever leaves your device',
  'Open architecture — the security model can be audited by anyone',
];

const FAQS = [
  {
    q: 'What happens if I forget my master password?',
    a: 'Because of zero-knowledge encryption, we cannot recover your master password. We recommend storing it in a safe place or using a memorable but strong passphrase. A recovery kit feature is planned for a future release.',
  },
  {
    q: 'Is my data stored on your servers?',
    a: 'Your vault is stored encrypted on our servers for sync purposes. The encryption happens entirely on your device — the server only ever sees ciphertext that cannot be decrypted without your master password.',
  },
  {
    q: 'Can I use SecureVoult offline?',
    a: 'Yes. Your vault is cached locally in your browser. You can read and copy entries without an internet connection. Changes sync when you reconnect.',
  },
  {
    q: 'How is SecureVoult different from other password managers?',
    a: 'SecureVoult is built with a modern, clean interface that prioritizes simplicity and privacy. It is cross-platform, has a built-in security analyzer, and supports team vault sharing — without the bloat of legacy tools.',
  },
  {
    q: 'Can I import my passwords from another manager?',
    a: 'Yes. SecureVoult supports importing from CSV exports from 1Password, Bitwarden, LastPass, Dashlane, Chrome, Firefox, and any password manager that can export to a standard CSV format.',
  },
];

function FAQ({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-foreground transition-colors"
      >
        <span className="font-medium text-sm">{question}</span>
        <ChevronDown className={\`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform \${open ? 'rotate-180' : ''}\`} />
      </button>
      {open && <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{answer}</p>}
    </div>
  );
}

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground" onClick={onSignIn}>
              Sign in
            </Button>
            <Button size="sm" className="h-9 bg-primary hover:bg-primary/90" onClick={onGetStarted}>
              Get started free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium mb-6">
            <Lock className="w-3 h-3" />
            End-to-end encrypted · Zero-knowledge
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Passwords you can
            <span className="text-gradient bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent"> actually trust</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            SecureVoult keeps all your passwords encrypted, organized, and accessible — on every device, in every browser.
            Your data stays yours, always.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" className="h-12 px-8 bg-primary hover:bg-primary/90 text-base" onClick={onGetStarted}>
              Get started free <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4">No credit card required. Free forever for personal use.</p>
        </div>

        {/* Trust bar */}
        <div className="relative max-w-3xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Shield, label: 'AES-256-GCM' },
            { icon: Lock, label: 'Zero knowledge' },
            { icon: Globe, label: 'Cross-platform' },
            { icon: Eye, label: 'Open architecture' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2 bg-card/50 border border-border/50 rounded-xl py-3 px-4">
              <Icon className="w-4 h-4 text-primary/70 flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Everything a password manager should be</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Built around privacy and usability, without the legacy complexity.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description, color, bg }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-6 hover:border-border/80 transition-colors">
                <div className={\`w-10 h-10 rounded-xl \${bg} flex items-center justify-center mb-4\`}>
                  <Icon className={\`w-5 h-5 \${color}\`} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 px-6 bg-[hsl(222_40%_7%)]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-primary font-medium mb-4">
              <Shield className="w-3.5 h-3.5" />Security model
            </div>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Designed so that even we can't read your passwords
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Zero-knowledge means your master password never leaves your device. We store only encrypted ciphertext — mathematically impossible to read without your key.
            </p>
            <ul className="space-y-3">
              {SECURITY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Encryption flow</p>
            {[
              { step: '1', label: 'You enter your master password', note: 'Never stored or sent anywhere' },
              { step: '2', label: 'PBKDF2 derives an encryption key', note: '100,000 iterations · SHA-256' },
              { step: '3', label: 'Vault is encrypted with AES-256-GCM', note: 'Locally, in your browser' },
              { step: '4', label: 'Ciphertext syncs to server', note: 'Server cannot decrypt it' },
            ].map(({ step, label, note }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">{step}</div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">Available on every platform</h2>
          <p className="text-muted-foreground mb-12 max-w-lg mx-auto">
            One vault, everywhere. Web app, browser extension, and mobile — all in sync.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Globe, title: 'Web app', description: 'Full-featured vault dashboard accessible from any browser. Manage, search, organize, and generate passwords.', badge: 'Available now' },
              { icon: Chrome, title: 'Browser extension', description: 'Detects login forms automatically. Fill passwords with one click, right in your browser toolbar.', badge: 'Available now' },
              { icon: Smartphone, title: 'Mobile app', description: 'Native mobile experience with quick unlock, search, and favorites. Built with React Native + Expo.', badge: 'In development' },
            ].map(({ icon: Icon, title, description, badge }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-6 text-left">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{badge}</span>
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-[hsl(222_40%_7%)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">Simple, honest pricing</h2>
          <p className="text-muted-foreground mb-12">Start free. Upgrade when your team needs more.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: 'Free',
                price: '$0',
                period: 'forever',
                description: 'For personal use',
                features: ['Unlimited passwords', 'Browser extension', 'Password generator', 'Security center', 'Encrypted backup'],
                cta: 'Get started',
                highlight: false,
              },
              {
                name: 'Pro',
                price: '$3',
                period: 'per month',
                description: 'For power users',
                features: ['Everything in Free', 'Mobile app access', 'Priority sync', 'Advanced security reports', 'Multiple vaults'],
                cta: 'Coming soon',
                highlight: true,
              },
              {
                name: 'Team',
                price: '$5',
                period: 'per user / month',
                description: 'For teams',
                features: ['Everything in Pro', 'Vault sharing', 'Admin panel', 'User management', 'Audit logs'],
                cta: 'Coming soon',
                highlight: false,
              },
            ].map(({ name, price, period, description, features, cta, highlight }) => (
              <div key={name} className={\`bg-card border rounded-2xl p-6 text-left \${highlight ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}\`}>
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
                  className={\`w-full h-9 \${highlight ? 'bg-primary hover:bg-primary/90' : 'bg-secondary hover:bg-secondary/80 text-foreground'}\`}
                  onClick={name === 'Free' ? onGetStarted : undefined}
                  disabled={name !== 'Free'}
                >
                  {cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Frequently asked questions</h2>
          <div className="bg-card border border-border rounded-2xl px-6">
            {FAQS.map(({ q, a }) => <FAQ key={q} question={q} answer={a} />)}
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="py-20 px-6 bg-gradient-to-b from-[hsl(222_40%_7%)] to-background">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-3">Start protecting your passwords today</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join thousands of users who have moved from sticky notes and browser-saved passwords to a secure, private vault.
          </p>
          <Button size="lg" className="h-12 px-10 bg-primary hover:bg-primary/90 text-base" onClick={onGetStarted}>
            Create your free vault <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()} SecureVoult. Your passwords, your privacy.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
            <span>Privacy-first</span>
            <span>·</span>
            <span>Zero knowledge</span>
            <span>·</span>
            <span>Open architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
`;

writeFileSync(join(root, 'src/components/LandingPage.tsx'), landing, 'utf8');
console.log('LandingPage written:', landing.split('\n').length, 'lines');
