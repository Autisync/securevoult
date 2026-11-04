'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { parseTotp, totpNow, formatCode } from '@/lib/totp';

interface Props {
  secret: string;
  onCopy?: (code: string) => void | Promise<unknown>;
  compact?: boolean;
}

/** The current 2FA code with a countdown ring; refreshes on its own. */
export function TotpCode({ secret, onCopy, compact }: Props) {
  const cfg = useMemo(() => parseTotp(secret), [secret]);
  const [now, setNow] = useState<{ code: string; remaining: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    let alive = true;
    const tick = () => { totpNow(cfg).then((r) => { if (alive) setNow(r); }).catch(() => {}); };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => { alive = false; window.clearInterval(id); };
  }, [cfg]);

  if (!cfg) return <span className="text-xs text-destructive">2FA key not readable. Edit the item to fix it.</span>;
  if (!now) return <span className="text-sm text-muted-foreground font-mono">••• •••</span>;

  const fraction = now.remaining / cfg.period;
  const low = now.remaining <= 5;
  const r = 7, c = 2 * Math.PI * r;

  const copy = async () => {
    if (onCopy) await onCopy(now.code);
    else await navigator.clipboard.writeText(now.code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button type="button" onClick={copy} title="Copy 2FA code"
      className={`group flex items-center gap-2 rounded-lg ${compact ? '' : 'w-full'} text-left`}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="flex-shrink-0 -rotate-90">
        <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary" />
        <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - fraction)}
          className={low ? 'text-red-400' : 'text-primary'} style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className={`font-mono tabular-nums tracking-wider ${compact ? 'text-sm' : 'text-base'} ${low ? 'text-red-400' : 'text-foreground'}`}>
        {formatCode(now.code)}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{now.remaining}s</span>
      <span className="ml-auto text-muted-foreground group-hover:text-foreground">
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </span>
    </button>
  );
}
