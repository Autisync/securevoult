'use client';

import { ShieldCheck, Lock, EyeOff, Server, Key, Globe } from 'lucide-react';

const SIGNALS = [
  {
    icon: Lock,
    title: 'Zero-knowledge encryption',
    description: 'Your master password and vault data are encrypted locally before leaving your device.',
  },
  {
    icon: EyeOff,
    title: 'We never see your passwords',
    description: 'All encryption and decryption happens in your browser. Our servers only store ciphertext.',
  },
  {
    icon: ShieldCheck,
    title: 'AES-256 + PBKDF2',
    description: 'Industry-standard algorithms protect every vault entry at rest and in transit.',
  },
  {
    icon: Server,
    title: 'No plain-text storage',
    description: 'Passwords are never written to disk, logs, or databases in readable form.',
  },
  {
    icon: Key,
    title: 'Passkey ready',
    description: 'Sign in with biometrics or a hardware key — no shared secrets to steal.',
  },
  {
    icon: Globe,
    title: 'Open security model',
    description: 'Our encryption design is documented and peer-reviewable — security through transparency.',
  },
] as const;

interface TrustSignalsProps {
  /** Only show a subset (e.g. 3) on a login page */
  max?: number;
  compact?: boolean;
}

export function TrustSignals({ max, compact = false }: TrustSignalsProps) {
  const items = max ? SIGNALS.slice(0, max) : SIGNALS;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-3">
        {items.map(s => (
          <div key={s.title} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <s.icon className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            <span>{s.title}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${items.length > 3 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
      {items.map(s => (
        <div key={s.title} className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <s.icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{s.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
