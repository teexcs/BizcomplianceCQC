import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AlertCircle, AlertTriangle, CheckCircle2, FileDown, Lock } from 'lucide-react';
import { getScan } from '@/lib/scanner/run';
import { CATEGORY_LABELS, type CheckCategory, type CheckResult } from '@/lib/scanner/checks';
import { ScoreDial, ScoreBarRow } from '@/components/score-dial';
import { ScanGate } from '@/components/scan/scan-gate';
import { CheckoutButton } from '@/components/site/checkout-button';
import { PLANS } from '@/lib/stripe/plans';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Website compliance results — BizCompliance',
  robots: { index: false }, // results are private to whoever holds the link
};

function scoreMessage(score: number): string {
  if (score >= 9) return 'Compliant — keep everything current.';
  if (score >= 6) return 'Not there yet — important issues need attention.';
  return 'Critical — address the urgent issues first.';
}

/** Score-aware opening line for the audit conversion block. */
function auditPitch(score: number): string {
  if (score >= 9)
    return 'Your website is compliant — but a good public page tells inspectors nothing about your evidence base.';
  if (score >= 6)
    return 'Your website already shows compliance gaps — and it is the part of your service you control most easily.';
  return 'If your public website is missing this much, an inspector reviewing your full evidence base will find far more.';
}

