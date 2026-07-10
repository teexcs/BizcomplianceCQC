'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckoutButton } from '@/components/site/checkout-button';
import { cn } from '@/lib/utils';
import { PLANS } from '@/lib/stripe/plans';

type BillingView = 'monthly' | 'annual';
type PlanId = 'essentials' | 'professional' | 'partner';

const PLAN_IDS: PlanId[] = ['essentials', 'professional', 'partner'];
const ANNUAL_SAVINGS = 0.15;

function formatPounds(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function annualEquivalentMonthly(priceGbp: number): number {
  return Math.round(priceGbp * (1 - ANNUAL_SAVINGS));
}

function annualTotal(priceGbp: number): number {
  return annualEquivalentMonthly(priceGbp) * 12;
}

export function PricingPlans({
  currentPlanId,
  hasAuditPurchase,
  isTestAccess = false,
  compact = false,
  annualAvailable,
}: {
  currentPlanId: string | null;
  hasAuditPurchase: boolean;
  isTestAccess?: boolean;
  compact?: boolean;
  annualAvailable: boolean;
}) {
  const [billingView, setBillingView] = useState<BillingView>('monthly');

  const plans = useMemo(() => PLAN_IDS.map((id) => PLANS[id]), []);
  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Billing
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Save {Math.round(ANNUAL_SAVINGS * 100)}% with annual billing.
          </p>
        </div>

        <div className="inline-flex rounded-md border border-border bg-background p-1">
          {(['monthly', 'annual'] as BillingView[]).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setBillingView(view)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                billingView === view
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {view === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
        </div>
      </div>

      {!hasAuditPurchase && !isTestAccess ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Monthly plans unlock after the one-off audit is purchased. Book the audit first, then
          switch to a maintenance plan.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const locked = !isTestAccess && !hasAuditPurchase;
          const annualEquivalent = annualEquivalentMonthly(plan.priceGbp);
          const annualBill = annualTotal(plan.priceGbp);
          const annualLocked = billingView === 'annual' && !annualAvailable;
          const buttonDisabled =
            Boolean(plan.comingSoon) || isCurrent || annualLocked || (locked && !isTestAccess);
          const label = plan.comingSoon
            ? 'Coming soon'
            : isCurrent && !isTestAccess
              ? 'Current plan'
              : annualLocked
                ? 'Annual not available'
                : locked
                  ? 'Book audit first'
                  : 'Switch to this plan';

          return (
            <Card
              key={plan.id}
              className={cn(
                'h-full flex flex-col',
                plan.popular ? 'border-border shadow-lg' : '',
                isCurrent && !isTestAccess ? 'ring-1 ring-inset ring-primary/30' : '',
              )}
            >
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-display text-xl">{plan.name}</h3>
                  {plan.comingSoon ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Coming soon
                    </Badge>
                  ) : plan.popular ? (
                    <Badge className="bg-muted text-foreground">
                      Most popular
                    </Badge>
                  ) : isCurrent && !isTestAccess ? (
                    <Badge className="bg-green-100 text-green-800">Current plan</Badge>
                  ) : isTestAccess ? (
                    <Badge className="bg-purple-100 text-purple-800">Test access</Badge>
                  ) : null}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {plan.description}
                </p>

                <div className="mb-5">
                  {billingView === 'monthly' ? (
                    <>
                      <p className="font-display text-3xl">{formatPounds(plan.priceGbp)}</p>
                      <p className="text-sm text-muted-foreground">per month</p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-3xl">{formatPounds(annualEquivalent)}</p>
                      <p className="text-sm text-muted-foreground">
                        per month billed annually
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatPounds(annualBill)} billed once a year
                      </p>
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm flex gap-2">
                      <Check size={17} className="mt-0.5 text-primary shrink-0" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                <CheckoutButton
                  planId={plan.id}
                  billingCycle={billingView}
                  label={label}
                  disabled={buttonDisabled}
                    className={cn(
                    'w-full',
                    buttonDisabled
                      ? 'border bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed'
                      : plan.popular
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border bg-background hover:bg-muted text-foreground',
                  )}
                />

                {plan.comingSoon ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    For consultants and multi-site operators — launching soon.
                  </p>
                ) : !hasAuditPurchase && !isTestAccess ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Book the audit to unlock this plan.
                  </p>
                ) : billingView === 'annual' && !annualAvailable ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Annual checkout is not configured yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {billingView === 'annual'
          ? 'Annual billing is collected once upfront. You save on the monthly equivalent, and the plans stay the same.'
          : 'Monthly pricing is billed every month after your audit is in place.'}
      </p>
      {billingView === 'annual' && annualAvailable ? (
        <p className="text-xs text-muted-foreground">
          Annual billing is collected once upfront and billed at a lower monthly equivalent.
        </p>
      ) : billingView === 'annual' ? (
        <p className="text-xs text-muted-foreground">
          Set the annual Stripe price IDs to enable annual checkout.
        </p>
      ) : null}
    </div>
  );
}
