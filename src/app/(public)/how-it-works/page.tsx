'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CheckoutButton } from '@/components/site/checkout-button';

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
    desc: 'Choose your plan and complete our streamlined onboarding form. We collect only the information we need to understand your business and its compliance obligations.',
    detail: 'Takes 5 minutes',
  },
  {
    num: '02',
    title: 'Onboarding call',
    desc: 'A 20-minute video call with one of our compliance specialists. We discuss your business model, current documentation, and any specific concerns or past issues.',
    detail: 'Within 48 hours',
  },
  {
    num: '03',
    title: 'Initial audit',
    desc: 'Our team conducts a thorough manual review of your business against all applicable UK regulations. We examine your website, documentation, processes, and sector-specific requirements.',
    detail: '5\u20137 days',
  },
  {
    num: '04',
    title: 'Documents delivered',
    desc: 'You receive a plain-English written audit report (10\u201315 pages) and all required compliance documents, drafted specifically for your business. Nothing templated.',
    detail: 'Included in all plans',
  },
  {
    num: '05',
    title: 'Ongoing support',
    desc: 'Your compliance documents are kept current as regulations change. We monitor your sector for new requirements and proactively update your documentation.',
    detail: 'Monthly subscribers',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6 md:px-10 lg:px-12">
        <ScrollReveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(36,45%,45%)] mb-4">How it works</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            From confusion to compliance in five steps
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-16 max-w-2xl">
            Our process is designed to be thorough yet straightforward. We handle the complexity so you can focus on running your business.
          </p>
        </ScrollReveal>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 md:left-8 top-0 bottom-0 w-px bg-border" />

          {steps.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 100}>
              <div className="relative pl-16 md:pl-20 pb-16 last:pb-0">
                {/* Step circle */}
                <div className="absolute left-0 top-0 w-12 h-12 md:w-16 md:h-16 rounded-full bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] flex items-center justify-center">
                  <span className="font-display text-sm md:text-base font-semibold">{step.num}</span>
                </div>

                <div className="pt-2 md:pt-3">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h2 className="font-display text-2xl md:text-3xl tracking-tight">{step.title}</h2>
                    <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded">
                      {step.detail}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed max-w-xl">{step.desc}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

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
              <CheckoutButton planId="audit" label="Book your CQC audit · £349" />
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