export default async function ScanResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  await searchParams; // paid=1 just triggers a fresh server render post-checkout
  const scan = await getScan(id);
  if (!scan) notFound();

  const failing = scan.results.filter((r) => !r.passed);
  const urgent = failing.filter((r) => r.severity === 'urgent');
  const important = failing.filter((r) => r.severity === 'important');
  const passing = scan.results.filter((r) => r.passed);
  const scannedOn = new Date(scan.createdAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="pt-24 md:pt-28 pb-20 bg-[hsl(220,20%,97%)] min-h-screen">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Audit results
            </span>
            <span className="font-semibold text-[hsl(220,33%,8%)]">{scan.domain}</span>
            {scan.companyName ? (
              <span className="text-sm text-muted-foreground">{scan.companyName}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Scanned {scannedOn} · {scan.pagesScanned} pages
            </span>
            {scan.paid ? (
              <a
                href={`/api/scan/${scan.id}/report`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <FileDown size={13} aria-hidden="true" /> Download PDF
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: score + breakdown + issues */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-white p-6 md:p-8">
              <div className="grid gap-8 sm:grid-cols-2 items-center">
                <div className="flex flex-col items-center text-center">
                  <ScoreDial pct={scan.score * 10} display={scan.score.toFixed(1)} caption="/10" />
                  <h1 className="mt-4 font-display text-xl tracking-tight">Compliance Score</h1>
                  <p className="mt-1.5 text-sm text-muted-foreground max-w-[240px]">
                    {scoreMessage(scan.score)}
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold mb-4">Score breakdown</h2>
                  <div className="space-y-3">
                    {scan.categoryScores.map((c) => (
                      <ScoreBarRow
                        key={c.category}
                        label={c.label}
                        pct={c.score * 10}
                        display={`${c.score.toFixed(1)}/10`}
                      />
                    ))}
                  </div>
                  <div className="mt-5 space-y-1.5">
                    <SummaryRow tone="red" icon={AlertCircle} label="Urgent issues found" count={scan.urgent} />
                    <SummaryRow tone="orange" icon={AlertTriangle} label="Important issues" count={scan.important} />
                    <SummaryRow tone="green" icon={CheckCircle2} label="Passed checks" count={scan.passed} />
                  </div>
                </div>
              </div>
            </div>

            {/* Issues */}
            <div className="rounded-2xl border border-border bg-white p-6 md:p-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-5">
                Issues found
              </h2>
              <ul className="space-y-3">
                {[...urgent, ...important].map((check) => (
                  <IssueRow key={check.id} check={check} paid={scan.paid} />
                ))}
                {failing.length === 0 ? (
                  <li className="text-sm text-muted-foreground py-6 text-center">
                    No failing checks — outstanding.
                  </li>
                ) : null}
              </ul>

              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Passed checks ({passing.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {passing.map((check) => (
                    <li key={check.id} className="flex items-start gap-3 rounded-xl border border-border/60 px-4 py-3">
                      <CheckCircle2 size={17} className="text-[hsl(152,45%,34%)] mt-0.5 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{check.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{check.summary}</p>
                      </div>
                      <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[check.category as CheckCategory]}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          {/* Right rail — the one-off audit is the primary conversion */}
          <div className="space-y-5">
            {/* PRIMARY: full CQC readiness audit */}
            <div className="relative overflow-hidden rounded-2xl border border-[hsl(220,45%,45%)]/30 bg-[hsl(220,50%,15%)] text-white p-5 shadow-[0_18px_50px_-24px_rgba(21,32,58,0.6)]">
              <div
                aria-hidden="true"
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full"
                style={{ background: 'radial-gradient(closest-side, rgba(120,150,220,0.35), transparent)' }}
              />
              <div className="relative">
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  Recommended next step
                </span>
                <h3 className="mt-3 font-display text-lg tracking-tight">
                  This is your shop window. Your inspection goes far deeper.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/72">
                  {auditPitch(scan.score)} A CQC inspection assesses{' '}
                  <strong className="text-white">139 evidence points across 18 areas</strong> — Safe,
                  Effective, Caring, Responsive and Well-led. Our one-off readiness audit reviews
                  every one of them, manually, in 48 hours.
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl">£{PLANS.audit.priceGbp}</span>
                  <span className="text-xs text-white/60">one-off · 48-hour report</span>
                </div>
                <div className="mt-4">
                  <CheckoutButton
                    planId="audit"
                    label="Book your CQC readiness audit"
                    className="w-full bg-white text-[hsl(220,50%,15%)] hover:bg-white/90 font-semibold"
                  />
                </div>
                <ul className="mt-4 space-y-1.5">
                  {[
                    'Readiness score + red / amber / green per area',
                    'Priority action plan with fix-first deadlines',
                    'The missing documents issued to your vault',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs text-white/72">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-white/80" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SECONDARY: the £8.99 website report / email capture */}
            {!scan.paid ? (
              <div>
                <p className="mb-2 px-1 text-xs text-muted-foreground">
                  Just want the website fixes for now?
                </p>
                <ScanGate scanId={scan.id} initialEmailCaptured={Boolean(scan.email)} />
              </div>
            ) : (
              <div className="rounded-2xl border border-[hsl(152,47%,38%)]/40 bg-[hsl(152,47%,38%)]/[0.06] p-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <CheckCircle2 size={16} className="text-[hsl(152,45%,30%)]" aria-hidden="true" />
                  <h3 className="font-display text-base tracking-tight">Website report unlocked</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every fix below is visible and your PDF is ready to download from the top of the
                  page. When you&apos;re ready for the full picture, the readiness audit above covers
                  your whole service.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-white p-5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
                Next steps
              </h3>
              <ol className="space-y-3">
                {[
                  { t: 'Fix urgent issues', d: 'These carry legal or safety risk — top priority.' },
                  { t: 'Book your readiness audit', d: 'Cover all 139 evidence points, not just your website.' },
                  { t: 'Re-run your scan', d: 'See your improved score once changes are live.' },
                ].map((step, i) => (
                  <li key={step.t} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full border border-border grid place-items-center text-xs font-semibold shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{step.t}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  tone,
  icon: Icon,
  label,
  count,
}: {
  tone: 'red' | 'orange' | 'green';
  icon: typeof AlertCircle;
  label: string;
  count: number;
}) {
  const colors = {
    red: 'text-[hsl(4,65%,42%)] bg-[hsl(4,72%,48%)]/[0.07]',
    orange: 'text-[hsl(24,80%,38%)] bg-[hsl(24,85%,50%)]/[0.08]',
    green: 'text-[hsl(152,45%,28%)] bg-[hsl(152,47%,38%)]/[0.08]',
  };
  return (
    <div className={cn('flex items-center justify-between rounded-lg px-3 py-2', colors[tone])}>
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Icon size={15} aria-hidden="true" /> {label}
      </span>
      <span className="text-sm font-bold tabular-nums">{count}</span>
    </div>
  );
}

function IssueRow({ check, paid }: { check: CheckResult; paid: boolean }) {
  const urgentStyle = check.severity === 'urgent';
  return (
    <li className="rounded-xl border border-border px-4 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        {urgentStyle ? (
          <AlertCircle size={17} className="text-[hsl(4,65%,45%)] mt-0.5 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle size={17} className="text-[hsl(24,80%,42%)] mt-0.5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{check.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{check.summary}</p>

          {/* The fix: real content, blurred until paid (screen-reader hidden too) */}
          <div className="mt-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              How to fix
            </p>
            {paid ? (
              <p className="text-xs leading-relaxed text-[hsl(220,25%,25%)]">{check.fix}</p>
            ) : (
              <div className="relative" aria-hidden="true">
                <p className="text-xs leading-relaxed text-[hsl(220,25%,25%)] blur-[7px] select-none pointer-events-none">
                  {check.fix}
                </p>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                    <Lock size={11} aria-hidden="true" /> In the full report
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
            urgentStyle
              ? 'bg-[hsl(4,72%,48%)]/10 text-[hsl(4,65%,42%)]'
              : 'bg-[hsl(24,85%,50%)]/10 text-[hsl(24,80%,38%)]',
          )}
        >
          {check.severity}
        </span>
      </div>
    </li>
  );
}
