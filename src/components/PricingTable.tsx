'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, X, Zap, Building2, Shield, Sparkles } from 'lucide-react';
import {
  PLAN_META, PLAN_PRICING, PLAN_LIMITS, PlanId, BillingCycle,
  getYearlyDiscount,
} from '@/lib/plans';

interface PricingTableProps {
  currentPlan?: PlanId;
  onUpgrade?: (plan: PlanId) => void;
  compact?: boolean;
}

const PLAN_ICONS: Record<PlanId, React.ElementType> = {
  free:       Shield,
  pro:        Zap,
  company:    Building2,
  enterprise: Sparkles,
};

const FEATURE_ROWS: { label: string; key: keyof typeof PLAN_LIMITS.free }[] = [
  { label: 'Vault entries',           key: 'maxEntries' },
  { label: 'Devices',                 key: 'maxDevices' },
  { label: 'Password breach check',   key: 'breachMonitoring' },
  { label: 'Breach history',          key: 'breachHistory' },
  { label: 'Exposure intelligence',   key: 'pasteMonitoring' },
  { label: 'Passkey login',           key: 'passkeys' },
  { label: 'Browser extension sync',  key: 'extensionSync' },
  { label: 'Mobile sync',             key: 'mobileSync' },
  { label: 'Session control',         key: 'sessionControl' },
  { label: 'Advanced reports',        key: 'advancedReports' },
  { label: 'Company dashboard',       key: 'companyFeatures' },
  { label: 'Audit logs',              key: 'auditLogs' },
  { label: 'Incident tracking',       key: 'incidentTracking' },
  { label: 'Security policies',       key: 'securityPolicies' },
  { label: 'SSO (SAML/OIDC)',         key: 'ssoReady' },
  { label: 'API access',              key: 'apiAccess' },
  { label: 'Priority support',        key: 'prioritySupport' },
];

const PLANS: PlanId[] = ['free', 'pro', 'company', 'enterprise'];

function formatLimit(val: number | boolean): React.ReactNode {
  if (typeof val === 'boolean') {
    return val
      ? <Check className="w-4 h-4 text-green-400 mx-auto" />
      : <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />;
  }
  if (val === -1) return <span className="text-green-400">∞</span>;
  return <span>{val}</span>;
}

export function PricingTable({ currentPlan = 'free', onUpgrade, compact = false }: PricingTableProps) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  return (
    <div className="w-full space-y-6">
      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <Label className="text-sm text-muted-foreground">Monthly</Label>
        <Switch
          checked={cycle === 'yearly'}
          onCheckedChange={v => setCycle(v ? 'yearly' : 'monthly')}
        />
        <Label className="text-sm text-muted-foreground">
          Yearly
          <span className="ml-2 text-[10px] text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full border border-green-500/25">
            Save up to 20%
          </span>
        </Label>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(planId => {
          const meta    = PLAN_META[planId];
          const pricing = PLAN_PRICING[planId];
          const limits  = PLAN_LIMITS[planId];
          const Icon    = PLAN_ICONS[planId];
          const isCurrent = planId === currentPlan;
          const discount = getYearlyDiscount(planId);
          const price = cycle === 'yearly' ? pricing.yearly / 12 : pricing.monthly;
          const isUpgrade = PLANS.indexOf(planId) > PLANS.indexOf(currentPlan);

          return (
            <div
              key={planId}
              className={`relative flex flex-col rounded-2xl border p-5 space-y-4
                ${meta.badge ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-card'}
                ${isCurrent ? 'ring-2 ring-primary/40' : ''}
              `}
            >
              {meta.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-full">
                    {meta.badge}
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute top-3 right-3">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Current</Badge>
                </div>
              )}

              <div>
                <div className={`flex items-center gap-2 mb-1 ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                  <span className="font-semibold">{meta.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{meta.tagline}</p>
              </div>

              <div>
                {pricing.custom ? (
                  <div className="text-2xl font-bold">Custom</div>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold">
                      {price === 0 ? 'Free' : `£${price.toFixed(price % 1 === 0 ? 0 : 2)}`}
                    </span>
                    {price > 0 && (
                      <span className="text-xs text-muted-foreground mb-1">
                        /mo{pricing.perUser ? '/user' : ''}
                      </span>
                    )}
                  </div>
                )}
                {cycle === 'yearly' && discount > 0 && (
                  <p className="text-[10px] text-green-400 mt-0.5">{discount}% off yearly</p>
                )}
              </div>

              {!compact && (
                <ul className="space-y-1.5 flex-1">
                  {meta.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                size="sm"
                className="w-full h-9"
                variant={meta.badge ? 'default' : 'outline'}
                disabled={isCurrent || !isUpgrade}
                onClick={() => onUpgrade?.(planId)}
              >
                {pricing.custom ? 'Contact Sales' :
                 isCurrent ? 'Current plan' :
                 isUpgrade ? `Upgrade to ${meta.name}` : 'Downgrade'}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Feature comparison table (non-compact mode) */}
      {!compact && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium w-48">Feature</th>
                {PLANS.map(p => (
                  <th key={p} className="text-center p-3 font-semibold w-28">
                    <span className={PLAN_META[p].color}>{PLAN_META[p].name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map(({ label, key }, i) => (
                <tr key={key} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-secondary/20' : ''}`}>
                  <td className="p-3 text-muted-foreground">{label}</td>
                  {PLANS.map(p => (
                    <td key={p} className="p-3 text-center">
                      {formatLimit(PLAN_LIMITS[p][key] as number | boolean)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
