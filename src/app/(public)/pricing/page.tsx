import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckoutButton } from '@/components/site/checkout-button';
import { PricingPlans } from '@/components/site/pricing-plans';
import { PlanComparison } from '@/components/site/plan-comparison';
import { getSessionContext } from '@/lib/data/session';
import { hasCompletedAuditPurchase } from '@/lib/data/client';
import { PLANS, type PlanId } from '@/lib/stripe/plans';

const nextSteps = [
  {
    title: 'Upload your evidence',
    desc: 'Add the policies, audits and records you already use straight into your secure vault.',
  },
  {
    title: 'We review, manually',
    desc: 'Every document is checked against the 18 CQC compliance areas and the Single Assessment Framework.',
  },
  {
    title: 'Report in 48 hours',
    desc: 'A readiness score, red/amber/green findings per area, a priority action plan — and the documents you were missing, issued to your vault.',
  },
];

async function PublicPricingPage() {
  const audit = PLANS.audit;
  const annualAvailable =
    Boolean(process.env.STRIPE_PRICE_ESSENTIALS_ANNUAL) &&
    Boolean(process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL) &&
    Boolean(process.env.STRIPE_PRICE_PARTNER_ANNUAL);

  return (
    <div className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="mb-14">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">
            Pricing
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            Start with the audit. Stay inspection-ready.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-2xl">
            A one-off CQC Readiness Audit gets you a clear picture in 48 hours. Monthly plans keep
            your documents, deadlines and evidence continuously ready.
          </p>
        </div>

        <div className="mb-14 p-6 md:p-8 border rounded-2xl bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)]">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.15em] opacity-70 mb-2">
                One-off · 48-hour turnaround
              </p>
              <h2 className="font-display text-2xl md:text-3xl mb-3">{audit.name}</h2>
              <p className="text-sm opacity-80 leading-relaxed">{audit.description}</p>
              <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {audit.features.map((f) => (
                  <li key={f} className="text-sm opacity-90 flex gap-2">
                    <span aria-hidden="true" className="text-[hsl(220,45%,65%)]">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] opacity-70">Price</p>
                <div className="flex items-end gap-3">
                  <span className="font-display text-sm leading-none opacity-65 line-through">
                    £795
                  </span>
                  <p className="font-display text-4xl leading-none">£{audit.priceGbp}</p>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.15em] opacity-70">
                  Limited-time rate
                </p>
              </div>
              <CheckoutButton
                planId="audit"
                label="Book your CQC audit"
                className="bg-[hsl(36,33%,97%)] text-[hsl(220,50%,15%)] hover:bg-white"
              />
            </div>
          </div>
        </div>

        <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">
          Ongoing compliance plans
        </h2>
        <PricingPlans
          currentPlanId={null}
          hasAuditPurchase={false}
          annualAvailable={annualAvailable}
        />

        <div className="mt-16">
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-2">
            Everything, side by side
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
            Exactly what each plan unlocks in your dashboard. All plans build on the one-off audit.
          </p>
          <PlanComparison />
        </div>

        <div className="mt-16">
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
            {nextSteps.map((step, i) => (
              <Card key={step.title} className="h-full border">
                <CardContent className="p-5">
                  <p className="font-mono text-xs text-[hsl(220,45%,45%)] mb-2">0{i + 1}</p>
                  <h3 className="font-display text-lg mb-1.5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
          Prices exclude VAT where applicable. The audit is an editable documentation and readiness
          toolset: the registered provider and registered manager remain accountable for compliance
          with the law. BizCompliance is a compliance system, not legal advice.
        </p>
      </div>
    </div>
  );
}

function SignedInPricingSummary({
  currentPlanId,
  businessName,
  isTestAccess,
  hasAuditPurchase,
  annualAvailable,
}: {
  currentPlanId: PlanId | null;
  businessName: string;
  isTestAccess: boolean;
  hasAuditPurchase: boolean;
  annualAvailable: boolean;
}) {
  return (
    <div className="py-10 md:py-12">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-3">
              Plan management
            </p>
            <h1 className="font-display text-3xl md:text-4xl tracking-tight">
              {businessName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              {hasAuditPurchase || isTestAccess
                ? 'Plan changes are unlocked from your dashboard. Open your account to change plans.'
                : 'Buy the one-off audit first. Monthly plans unlock after that.'}
              {isTestAccess ? ' Test access is enabled on this account.' : ''}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Back to dashboard <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <Card>
          <CardContent className="p-6 md:p-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Current status
                </p>
                <p className="mt-2 font-display text-2xl tracking-tight">
                  {currentPlanId ? `${PLANS[currentPlanId]?.name ?? currentPlanId} plan` : 'Pay-as-you-go'}
                </p>
              </div>
              <Link
                href="/dashboard/account?change=1"
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open change plan
              </Link>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              To compare or switch plans, open your dashboard account. That keeps billing changes
              behind sign-in and away from the public site.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-none border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audit</p>
                <p className="mt-2 text-sm">Required before monthly plans can be purchased.</p>
              </div>
              <div className="rounded-none border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Billing</p>
                <p className="mt-2 text-sm">
                  {annualAvailable ? 'Monthly and annual billing available.' : 'Monthly billing available now; annual checkout is not configured.'}
                </p>
              </div>
              <div className="rounded-none border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Access</p>
                <p className="mt-2 text-sm">
                  {isTestAccess ? 'Test access can exercise every plan.' : 'Only the signed-in account can manage plans.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignedInPricingChooser({
  currentPlanId,
  businessName,
  isTestAccess,
  hasAuditPurchase,
  annualAvailable,
}: {
  currentPlanId: PlanId | null;
  businessName: string;
  isTestAccess: boolean;
  hasAuditPurchase: boolean;
  annualAvailable: boolean;
}) {
  return (
    <div className="py-10 md:py-12">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-3">
              Change plan
            </p>
            <h1 className="font-display text-3xl md:text-4xl tracking-tight">
              {businessName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              {hasAuditPurchase || isTestAccess
                ? 'Choose a monthly or annual plan to change what your dashboard unlocks.'
                : 'Buy the one-off audit first. Monthly plans unlock after that.'}
              {isTestAccess ? ' Test access is enabled on this account.' : ''}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Back to dashboard <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <PricingPlans
          currentPlanId={currentPlanId}
          hasAuditPurchase={hasAuditPurchase}
          annualAvailable={annualAvailable}
          isTestAccess={isTestAccess}
          compact
        />

        <div className="mt-12">
          <PlanComparison />
        </div>
      </div>
    </div>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ change?: string }>;
}) {
  const { change } = await searchParams;
  const ctx = await getSessionContext();
  if (ctx?.org) {
    const annualAvailable =
      Boolean(process.env.STRIPE_PRICE_ESSENTIALS_ANNUAL) &&
      Boolean(process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL) &&
      Boolean(process.env.STRIPE_PRICE_PARTNER_ANNUAL);
    const auditPurchased = ctx.testAccess ? true : await hasCompletedAuditPurchase(ctx.org.id);
    const currentPlanId = ctx.testAccess ? 'partner' : (ctx.subscription?.plan ?? null);
    if (change !== '1') {
      return (
        <SignedInPricingSummary
          currentPlanId={currentPlanId}
          businessName={ctx.org.name}
          isTestAccess={ctx.testAccess}
          hasAuditPurchase={auditPurchased}
          annualAvailable={annualAvailable}
        />
      );
    }
    return (
      <SignedInPricingChooser
        currentPlanId={currentPlanId}
        businessName={ctx.org.name}
        isTestAccess={ctx.testAccess}
        hasAuditPurchase={auditPurchased}
        annualAvailable={annualAvailable}
      />
    );
  }

  return <PublicPricingPage />;
}
