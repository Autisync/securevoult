'use client';

import { Button } from '@/components/ui/button';
import { Lock, Zap, Building2 } from 'lucide-react';
import { UPGRADE_PROMPTS, UpgradeFeature } from '@/lib/feature-gates';
import { PLAN_META, PLAN_PRICING, PlanId } from '@/lib/plans';

// ── UpgradePrompt overlay ─────────────────────────────────────────────────────

interface UpgradePromptProps {
  feature: UpgradeFeature;
  onUpgrade?: (plan: PlanId) => void;
  inline?: boolean;  // smaller inline version
}

export function UpgradePrompt({ feature, onUpgrade, inline = false }: UpgradePromptProps) {
  const prompt = UPGRADE_PROMPTS[feature];
  const planMeta = PLAN_META[prompt.targetPlan];
  const Icon = prompt.targetPlan === 'company' ? Building2 : Zap;

  if (inline) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-lg text-xs">
        <Lock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-muted-foreground flex-1">{prompt.description}</span>
        <Button
          size="sm"
          className="h-7 text-[11px] px-2.5 gap-1"
          onClick={() => onUpgrade?.(prompt.targetPlan)}
        >
          <Icon className="w-3 h-3" />{prompt.cta}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 bg-card border border-border rounded-2xl">
      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">{prompt.title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{prompt.description}</p>
      </div>
      <Button
        className="gap-2"
        onClick={() => onUpgrade?.(prompt.targetPlan)}
      >
        <Icon className="w-4 h-4" />
        {prompt.cta}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Starting from{' '}
        <span className={planMeta.color}>
          {PLAN_PRICING[planMeta.id].monthly === 0
            ? 'Free'
            : PLAN_PRICING[planMeta.id].custom
              ? 'Custom pricing'
              : `£${PLAN_PRICING[planMeta.id].monthly}/mo`}
        </span>
      </p>
    </div>
  );
}

// ── PlanBadge ─────────────────────────────────────────────────────────────────

interface PlanBadgeProps {
  plan: PlanId;
  size?: 'sm' | 'md';
}

const PLAN_BADGE_STYLES: Record<PlanId, string> = {
  free:       'bg-secondary text-muted-foreground border-border',
  pro:        'bg-blue-500/15 text-blue-400 border-blue-500/25',
  company:    'bg-violet-500/15 text-violet-400 border-violet-500/25',
  enterprise: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
};

export function PlanBadge({ plan, size = 'sm' }: PlanBadgeProps) {
  const meta = PLAN_META[plan];
  return (
    <span className={`inline-flex items-center border rounded-full font-medium
      ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}
      ${PLAN_BADGE_STYLES[plan]}`}
    >
      {meta.name}
    </span>
  );
}

// ── LockedFeatureGate ─────────────────────────────────────────────────────────

interface LockedFeatureGateProps {
  allowed: boolean;
  feature: UpgradeFeature;
  onUpgrade?: (plan: PlanId) => void;
  children: React.ReactNode;
}

/** Wraps children — if not allowed, renders an upgrade prompt instead. */
export function LockedFeatureGate({ allowed, feature, onUpgrade, children }: LockedFeatureGateProps) {
  if (allowed) return <>{children}</>;
  return <UpgradePrompt feature={feature} onUpgrade={onUpgrade} />;
}

// ── UsageBar ──────────────────────────────────────────────────────────────────

interface UsageBarProps {
  current: number;
  max: number | null;  // null = unlimited
  label: string;
}

export function UsageBar({ current, max, label }: UsageBarProps) {
  if (max === null) {
    return (
      <div className="text-xs text-muted-foreground">
        {label}: <span className="text-foreground">{current}</span>
        <span className="text-green-400 ml-1">/ ∞</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((current / max) * 100));
  const isWarning = pct >= 80;
  const isFull    = pct >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={isFull ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-foreground'}>
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all
            ${isFull ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
