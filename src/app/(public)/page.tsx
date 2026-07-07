'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.unobserve(el);
      }
    }, { threshold: 0.12 });

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

const whoThisIsFor = [
  {
    title: 'Domiciliary care providers',
    desc: 'Services supporting people in their own homes and managing day-to-day care delivery.',
  },
  {
    title: 'Supported living services',
    desc: 'Providers that need clear evidence around tenancy support, risk and person-centred care.',
  },
  {
    title: 'Residential care homes',
    desc: 'Homes preparing for inspection or responding to findings that need structured improvement.',
  },
  {
    title: 'Healthcare clinics',
    desc: 'Clinics with governance, consent and record-keeping obligations that need a sharper audit trail.',
  },
  {
    title: 'New providers preparing for registration/inspection',
    desc: 'Teams that want a clean baseline before opening, registration or a first inspection visit.',
  },
  {
    title: 'Existing providers preparing for inspection or improvement',
    desc: 'Registered services that want an honest view of gaps before inspectors arrive.',
  },
];

const includedItems = [
  'Review of key CQC evidence and governance information',
  'Assessment across Safe, Effective, Caring, Responsive and Well-led',
  'Risk-rated findings',
  'Personalised CQC readiness score',
  'Priority action plan',
  'Practical recommendations',
  'PDF report',
  '7 days of clarification after delivery',
];

const cqcAreas = [
  {
    title: 'Safe',
    desc: 'Safeguarding, medicines, staffing, infection control and other risk controls that should be evidenced clearly.',
  },
  {
    title: 'Effective',
    desc: 'Care planning, outcomes, consent, competence and training evidence that shows services are working well.',
  },
  {
    title: 'Caring',
    desc: 'Dignity, compassion, privacy and how people are involved in their care and treatment.',
  },
  {
    title: 'Responsive',
    desc: 'Access, complaints, continuity, flexibility and documented responses to people’s needs.',
  },
  {
    title: 'Well-led',
    desc: 'Governance, learning, oversight, quality checks and leadership evidence that supports improvement.',
  },
];

const reasons = [
  'Manual personalised review',
  'Clear inspection-risk language',
  'No generic checklist',
  'Focused action plan',
  'Designed for busy providers and managers',
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(94,106,82,0.10),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(21,32,44,0.10),_transparent_35%)]" />
        <div className="relative max-w-7xl mx-auto px-6 md:px-10 lg:px-12 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <ScrollReveal className="lg:col-span-7">
              <Badge variant="outline" className="mb-5 border-[hsl(36,45%,45%)]/30 bg-white/70 text-[hsl(220,50%,15%)]">
                BizCompliance CQC
              </Badge>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight max-w-4xl">
                CQC readiness audits for care providers
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                A personalised one-off audit that reviews your service against CQC expectations, highlights inspection risks and gives you a clear action plan before inspectors do.
              </p>
              <div className="mt-8 inline-flex flex-wrap items-center gap-3 rounded-full border bg-background/80 px-4 py-3 shadow-sm">
                <span className="text-sm font-medium text-muted-foreground">One-off audit:</span>
                <span className="font-display text-2xl text-[hsl(220,50%,15%)]">&pound;349</span>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
                >
                  Book Your CQC Audit
                </Link>
                <Link
                  href="#included"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  See What’s Included
                </Link>
              </div>
              <p className="mt-6 text-sm text-muted-foreground max-w-2xl">
                Built for domiciliary care, supported living, care homes, clinics and new or registered providers preparing for inspection.
              </p>
            </ScrollReveal>

            <ScrollReveal className="lg:col-span-5" delay={120}>
              <Card className="relative overflow-hidden border shadow-xl bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(17,24,39,0.92))] text-[hsl(36,33%,97%)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(168,139,91,0.22),_transparent_42%)]" />
                <CardContent className="relative p-7 md:p-8">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] opacity-70 mb-4">What we look at</p>
                  <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-5">
                    A practical readiness review, not a generic checklist
                  </h2>
                  <div className="space-y-3">
                    {cqcAreas.map((area) => (
                      <div key={area.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium">{area.title}</p>
                          <span className="text-xs uppercase tracking-[0.15em] text-[hsl(36,33%,97%)]/60">CQC area</span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[hsl(36,33%,97%)]/72">{area.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section id="who" className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">Who this is for</h2>
            <p className="text-muted-foreground leading-relaxed max-w-3xl mb-10">
              The audit is built for care providers that need a serious, manual review of evidence and inspection readiness.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {whoThisIsFor.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 60}>
                <Card className="h-full border hover:border-foreground/20 transition-colors">
                  <CardContent className="p-6">
                    <h3 className="font-display text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="included" className="py-20 md:py-24 bg-muted/25">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">What the &pound;349 audit includes</h2>
            <p className="text-muted-foreground leading-relaxed max-w-3xl mb-10">
              A single manual review designed to give you a clear picture of risk, evidence and next actions.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {includedItems.map((item, i) => (
              <ScrollReveal key={item} delay={i * 50}>
                <Card className="h-full border bg-background">
                  <CardContent className="p-5 flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 rounded-full bg-[hsl(36,45%,45%)]/15 text-[hsl(36,45%,45%)] flex items-center justify-center text-xs font-semibold shrink-0">
                      ✓
                    </div>
                    <p className="text-sm leading-relaxed">{item}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="areas" className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">CQC areas reviewed</h2>
            <p className="text-muted-foreground leading-relaxed max-w-3xl mb-10">
              The audit is mapped to the five questions CQC uses most often when assessing provider quality.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {cqcAreas.map((area, i) => (
              <ScrollReveal key={area.title} delay={i * 60}>
                <Card className="h-full border">
                  <CardContent className="p-6">
                    <Badge variant="outline" className="mb-3">
                      {area.title}
                    </Badge>
                    <p className="text-sm text-muted-foreground leading-relaxed">{area.desc}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">Why providers choose this</h2>
            <p className="text-[hsl(36,33%,97%)]/70 leading-relaxed max-w-3xl mb-10">
              The service is built to be direct, practical and easy to act on when time is limited.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reasons.map((item, i) => (
              <ScrollReveal key={item} delay={i * 50}>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mt-1 h-5 w-5 rounded-full bg-[hsl(36,33%,97%)] text-[hsl(220,50%,15%)] flex items-center justify-center text-[10px] font-semibold shrink-0">
                    ✓
                  </div>
                  <p className="text-sm leading-relaxed text-[hsl(36,33%,97%)]/85">{item}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-6 md:px-10 lg:px-12">
          <ScrollReveal>
            <div className="rounded-2xl border bg-muted/30 p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-3">Disclaimer</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                BizCompliance CQC is an independent compliance audit service. We are not the Care Quality Commission and cannot guarantee inspection outcomes. Our audits are designed to help providers identify risks, improve evidence and prepare more confidently.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
              >
                Book Your CQC Audit
              </Link>
              <Link
                href="#included"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                See What’s Included
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
