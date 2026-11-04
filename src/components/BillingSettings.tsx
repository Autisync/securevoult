'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PricingTable } from '@/components/PricingTable';
import { PlanBadge } from '@/components/PlanGate';
import { PLAN_META, PLAN_LIMITS, PLAN_PRICING, PlanId } from '@/lib/plans';
import { getEntryLimit } from '@/lib/feature-gates';
import { CreditCard, CheckCircle2, ArrowUpRight, Calendar, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface BillingSettingsProps {
  currentPlan: PlanId;
  entryCount?: number;
  /** billingCycle from user record */
  billingCycle?: 'monthly' | 'yearly';
  /** planExpiresAt from user record */
  planExpiresAt?: string | null;
}

export function BillingSettings({
  currentPlan,
  entryCount = 0,
  billingCycle = 'monthly',
  planExpiresAt,
}: BillingSettingsProps) {
  const [showPlans, setShowPlans] = useState(false);
  const { toast } = useToast();

  const meta   = PLAN_META[currentPlan];
  const limits = PLAN_LIMITS[currentPlan];
  const entryLimit = getEntryLimit(currentPlan);

  const handleUpgrade = (plan: PlanId) => {
    // Placeholder — Stripe integration point
    toast({
      title: `Upgrade to ${PLAN_META[plan].name}`,
      description: 'Payment processing coming soon. Thank you for your interest!',
    });
  };

  const isPaid = currentPlan !== 'free';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />Billing &amp; Plan
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your subscription and usage.
        </p>
      </div>

      {/* Current plan card */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PlanBadge plan={currentPlan} size="md" />
              {isPaid && (
                <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{meta.tagline}</p>
          </div>
          <div className="text-right">
            {PLAN_PRICING[currentPlan].custom ? (
              <div className="text-sm font-semibold">Custom</div>
            ) : PLAN_PRICING[currentPlan].monthly === 0 ? (
              <div className="text-sm font-semibold">Free</div>
            ) : (
              <>
                <div className="text-sm font-semibold">
                  £{billingCycle === 'yearly'
                    ? (PLAN_PRICING[currentPlan].yearly / 12).toFixed(2)
                    : PLAN_PRICING[currentPlan].monthly}/mo
                </div>
                <div className="text-[10px] text-muted-foreground capitalize">{billingCycle}</div>
              </>
            )}
          </div>
        </div>

        {/* Usage */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-muted-foreground mb-1">Vault entries</p>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-sm">{entryCount}</span>
              <span className="text-muted-foreground">/ {entryLimit === null ? '∞' : entryLimit}</span>
            </div>
            {entryLimit !== null && (
              <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    entryCount / entryLimit >= 0.9 ? 'bg-red-500' :
                    entryCount / entryLimit >= 0.7 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (entryCount / entryLimit) * 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-muted-foreground mb-1">Features</p>
            <div className="space-y-0.5">
              <p className={limits.passkeys ? 'text-green-400' : 'text-muted-foreground/50'}>
                {limits.passkeys ? '✓' : '✗'} Passkeys
              </p>
              <p className={limits.breachHistory ? 'text-green-400' : 'text-muted-foreground/50'}>
                {limits.breachHistory ? '✓' : '✗'} Breach history
              </p>
              <p className={limits.extensionSync ? 'text-green-400' : 'text-muted-foreground/50'}>
                {limits.extensionSync ? '✓' : '✗'} Extension sync
              </p>
            </div>
          </div>
        </div>

        {/* Expiry */}
        {planExpiresAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            Plan renews on {new Date(planExpiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {currentPlan !== 'enterprise' && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowPlans(!showPlans)}
            >
              <Zap className="w-3.5 h-3.5" />
              {currentPlan === 'free' ? 'Upgrade plan' : 'Change plan'}
            </Button>
          )}
          {isPaid && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() =>
                toast({
                  title: 'Billing portal',
                  description: 'Stripe billing portal coming soon. Contact support@securevoult.co.uk to manage your subscription.',
                })
              }
            >
              <ArrowUpRight className="w-3.5 h-3.5" />Manage billing
            </Button>
          )}
        </div>
      </div>

      {/* Plan comparison (collapsible) */}
      {showPlans && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Choose a plan</h3>
          <PricingTable currentPlan={currentPlan} onUpgrade={handleUpgrade} compact={false} />
        </div>
      )}
    </div>
  );
}
