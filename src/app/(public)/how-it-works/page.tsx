'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CheckoutButton } from '@/components/site/checkout-button';
import { PLANS } from '@/lib/stripe/plans';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function ScrollReveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref} className={cn('transition-all duration-700 ease-out', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const steps = [
  {
    num: '01',
    title: 'Sign up',
    desc: 'Create your account with your business name, country, service type, email and password.',
  },
  {
    num: '02',
    title: 'Open your dashboard',
    desc: 'Your welcome email takes you straight into the dashboard, where onboarding and upload progress live.',
  },
  {
    num: '03',
    title: 'Upload evidence',
    desc: 'Add policies, registers and records in the evidence vault. Each upload fills the progress bar.',
  },
  {
    num: '04',
    title: 'Review the dashboard',
    desc: 'Use the dashboard like a school tracker: progress bars fill as your evidence base grows.',
  },
  {
    num: '05',
    title: 'Move into audit review',
    desc: 'Once the dashboard is populated, the manual audit and written review can begin.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">How it works</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            From confusion to compliance in five steps
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16 max-w-2xl">
            Our process is designed to be thorough yet straightforward. We handle the complexity so you can focus on running your business.
          </p>
          <Link
            href="#see-how-we-assess"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            See how we assess →
          </Link>
        </ScrollReveal>

        <div className="space-y-5">
          {steps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 100}>
              <div className="border-l-2 border-border/70 pl-6 py-1">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)]">
                  Step {step.num}
                </p>
                <h2 className="mt-2 font-display text-2xl md:text-3xl tracking-tight">
                  {step.title}
                </h2>
                <p className="mt-3 text-muted-foreground leading-relaxed max-w-xl">{step.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={550}>
          <div
            id="see-how-we-assess"
            className="mt-16 rounded-2xl border border-border bg-muted/25 p-6 md:p-8"
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">
              See how we assess
            </p>
            <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-4">
              How BizCompliance Assesses Your Service
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-3xl mb-6">
              More than a document checklist. We review whether your compliance systems are
              evidenced, current and capable of standing up to scrutiny.
            </p>

            <div className="space-y-5 max-w-3xl">
              <div>
                <h3 className="font-display text-lg tracking-tight">1. Evidence review</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We review the documents and operational records uploaded to your secure workspace.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg tracking-tight">2. Regulatory mapping</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Findings are mapped against relevant CQC expectations and regulatory requirements.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg tracking-tight">3. Risk-based assessment</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Higher-risk gaps are prioritised based on their potential impact on safety,
                  governance and inspection readiness.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg tracking-tight">4. Readiness rating</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Each area receives a red, amber or green finding and contributes to your overall
                  readiness position.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg tracking-tight">5. Action plan</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  You receive clear corrective actions, evidence requirements and priority timescales.
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground max-w-3xl">
              Important: BizCompliance is an independent compliance service. Our assessment does
              not constitute a CQC inspection, official rating or guarantee of an inspection
              outcome.
            </p>
          </div>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal delay={200}>
          <div className="mt-16 pt-12 border-t text-center">
            <h3 className="font-display text-2xl md:text-3xl tracking-tight mb-4">
              Ready to get started?
            </h3>
            <p className="text-muted-foreground mb-8">
              Start with a one-off audit or choose ongoing compliance support.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <CheckoutButton planId="audit" label={`Book your CQC audit · £${PLANS.audit.priceGbp}`} />
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                View all plans
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
