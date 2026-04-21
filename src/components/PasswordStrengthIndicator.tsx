'use client';

import { PasswordStrengthResult } from '@/types/vault';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  result: PasswordStrengthResult;
  className?: string;
}

const SEGMENTS = 4;

const STRENGTH_MAP = {
  weak:   { label: 'Weak',     color: 'bg-red-500',    filled: 1 },
  fair:   { label: 'Fair',     color: 'bg-orange-400', filled: 2 },
  good:   { label: 'Good',     color: 'bg-yellow-400', filled: 3 },
  strong: { label: 'Strong',   color: 'bg-green-400',  filled: 4 },
};

export function PasswordStrengthIndicator({ result, className }: PasswordStrengthIndicatorProps) {
  const { label, color, filled } = STRENGTH_MAP[result.strength as keyof typeof STRENGTH_MAP] ?? STRENGTH_MAP.weak;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i < filled ? color : 'bg-secondary'
            )}
          />
        ))}
        <span className={cn(
          'text-xs font-medium ml-1 flex-shrink-0 w-12 text-right',
          result.strength === 'strong' ? 'text-green-400' :
          result.strength === 'good' ? 'text-yellow-400' :
          result.strength === 'fair' ? 'text-orange-400' : 'text-red-400'
        )}>
          {label}
        </span>
      </div>
      {result.feedback.length > 0 && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {result.feedback[0]}
        </p>
      )}
    </div>
  );
}