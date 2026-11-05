'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const iconSizes = { sm: 24, md: 32, lg: 44, xl: 56 };
const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' };

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const px = iconSizes[size];
  // Unique gradient ids: the logo can be on the page twice (sidebar + phone menu),
  // and a hidden copy's ids would otherwise blank the visible one.
  const uid = useId().replace(/:/g, '');

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SecureVoult logo"
      >
        {/* Shield fill */}
        <path
          d="M20 2L4 8.5v11C4 29 11 37.2 20 39.5 29 37.2 36 29 36 19.5v-11L20 2z"
          fill={`url(#sv-shield-fill-${uid})`}
        />
        {/* Shield stroke */}
        <path
          d="M20 2L4 8.5v11C4 29 11 37.2 20 39.5 29 37.2 36 29 36 19.5v-11L20 2z"
          stroke={`url(#sv-stroke-${uid})`}
          strokeWidth="1.5"
          fill="none"
        />
        {/* Keyhole circle */}
        <circle cx="20" cy="18" r="4.5" fill={`url(#sv-key-${uid})`} />
        {/* Keyhole stem */}
        <path d="M18 22.5h4l-.8 5.5h-2.4L18 22.5z" fill={`url(#sv-key-${uid})`} />

        <defs>
          <linearGradient id={`sv-shield-fill-${uid}`} x1="4" y1="2" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D1A94C" stopOpacity="0.14" />
            <stop offset="1" stopColor="#B28228" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={`sv-stroke-${uid}`} x1="4" y1="2" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D1A94C" />
            <stop offset="1" stopColor="#B28228" />
          </linearGradient>
          <linearGradient id={`sv-key-${uid}`} x1="15.5" y1="13.5" x2="24.5" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E3C27A" />
            <stop offset="1" stopColor="#B98F3E" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <span className={cn('font-bold tracking-tight', textSizes[size])}>
          Secure
          <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
            Voult
          </span>
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ size = 'md', className }: Omit<LogoProps, 'showText'>) {
  return <Logo size={size} showText={false} className={className} />;
}
