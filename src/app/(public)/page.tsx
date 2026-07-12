'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Star,
  FileText,
  FolderLock,
  ClipboardCheck,
  Bell,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeroSignup } from '@/components/site/hero-signup';
import { ScanWidget } from '@/components/site/scan-widget';
import { ScoreDial } from '@/components/score-dial';
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
        'transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const NAVY = 'hsl(220,50%,15%)';
const ACCENT = 'hsl(220,45%,38%)';

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const stats = [
  { value: '100%', label: 'Evidence review', sub: 'across your whole service' },
  { value: '18', label: 'CQC compliance areas', sub: 'mapped to the regulations' },
  { value: '68', label: 'SAF interview questions', sub: 'the way inspectors assess' },
  { value: '48h', label: 'Report turnaround', sub: 'from evidence to action plan' },
];

const steps = [
  {
    n: '01',
    title: 'Create your workspace',
    desc: 'Five minutes, no card. Tell us your service type and your secure evidence vault opens immediately.',
  },
  {
    n: '02',
    title: 'Upload your evidence',
    desc: 'Drop in the policies, registers and records you already use. Everything is organised against the 18 CQC areas.',
  },
  {
    n: '03',
    title: 'Get your report in 48 hours',
    desc: 'A readiness score, red / amber / green findings per area, a priority action plan — and the documents you were missing, issued to your vault.',
  },
];

const keyQuestions = [
  { title: 'Safe', desc: 'Safeguarding, medicines, staffing and risk controls, clearly evidenced.' },
  { title: 'Effective', desc: 'Care planning, consent, competence and training records that hold up.' },
  { title: 'Caring', desc: 'Dignity, privacy and involvement, visible in the paperwork.' },
  { title: 'Responsive', desc: 'Complaints, continuity and documented responses to needs.' },
  { title: 'Well-led', desc: 'Governance, oversight and learning that leadership can prove.' },
];

const monthlyPlans = [PLANS.essentials, PLANS.professional, PLANS.partner];

/* ------------------------------------------------------------------ */
/* Decorative product vignettes (pure CSS/SVG — no images)             */
/* ------------------------------------------------------------------ */

