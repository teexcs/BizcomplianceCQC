import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileDown,
  Minus,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PlanPanel } from '@/components/dashboard/plan-panel';
import { ScoreTrend } from '@/components/dashboard/score-trend';
import { ScoreChangePanel } from '@/components/dashboard/score-change-panel';
import { ScoreBreakdownPanel } from '@/components/dashboard/score-breakdown';
import { StartAuditButton } from '@/components/dashboard/start-audit-button';
import { ScoreDial, ScoreBarRow } from '@/components/score-dial';
import { requireOrgSession, getRequestUsageThisMonth } from '@/lib/data/session';
import {
  getCalendarEvents,
  getAlerts,
  getIssuedDocuments,
  getLatestAudit,
  getLibraryAreas,
  getBenchmark,
  getScoreTrend,
  getLatestScoreChange,
  getSafDomainScores,
  getAuditCompleteness,
  getScoreBreakdown,
} from '@/lib/data/client';
import { getVaultCoverage } from '@/lib/engine/reader/adapter';
import { ragCounts, AUDIT_STATUS_LABELS, FINDING_PRIORITY_LABELS } from '@/lib/audit/scoring';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage() {
  const ctx = await requireOrgSession();
  const [latest, documents, events, libraryAreas, requestsUsed, alerts] = await Promise.all([
    getLatestAudit(ctx.org.id),
    getIssuedDocuments(ctx.org.id),
    getCalendarEvents(ctx.org.id),
    getLibraryAreas(),
    getRequestUsageThisMonth(ctx.org.id),
    getAlerts(ctx.userId),
  ]);

  const areaName = new Map(libraryAreas.map((a) => [a.code, a.name]));
  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const auditCompleted = latest ? ['delivered', 'closed'].includes(latest.audit.status) : false;
  // Real engine-computed coverage (only needed pre-delivery, for the strip).
  const coverage = !auditCompleted ? await getVaultCoverage(ctx.org.id) : null;
  const coveragePct =
    coverage && coverage.libraryTotal > 0
      ? Math.round((coverage.matched / coverage.libraryTotal) * 100)
      : 0;

  const onboardingSteps = [
    {
      label: 'Step 1',
      title: 'Book your CQC audit',
      body: 'This starts the one-off audit that unlocks the rest of the workspace.',
      href: '/pricing',
    },
    {
      label: 'Step 2',
      title: 'Upload policies and evidence',
      body: 'The vault files documents into the right CQC area as you add them.',
      href: '/dashboard/evidence',
    },
    {
      label: 'Step 3',
      title: 'Use the compliance calendar',
      body: 'Deadlines and reminders stay visible in a proper calendar view.',
      href: '/dashboard/calendar',
    },
  ];

  const onboardingStrip = !auditCompleted ? (
    <section className="space-y-4 border-b border-border/70 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Onboarding
          </p>
          <h1 className="font-display text-3xl tracking-tight">
            {latest ? 'Welcome back' : `Welcome, ${ctx.org.name}`}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Complete the setup in order so the dashboard, evidence vault and admin workflow all
            work the same way every time.
          </p>
        </div>
        {latest ? (
          <Link
            href="/dashboard/evidence"
            className="inline-flex items-center gap-2 rounded-none border border-[hsl(220,50%,15%)] bg-[hsl(220,50%,15%)] px-4 py-2.5 text-sm font-medium text-[hsl(36,33%,97%)] transition-colors hover:bg-[hsl(220,50%,20%)]"
          >
            Upload evidence <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <StartAuditButton label="Start audit workspace" />
        )}
      </div>

      {coverage ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Library coverage — matched against the {coverage.libraryTotal}-document compliance library</span>
            <span>
              {coverage.matched}/{coverage.libraryTotal} documents · {coverage.areasCovered}/
              {coverage.areasTotal} areas
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-[hsl(220,50%,15%)] transition-all"
              style={{ width: `${Math.max(coveragePct, coverage.matched > 0 ? 2 : 0)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {coverage.legalMatched}/{coverage.legalTotal} legally-required documents matched. You
            don&apos;t need everything before the audit — gaps become your action plan.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {onboardingSteps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className="border border-border/70 bg-background px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {step.label}
            </p>
            <p className="mt-1 text-sm font-medium">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
          </Link>
        ))}
      </div>
    </section>
  ) : null;

  if (!latest) {
    return (
      <div className="space-y-8">
        {onboardingStrip}
        <div className="max-w-2xl mx-auto space-y-6 py-16 text-center">
          <ShieldCheck className="mx-auto text-[hsl(36,45%,45%)]" size={48} aria-hidden="true" />
          <h2 className="font-display text-3xl tracking-tight">Start with a CQC audit</h2>
          <p className="leading-relaxed text-muted-foreground">
            Your workspace is ready. Start with a one-off CQC Readiness Audit - a manual review of
            your evidence across all 18 compliance areas, delivered with a readiness score,
            risk-rated findings and a priority action plan.
          </p>
          <StartAuditButton label="Start audit workspace" />
        </div>
      </div>
    );
  }

  const { audit, areas, findings, report } = latest;
  const counts = ragCounts(areas);
  const openFindings = findings.filter((f) => f.status === 'open');
  const score = audit.score ?? 0;
  const scoreVisible = audit.status === 'delivered' || audit.status === 'closed';

  const [trend, benchmark, domainScores, scoreChange, completeness, scoreBreakdown] = scoreVisible
    ? await Promise.all([
        getScoreTrend(ctx.org.id),
        getBenchmark(score),
        getSafDomainScores(audit.id),
        getLatestScoreChange(ctx.org.id),
        getAuditCompleteness(audit.id),
        getScoreBreakdown(audit.id),
      ])
    : [[], null, [], null, null, null];

  // The delivered score is the fixed deliverable; "current readiness" is the
  // live figure. They start equal at delivery and only diverge as documents
  // age or are renewed — so we only surface the current line once it differs.
  const currentReadiness = scoreChange?.current ?? null;
  const readinessDrift =
    currentReadiness != null && currentReadiness !== score ? currentReadiness - score : null;
  const notAssessed = counts.unset;

  const scoreLabel =
    score >= 90
      ? 'Compliant — keep your evidence current.'
      : score >= 60
        ? 'Not there yet — work through your action plan.'
        : 'Critical — address these gaps first.';

  return (
    <div className="space-y-8">
      {onboardingStrip}

      <div className="flex flex-wrap items-start justify-between gap-4 pt-2">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Compliance overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ctx.org.name} · Audit status:{' '}
            <span className="font-medium text-foreground">{AUDIT_STATUS_LABELS[audit.status]}</span>
            {audit.due_at && !scoreVisible ? ` · due ${formatDate(audit.due_at)}` : ''}
          </p>
        </div>
        {report ? (
          <a
            href={`/api/files/download?type=report&id=${report.id}`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <FileDown size={16} aria-hidden="true" /> Download audit report
          </a>
        ) : null}
      </div>

      <Card>
        <CardContent className="pt-6 pb-6">
          {scoreVisible ? (
            <div className="grid gap-8 md:grid-cols-2 items-center">
              <div className="flex flex-col items-center text-center">
                <ScoreDial pct={score} display={String(score)} caption="/100" />
                <h2 className="mt-4 font-display text-xl tracking-tight">CQC Readiness Score</h2>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-[260px]">{scoreLabel}</p>
                {completeness && completeness.total > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {completeness.pct >= 100
                      ? `All ${completeness.total} evidence points assessed`
                      : `${completeness.decided} of ${completeness.total} evidence points assessed`}
                  </p>
                ) : null}
                {readinessDrift != null ? (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      readinessDrift < 0 ? 'text-[hsl(4,65%,42%)]' : 'text-[hsl(152,45%,28%)]'
                    }`}
                  >
                    Current readiness {currentReadiness}/100 ({readinessDrift > 0 ? '+' : ''}
                    {readinessDrift} since delivery)
                  </p>
                ) : null}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-4">The five key questions</h3>
                <div className="space-y-3">
                  {domainScores.map((d) =>
                    d.score != null ? (
                      <ScoreBarRow
                        key={d.domain}
                        label={d.label}
                        pct={d.score * 10}
                        display={`${d.score.toFixed(1)}/10`}
                      />
                    ) : (
                      <div key={d.domain} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 text-sm text-[hsl(220,25%,25%)]">{d.label}</span>
                        <div className="h-2 flex-1 rounded-full bg-[hsl(220,14%,92%)]" />
                        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                          Not assessed
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-[hsl(4,72%,48%)]/[0.07] text-[hsl(4,65%,42%)]">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <AlertCircle size={15} aria-hidden="true" /> Critical gaps
                    </span>
                    <span className="text-sm font-bold tabular-nums">{counts.red}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-[hsl(24,85%,50%)]/[0.08] text-[hsl(24,80%,38%)]">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle size={15} aria-hidden="true" /> Needs improvement
                    </span>
                    <span className="text-sm font-bold tabular-nums">{counts.amber}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-[hsl(152,47%,38%)]/[0.08] text-[hsl(152,45%,28%)]">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 size={15} aria-hidden="true" /> Compliant areas
                    </span>
                    <span className="text-sm font-bold tabular-nums">{counts.green}</span>
                  </div>
                  {notAssessed > 0 ? (
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/60 text-muted-foreground">
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <Minus size={15} aria-hidden="true" /> Not yet assessed
                      </span>
                      <span className="text-sm font-bold tabular-nums">{notAssessed}</span>
                    </div>
                  ) : null}
                  <p className="pt-1 text-right text-xs text-muted-foreground">
                    {counts.red + counts.amber + counts.green + notAssessed} of 18 areas
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-6 py-2">
              <ScoreDial pct={0} display="—" caption="in review" size={120} />
              <div>
                <h2 className="font-display text-xl tracking-tight">CQC Readiness Score</h2>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  Your score is calculated when the audit is delivered. Keep uploading evidence —
                  the more complete your vault, the sharper the findings.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {scoreVisible && scoreBreakdown ? <ScoreBreakdownPanel breakdown={scoreBreakdown} /> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight">Priority actions</h2>
              <span className="text-xs text-muted-foreground">{openFindings.length} open</span>
            </div>
            {!scoreVisible ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Your action plan appears here once the audit is delivered. In the meantime, upload
                your policies and evidence to the{' '}
                <Link href="/dashboard/evidence" className="text-[hsl(220,45%,45%)] hover:underline">
                  evidence vault
                </Link>{' '}
                so the review can begin.
              </p>
            ) : openFindings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No open actions - keep your evidence current.
              </p>
            ) : (
              <ul className="divide-y">
                {openFindings.slice(0, 6).map((f) => (
                  <li key={f.id} className="flex items-start gap-3 py-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        f.severity === 'red'
                          ? 'bg-red-600'
                          : f.severity === 'amber'
                            ? 'bg-amber-500'
                            : 'bg-green-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{f.title}</p>
                      {f.area_code ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {f.area_code} {areaName.get(f.area_code) ?? ''}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {FINDING_PRIORITY_LABELS[f.priority]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-2 space-y-6">
          {scoreVisible && trend.length > 0 ? <ScoreTrend trend={trend} benchmark={benchmark} /> : null}

          {scoreVisible && scoreChange && scoreChange.reasons.length > 0 ? (
            <ScoreChangePanel change={scoreChange} />
          ) : null}

          <PlanPanel entitlements={ctx.entitlements} requestsUsed={requestsUsed} />

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg tracking-tight">Recent documents</h2>
                <Link href="/dashboard/documents" className="text-xs text-[hsl(220,45%,45%)] hover:underline">
                  View all
                </Link>
              </div>
              {documents.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Documents issued to you will appear here.
                </p>
              ) : (
                <ul className="divide-y">
                  {documents.slice(0, 4).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          v{d.version} · {formatDate(d.issued_at)}
                        </p>
                      </div>
                      <a
                        href={`/api/files/download?type=document&id=${d.id}`}
                        className="shrink-0 text-xs text-[hsl(220,45%,45%)] hover:underline"
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg tracking-tight">Upcoming deadlines</h2>
                <Link href="/dashboard/calendar" className="text-xs text-[hsl(220,45%,45%)] hover:underline">
                  Calendar
                </Link>
              </div>
              {events.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No upcoming compliance deadlines.
                </p>
              ) : (
                <ul className="divide-y">
                  {events.slice(0, 4).map((e) => (
                    <li key={e.id} className="py-2.5">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.due_date)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg tracking-tight">CQC says</h2>
                  <p className="text-xs text-muted-foreground">
                    Live regulatory updates pulled into your dashboard.
                  </p>
                </div>
                <Link href="/dashboard/alerts" className="text-xs text-[hsl(220,45%,45%)] hover:underline">
                  View all
                </Link>
              </div>
              {alerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No published CQC alerts right now.
                </p>
              ) : (
                <ul className="divide-y">
                  {alerts.slice(0, 4).map((alert) => (
                    <li key={alert.id} className={`py-3 ${alert.isRead ? 'opacity-70' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{alert.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {alert.body}
                          </p>
                        </div>
                        {!alert.isRead ? (
                          <Badge className="shrink-0 bg-[hsl(220,45%,45%)] text-[hsl(36,33%,97%)]">
                            New
                          </Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {unreadAlerts.length > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {unreadAlerts.length} unread alert{unreadAlerts.length === 1 ? '' : 's'}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
