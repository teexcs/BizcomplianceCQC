'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ShieldCheck, UserRound, FileCheck2, MessageSquareQuote, CircleX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function Reveal({
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

const principles = [
  {
    icon: ShieldCheck,
    title: 'Built for CQC, not generic business compliance',
    desc: 'Everything is written around the 18 CQC compliance areas and the Single Assessment Framework, so the language matches what buyers actually need.',
  },
  {
    icon: FileCheck2,
    title: 'Manual review, not automated filler',
    desc: 'Reports are checked by a human. The service is designed to surface missing evidence, not to hide it behind vague scoring language.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Plain English, same day clarity',
    desc: 'Clients should know what is missing, what matters first, and what to do next without decoding legal jargon.',
  },
  {
    icon: UserRound,
    title: 'A named founder, not an anonymous team',
    desc: 'Clients can see who is behind the service, who is accountable, and what the business does and does not do.',
  },
];

const standards = [
  'One-off CQC readiness audit with a clear turnaround',
  'Dashboard-led onboarding and evidence uploads',
  'Actionable findings written for registered managers and providers',
  'Clear boundaries: compliance support, not legal advice',
];

const boundaries = [
  'We do not claim to be solicitors or a law firm',
  'We do not promise inspection outcomes',
  'We do not use AI to write compliance content',
  'We do not hide behind generic SMB language',
];

export default function AboutPage() {
  return (
    <div className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground mb-4">
            About
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight max-w-4xl">
            Built for{' '}
            <span className="text-[hsl(220,33%,8%)]">
              CQC
            </span>{' '}
            by teexcs
          </h1>
          <p className="mt-6 max-w-3xl text-lg md:text-xl leading-relaxed text-muted-foreground">
            BizCompliance CQC is a focused compliance practice for UK care providers. It exists to
            make the audit, the evidence trail, and the next steps feel clear, accountable, and
            professional.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start mt-14 md:mt-16">
          <Reveal className="lg:col-span-4">
            <Card className="overflow-hidden border border-border bg-card shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
              <div className="relative aspect-[4/5] bg-muted">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=720&h=900&fit=crop&crop=face"
                  alt="Founder portrait"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(17,23,34,0.55)] via-transparent to-transparent" />
                <div className="absolute left-4 bottom-4 right-4 rounded-none border border-white/20 bg-[rgba(17,23,34,0.72)] px-4 py-3 text-primary-foreground backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/70">
                    Founder
                  </p>
                  <p className="mt-1 font-display text-2xl">teexcs</p>
                  <p className="mt-1 text-sm text-primary-foreground/75">
                    BizCompliance CQC
                  </p>
                </div>
              </div>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm font-medium text-foreground">
                  Named founder. Direct accountability. No anonymous team framing.
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The business is intentionally small and focused so clients always know who they
                  are dealing with and what the service is responsible for.
                </p>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal className="lg:col-span-8" delay={120}>
            <div className="space-y-6">
              <p className="text-lg leading-relaxed">
                BizCompliance CQC is built around the things buyers actually check before they
                trust a provider: who is behind the business, what the service covers, how the
                evidence is reviewed, and whether the language matches the sector.
              </p>
              <p className="text-lg leading-relaxed">
                This is not broad SMB compliance copy. It is CQC-native work for care providers who
                need a readiness audit, a structured dashboard, and plain-English next steps that
                make sense to a registered manager.
              </p>
              <p className="text-lg leading-relaxed">
                The service is designed to be honest about its scope. We review evidence, map it to
                the regulations, identify the gaps, and show what needs to happen next. If you need
                legal advice, you should instruct a regulated solicitor.
              </p>
              <blockquote className="border-l-2 border-[hsl(220,45%,45%)] pl-6 py-2 text-xl md:text-2xl italic font-display text-foreground">
                Clients should not have to guess who runs the business or what the product does.
                They should see a named founder, a clear method, and a service that tells the truth
                about compliance.
              </blockquote>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-20 md:mt-24">
          <h2 className="font-display text-2xl md:text-3xl tracking-tight">
            What clients can expect
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">
          {principles.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={index * 90}>
                <Card className="h-full border border-border bg-card">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex h-11 w-11 items-center justify-center border border-border bg-muted">
                      <Icon size={18} className="text-primary" aria-hidden="true" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-display text-lg tracking-tight">{item.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-20 md:mt-24">
          <Reveal>
            <Card className="h-full border border-border bg-muted/30">
              <CardContent className="p-6 md:p-8">
                <h2 className="font-display text-2xl md:text-3xl tracking-tight">How we work</h2>
                <ul className="mt-6 space-y-3">
                  {standards.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-[15px] leading-relaxed">
                      <Check
                        size={15}
                        strokeWidth={2.6}
                        className="mt-1 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={120}>
            <Card className="h-full border border-border bg-card">
              <CardContent className="p-6 md:p-8">
                <h2 className="font-display text-2xl md:text-3xl tracking-tight">What we do not do</h2>
                <ul className="mt-6 space-y-3">
                  {boundaries.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground">
                      <CircleX
                        size={15}
                        strokeWidth={2.6}
                        className="mt-1 shrink-0 text-destructive"
                        aria-hidden="true"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div className="mt-20 md:mt-24 rounded-3xl border border-border bg-[linear-gradient(160deg,hsl(36,33%,99%),hsl(220,35%,96%))] p-8 md:p-10">
            <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] items-start">
              <div className="space-y-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Honest credential line
                </p>
                <h2 className="font-display text-2xl md:text-3xl tracking-tight">
                  BizCompliance is a compliance system, not legal advice.
                </h2>
                <p className="max-w-2xl text-sm md:text-base leading-relaxed text-muted-foreground">
                  For advice on your individual circumstances, instruct a regulated solicitor. That
                  boundary is deliberate and it stays visible because trust starts with honesty.
                </p>
              </div>
              <div className="rounded-none border border-border bg-background p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Office</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  BizCompliance Ltd
                  <br />
                  12 Farringdon Road
                  <br />
                  London EC1M 3EN
                  <br />
                  United Kingdom
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