function RagChip({ tone, label, count }: { tone: 'green' | 'amber' | 'red'; label: string; count: number }) {
  const tones = {
    green: 'bg-[hsl(152,47%,42%)]/10 text-[hsl(152,45%,26%)]',
    amber: 'bg-[hsl(40,89%,52%)]/12 text-[hsl(35,80%,30%)]',
    red: 'bg-[hsl(8,76%,55%)]/10 text-[hsl(8,60%,38%)]',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', tones[tone])}>
      <span className="tabular-nums">{count}</span> {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <main>
      {/* ================= HERO ================= */}
      <section id="start" className="relative overflow-hidden">
        {/* Layered atmosphere */}
        <div
          aria-hidden="true"
        className="absolute inset-0"
          style={{
            background:
              'radial-gradient(56rem 32rem at 82% -8%, rgba(77,120,214,0.18), transparent 60%), radial-gradient(48rem 30rem at 8% 12%, rgba(21,32,58,0.08), transparent 55%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(21,32,58,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(21,32,58,0.045) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(80rem 40rem at 50% 0%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(80rem 40rem at 50% 0%, black, transparent 75%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10 lg:px-12 pt-28 md:pt-36 pb-20 md:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-10 items-start">
            <Reveal className="lg:col-span-7 pt-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-xs font-medium tracking-wide text-foreground backdrop-blur">
                <ShieldCheck size={14} className="text-primary" aria-hidden="true" />
                CQC readiness for UK care providers
              </p>

              <h1 className="mt-7 font-display text-[2.75rem] leading-[1.05] md:text-6xl lg:text-[4.25rem] tracking-tight text-foreground max-w-3xl">
                Walk into your CQC inspection{' '}
                <em className="not-italic md:italic text-primary">already knowing</em>{' '}
                exactly where you stand.
              </h1>

              <p className="mt-7 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                A specialist readiness review of your service against all 18 CQC compliance areas —
                readiness score, risk-rated findings, priority action plan, and the missing
                documents issued straight to your vault. In 48 hours.
              </p>

              <ul className="mt-9 space-y-3.5 max-w-xl">
              {[
                  'Reviewed against your actual evidence, not generated from a tick-box questionnaire',
                  'Mapped to the HSCA 2008 regulations and the Single Assessment Framework',
                  'Backed by a specialist care compliance library',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-[15px] text-foreground">
                    <Star
                      aria-hidden="true"
                      size={12}
                      strokeWidth={2.2}
                      fill="currentColor"
                      className="mt-1.5 shrink-0 text-[#111111] dark:text-white"
                    />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-display text-sm text-muted-foreground line-through">
                      £795
                    </span>
                    <span className="font-display text-3xl text-foreground">
                      £{PLANS.audit.priceGbp}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground leading-tight">
                    Limited-time rate
                    <br />
                    48-hour delivery
                  </span>
                </div>
                <div aria-hidden="true" className="hidden sm:block h-10 w-px bg-border" />
                <Link
                  href="#scanner"
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-[hsl(220,50%,15%)] bg-white/95 px-5 h-11 text-sm font-semibold text-[hsl(220,50%,15%)] shadow-[0_10px_28px_-14px_rgba(21,21,21,0.35)] backdrop-blur-md transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-14px_rgba(21,21,21,0.42)]"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -translate-x-[140%] rounded-[inherit] bg-[linear-gradient(110deg,transparent_18%,rgba(255,255,255,0.95)_35%,rgba(255,255,255,0.35)_46%,transparent_60%)] mix-blend-soft-light motion-safe:animate-[glass-shine_4.8s_ease-in-out_infinite]"
                  />
                  <span className="relative">Run a free audit</span>
                </Link>
                <Link
                  href="/how-it-works"
                  className="group inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  See how it works
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </Reveal>

            <Reveal className="lg:col-span-5" delay={140}>
              <HeroSignup />
            </Reveal>
          </div>
        </div>

        {/* Credential strip */}
        <div className="relative border-t border-border/70 bg-background/50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12 py-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>HSCA 2008 Regulated Activities</span>
            <span aria-hidden="true" className="hidden md:inline h-1 w-1 rounded-full bg-[hsl(220,45%,38%)]/60" />
            <span>CQC Single Assessment Framework</span>
            <span aria-hidden="true" className="hidden md:inline h-1 w-1 rounded-full bg-[hsl(220,45%,38%)]/60" />
            <span>UK GDPR &amp; DPA 2018</span>
            <span aria-hidden="true" className="hidden md:inline h-1 w-1 rounded-full bg-[hsl(220,45%,38%)]/60" />
            <span>Mental Capacity Act 2005</span>
          </div>
        </div>
      </section>

      {/* ================= FREE WEBSITE SCANNER ================= */}
      <section id="scanner" className="py-16 md:py-24 bg-muted/40 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Free compliance check
              </p>
              <h2 className="font-display text-3xl md:text-5xl tracking-tight max-w-xl">
                Is your website letting your service down?
              </h2>
              <p className="mt-5 text-muted-foreground leading-relaxed max-w-lg">
                Our scanner crawls your website page by page and runs 19 real compliance checks —
                privacy and cookies, company law disclosures, security, and the care-specific
                duties most sites miss, like displaying your CQC rating (a legal requirement).
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-foreground">
                <li className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Free score and full list of what&apos;s missing — instantly
                </li>
                <li className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Fix-by-fix remediation report with PDF — £8.99
                </li>
                <li className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                  No signup needed to see your score
                </li>
              </ul>
            </Reveal>
            <Reveal delay={120} className="flex lg:justify-end">
              <ScanWidget />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 70}>
                <div
                  className={cn(
                    'px-6 py-6 md:py-4',
                    i > 0 && 'lg:border-l lg:border-border',
                    i % 2 === 1 && 'border-l border-border lg:border-l',
                  )}
                >
                  <p className="font-display text-4xl md:text-5xl tracking-tight text-foreground tabular-nums">
                    {s.value}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="py-16 md:py-24 bg-muted/40 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              How it works
            </p>
            <h2 className="font-display text-3xl md:text-5xl tracking-tight max-w-2xl">
              From sign-up to inspection-ready in three moves
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div aria-hidden="true" className="hidden md:block absolute top-7 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {steps.map((step, i) => (
              <Reveal key={step.n} delay={i * 110}>
                <div className="relative rounded-2xl border border-border bg-card p-7 h-full shadow-[0_10px_40px_-18px_rgba(21,21,21,0.12)]">
                  <div className="w-14 h-14 rounded-2xl grid place-items-center font-display text-lg text-primary-foreground mb-5"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, hsl(220,45%,24%))` }}
                  >
                    {step.n}
                  </div>
                  <h3 className="font-display text-xl tracking-tight mb-2.5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= BENTO / PRODUCT ================= */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Scoring
            </p>
            <h2 className="font-display text-3xl md:text-5xl tracking-tight max-w-2xl">
              One workspace for your whole compliance position
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-6 gap-5">
            {/* Score card — large */}
            <Reveal className="md:col-span-3">
              <div className="h-full rounded-2xl border border-border bg-card p-7 md:p-8 shadow-[0_10px_40px_-18px_rgba(21,21,21,0.12)]">
                <div className="flex flex-wrap items-center gap-8">
                  <ScoreDial pct={76} display="76" caption="/100" size={144} />
                  <div className="flex-1 min-w-[180px]">
                    <h3 className="font-display text-xl tracking-tight">Your readiness score</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      One number, recalculated as your evidence improves — weighted so legally
                      required documents count most.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <RagChip tone="green" label="compliant" count={9} />
                      <RagChip tone="amber" label="improve" count={6} />
                      <RagChip tone="red" label="critical" count={3} />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Action plan — large */}
            <Reveal className="md:col-span-3" delay={90}>
              <div className="h-full rounded-2xl border border-border bg-card p-7 md:p-8 shadow-[0_10px_40px_-18px_rgba(21,21,21,0.12)]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-muted grid place-items-center">
                      <ListChecks size={18} className="text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-xl tracking-tight">Priority action plan</h3>
                </div>
                <ul className="space-y-2.5">
                  {[
                    { text: 'DBS risk assessments missing for 2 staff files', tag: 'Fix first', tone: 'text-[hsl(0,0%,28%)] bg-muted' },
                    { text: 'Medication error log supplied but not analysed', tag: '7 days', tone: 'text-[hsl(0,0%,34%)] bg-muted' },
                    { text: 'Governance action log needs owners and dates', tag: '14 days', tone: 'text-[hsl(0,0%,34%)] bg-muted' },
                  ].map((row) => (
                    <li key={row.text} className="flex items-center justify-between gap-3 rounded-xl border border-border/80 px-4 py-3">
                      <span className="text-sm text-foreground">{row.text}</span>
                      <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0', row.tone)}>
                        {row.tag}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Four small cells */}
            {[
              {
                icon: FolderLock,
                title: 'Secure evidence vault',
                desc: 'Upload policies, registers and records — organised against the 18 areas, reviewed by your auditor.',
              },
              {
                icon: FileText,
                title: 'Documents, issued',
                desc: 'Gaps are closed from a specialist document library, version-controlled into your vault.',
              },
              {
                icon: ClipboardCheck,
                title: 'SAF interview prep',
                desc: 'The 68 questions inspectors use as a framework — answered and evidenced before they ask.',
              },
              {
                icon: Bell,
                title: 'Regulatory alerts',
                desc: 'When CQC guidance moves, you hear about it in plain English, mapped to the key questions.',
              },
            ].map((cell, i) => (
              <Reveal key={cell.title} className="md:col-span-3 lg:col-span-3 xl:col-span-3" delay={i * 70}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-[0_14px_44px_-20px_rgba(21,21,21,0.16)] transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center shrink-0">
                      <cell.icon size={16} className="text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-lg tracking-tight">{cell.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cell.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FIVE KEY QUESTIONS ================= */}
      <section id="areas" className="py-20 md:py-28 text-primary-foreground" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, hsl(220,45%,11%) 100%)` }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Assessed the way CQC assesses
            </p>
            <h2 className="font-display text-3xl md:text-5xl tracking-tight max-w-2xl">
              The five key questions, answered with evidence
            </h2>
            <p className="mt-4 text-primary-foreground/70 max-w-2xl leading-relaxed">
              Every finding in your report maps to the question an inspector would raise it under —
              so nothing in your rating comes as a surprise.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {keyQuestions.map((q, i) => (
              <Reveal key={q.title} delay={i * 70}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.05] p-5 hover:bg-white/[0.08] transition-colors">
                  <p className="font-display text-primary text-sm mb-2">0{i + 1}</p>
                  <h3 className="font-display text-xl tracking-tight mb-2">{q.title}</h3>
                  <p className="text-[13px] leading-relaxed text-primary-foreground/70">{q.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRICING PREVIEW ================= */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Pricing
            </p>
            <h2 className="font-display text-3xl md:text-5xl tracking-tight max-w-2xl">
              Start with the audit. Stay ready every month.
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
            {/* Audit card */}
            <Reveal className="lg:col-span-2">
              <div className="h-full rounded-2xl p-8 text-primary-foreground relative overflow-hidden flex flex-col"
                style={{ background: `linear-gradient(150deg, ${NAVY}, hsl(220,45%,22%))` }}
              >
                <div aria-hidden="true" className="absolute -top-20 -right-20 w-64 h-64 rounded-full"
                  style={{ background: 'radial-gradient(closest-side, rgba(77,120,214,0.35), transparent)' }}
                />
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  One-off · 48 hours
                </p>
                <h3 className="mt-3 font-display text-2xl tracking-tight">CQC Readiness Audit</h3>
                <p className="mt-3 text-sm leading-relaxed text-primary-foreground/75 flex-1">
                  {PLANS.audit.description}
                </p>
                <div className="mt-6 flex items-end gap-3">
                  <span className="font-display text-sm text-primary-foreground/60 line-through">
                    £795
                  </span>
                  <span className="font-display text-5xl">£{PLANS.audit.priceGbp}</span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.15em] text-primary-foreground/60">
                  Limited-time rate
                </p>
                <div className="mt-6">
                  <CheckoutButton
                    planId="audit"
                    label="Book your audit"
                    className="w-full bg-background text-foreground hover:bg-muted h-12 font-semibold"
                  />
                </div>
              </div>
            </Reveal>

            {/* Monthly plans */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {monthlyPlans.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 80} className="h-full">
                  <div
                    className={cn(
                      'h-full rounded-2xl border bg-card p-6 flex flex-col',
                      plan.popular
                        ? 'border-primary/40 shadow-[0_16px_48px_-20px_rgba(21,21,21,0.2)]'
                        : 'border-border',
                    )}
                  >
                    {plan.popular ? (
                      <span className="inline-flex items-center gap-1 self-start rounded-full bg-muted text-foreground text-[11px] font-bold px-2.5 py-1 mb-3">
                        <Sparkles size={11} aria-hidden="true" /> Most popular
                      </span>
                    ) : (
                      <span className="h-[26px] mb-3" aria-hidden="true" />
                    )}
                    <h3 className="font-display text-lg tracking-tight">{plan.name}</h3>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed flex-1">
                      {plan.description}
                    </p>
                    <p className="mt-4">
                      <span className="font-display text-3xl">£{plan.priceGbp}</span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </p>
                    <Link
                      href="/pricing"
                      className="mt-4 inline-flex items-center justify-center rounded-lg border border-border h-10 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      See details
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= WHAT YOU RECEIVE ================= */}
      <section className="py-20 md:py-24 bg-muted/40 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              The deliverable
            </p>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight">
              A report your team can act on the same day
            </h2>
            <ul className="mt-8 space-y-4">
              {[
                'Executive summary of your readiness position',
                'Red / amber / green rating for each of the 18 areas',
                'Every finding tied to the regulation it engages',
                'Priority actions with fix-first, 7-day and 14-day windows',
                'The missing documents, issued to your vault with version control',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-[15px] text-foreground">
                  <ShieldCheck size={17} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#start"
                className="inline-flex items-center justify-center gap-2 rounded-lg h-12 px-7 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Create your free account <ArrowRight size={15} aria-hidden="true" />
              </a>
              <Link
                href="/case-studies"
                className="inline-flex items-center justify-center rounded-lg h-12 px-7 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
              >
                See worked examples
              </Link>
            </div>
          </Reveal>

          {/* Report vignette */}
          <Reveal delay={120}>
            <div className="relative mx-auto max-w-md">
              <div aria-hidden="true" className="absolute -inset-4 rounded-[1.75rem] bg-[radial-gradient(closest-side,rgba(21,32,58,0.14),transparent)] blur-xl" />
              <div className="relative rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                <div className="px-6 py-5" style={{ background: NAVY }}>
                  <p className="font-display text-muted-foreground">BizCompliance</p>
                  <p className="mt-2 font-display text-xl text-primary-foreground">CQC Readiness Audit</p>
                  <p className="text-xs text-primary-foreground/70 mt-1">Confidential · Prepared for the registered manager</p>
                </div>
                <div className="p-6 space-y-3">
                  {[
                    { area: 'Safe recruitment & DBS', rag: 'RED', tone: 'text-[hsl(8,60%,38%)]' },
                    { area: 'Medicines management', rag: 'AMBER', tone: 'text-[hsl(35,80%,30%)]' },
                    { area: 'Safeguarding adults', rag: 'GREEN', tone: 'text-[hsl(152,45%,26%)]' },
                    { area: 'Governance, QA & records', rag: 'AMBER', tone: 'text-[hsl(35,80%,30%)]' },
                    { area: 'Person-centred care', rag: 'GREEN', tone: 'text-[hsl(152,45%,26%)]' },
                  ].map((row) => (
                    <div key={row.area} className="flex items-center justify-between border-b border-border/70 pb-2.5 last:border-0">
                      <span className="text-sm text-foreground">{row.area}</span>
                      <span className={cn('text-xs font-bold tracking-wide', row.tone)}>{row.rag}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Readiness score</span>
                    <span className="font-display text-2xl">76<span className="text-sm text-muted-foreground">/100</span></span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 md:px-10 lg:px-12">
          <Reveal>
            <div
              className="relative overflow-hidden rounded-3xl px-8 py-14 md:px-16 md:py-20 text-center text-primary-foreground"
              style={{ background: `linear-gradient(160deg, ${NAVY}, hsl(220,45%,10%))` }}
            >
              <div aria-hidden="true" className="absolute inset-0"
                style={{ background: 'radial-gradient(40rem 20rem at 50% 120%, rgba(77,120,214,0.25), transparent 70%)' }}
              />
              <div className="relative">
                  <h2 className="font-display text-3xl md:text-5xl tracking-tight">
                  Be inspection-ready <em className="text-muted-foreground">before</em> the
                  inspector books the visit.
                </h2>
                <p className="mt-5 text-primary-foreground/75 max-w-xl mx-auto leading-relaxed">
                  Create your workspace in five minutes. Upload your evidence today. Know exactly
                  where you stand within 48 hours.
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="#start"
                    className="inline-flex items-center justify-center gap-2 rounded-lg h-12 px-8 text-sm font-semibold bg-background text-foreground hover:bg-muted transition-colors"
                  >
                    Create free account <ArrowRight size={15} aria-hidden="true" />
                  </a>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center rounded-lg h-12 px-8 text-sm font-medium border border-white/25 hover:bg-white/10 transition-colors"
                  >
                    Talk to us first
                  </Link>
                </div>
                <p className="mt-8 text-xs text-primary-foreground/60 max-w-lg mx-auto leading-relaxed">
                  BizCompliance is an independent compliance audit service. We are not the Care
                  Quality Commission and cannot guarantee inspection outcomes.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
