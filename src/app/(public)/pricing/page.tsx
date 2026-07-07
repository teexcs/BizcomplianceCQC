'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckoutButton } from '@/components/site/checkout-button';
import { PLANS } from '@/lib/stripe/plans';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

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

const audit = PLANS.audit;
const monthlyPlans = [PLANS.essentials, PLANS.professional, PLANS.partner];

export default function PricingPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(36,45%,45%)] mb-4">
            Pricing
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            Start with the audit. Stay inspection-ready.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-2xl">
            A one-off CQC Readiness Audit gets you a clear picture in 48 hours. Monthly plans keep
            your documents, deadlines and evidence continuously ready.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={100}>
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
                      <span aria-hidden="true" className="text-[hsl(36,45%,65%)]">
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
                  <p className="font-display text-4xl leading-none">£{audit.priceGbp}</p>
                </div>
                <CheckoutButton
                  planId="audit"
                  label="Book your CQC audit"
                  className="bg-[hsl(36,33%,97%)] text-[hsl(220,50%,15%)] hover:bg-white"
                />
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">
            Ongoing compliance plans
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {monthlyPlans.map((plan, i) => (
            <ScrollReveal key={plan.id} delay={i * 100}>
              <Card
                className={cn(
                  'h-full flex flex-col',
                  plan.popular ? 'border-[hsl(36,45%,45%)] shadow-lg' : '',
                )}
              >
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display text-xl">{plan.name}</h3>
                    {plan.popular ? (
                      <Badge className="bg-[hsl(36,45%,45%)]/15 text-[hsl(36,45%,35%)]">
                        Most popular
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {plan.description}
                  </p>
                  <p className="mb-5">
                    <span className="font-display text-3xl">£{plan.priceGbp}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-sm flex gap-2">
                        <span aria-hidden="true" className="text-[hsl(36,45%,45%)]">
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <CheckoutButton
                    planId={plan.id}
                    label={`Choose ${plan.name}`}
                    className={cn(
                      'w-full',
                      plan.popular
                        ? 'bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90'
                        : 'border bg-background hover:bg-muted text-foreground',
                    )}
                  />
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-6">How it works</h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {nextSteps.map((step, i) => (
            <ScrollReveal key={step.title} delay={i * 80}>
              <Card className="h-full border">
                <CardContent className="p-5">
                  <p className="font-mono text-xs text-[hsl(36,45%,45%)] mb-2">0{i + 1}</p>
                  <h3 className="font-display text-lg mb-1.5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Prices exclude VAT where applicable. The audit is an editable documentation and
            readiness toolset: the registered provider and registered manager remain accountable
            for compliance with the law. BizCompliance is a compliance system, not legal advice.
          </p>
        </ScrollReveal>
      </div>
    </div>
  );
}
