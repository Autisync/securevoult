'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center px-6', className)}>
      <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4 text-muted-foreground/50">
        {icon}
      </div>
      <h3 className="font-semibold text-base mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">{description}</p>
      <div className="flex items-center gap-2">
        {ctaLabel && onCta && (
          <Button size="sm" onClick={onCta} className="bg-primary hover:bg-primary/90 h-9">
            {ctaLabel}
          </Button>
        )}
        {secondaryLabel && onSecondary && (
          <Button size="sm" variant="outline" onClick={onSecondary} className="h-9">
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
