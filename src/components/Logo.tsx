'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  /** The mark on its dark app-icon tile, instead of the bare mark. */
  tile?: boolean;
  className?: string;
}

const iconSizes = { sm: 24, md: 30, lg: 44, xl: 60 };
const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-4xl' };

/**
 * The SecureVoult mark: a padlock shackle over a "V". Gold on dark, a deeper
 * gold on light (via --logo-* in globals.css).
 */
export function LogoMark({ px, tile, className }: { px: number; tile?: boolean; className?: string }) {
  // Unique ids: the mark can be on the page twice (sidebar + phone menu).
  const uid = useId().replace(/:/g, '');
  const g = `svg-g-${uid}`, m = `svg-m-${uid}`, t = `svg-t-${uid}`;
  const body = (
    <>
      <path d="M22 26.5V20a10 10 0 0 1 20 0v6.5" fill="none" stroke={`url(#${g})`} strokeWidth="5.2" strokeLinecap="round" />
      <g mask={tile ? undefined : `url(#${m})`}>
        <path d="M13.5 26.5h37a1.6 1.6 0 0 1 1.35 2.45L33.4 56.1a1.65 1.65 0 0 1-2.8 0L12.15 28.95a1.6 1.6 0 0 1 1.35-2.45z" fill={`url(#${g})`} />
        <path d="M13.5 26.5h37a1.6 1.6 0 0 1 1.35 2.45l-1.2 1.75H13.35l-1.2-1.75a1.6 1.6 0 0 1 1.35-2.45z" fill="#FBE7B5" fillOpacity=".4" />
      </g>
      {tile && <path d="M25 32.5h14L32 44.2z" fill="#151514" />}
    </>
  );
  return (
    <svg width={px} height={px} viewBox={tile ? '0 0 64 64' : '8 6 48 52'} fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" className={cn('flex-shrink-0', className)}>
      <defs>
        <linearGradient id={g} x1="12" y1="9" x2="50" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--logo-hi, #F2D797)' }} />
          <stop offset=".5" style={{ stopColor: 'var(--logo-mid, #CDA24C)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-lo, #8E6722)' }} />
        </linearGradient>
        <linearGradient id={t} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2A2926" /><stop offset="1" stopColor="#121211" />
        </linearGradient>
        <mask id={m}><rect width="64" height="64" fill="#fff" /><path d="M25 32.5h14L32 44.2z" fill="#000" /></mask>
      </defs>
      {tile ? (
        <>
          <rect width="64" height="64" rx="14.5" fill={`url(#${t})`} />
          <rect x=".6" y=".6" width="62.8" height="62.8" rx="14" fill="none" stroke="#CDA24C" strokeOpacity=".28" strokeWidth="1.2" />
          <g transform="translate(32 33) scale(.86) translate(-32 -32)">{body}</g>
        </>
      ) : body}
    </svg>
  );
}

export function Logo({ size = 'md', showText = true, tile, className }: LogoProps) {
  const px = iconSizes[size];
  return (
    <div className={cn('flex items-center gap-2', className)} aria-label="SecureVoult">
      <LogoMark px={px} tile={tile} />
      {showText && (
        <span className={cn('font-semibold tracking-[-0.03em] leading-none', textSizes[size])}>
          Secure<span className="text-primary">Voult</span>
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ size = 'md', className }: Omit<LogoProps, 'showText'>) {
  return <Logo size={size} showText={false} className={className} />;
}
