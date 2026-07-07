import Link from 'next/link';
import { FileDown, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import {
  getLatestAudit,
  getIssuedDocuments,
  getCalendarEvents,
  getLibraryAreas,
} from '@/lib/data/client';
import { ragCounts, AUDIT_STATUS_LABELS, FINDING_PRIORITY_LABELS } from '@/lib/audit/scoring';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage() {
  const ctx = await requireOrgSession();
  const [latest, documents, events, libraryAreas] = await Promise.all([
    getLatestAudit(ctx.org.id),
    getIssuedDocuments(ctx.org.id),
    getCalendarEvents(ctx.org.id),
    getLibraryAreas(),
  ]);

  const areaName = new Map(libraryAreas.map((a) => [a.code, a.name]));

  if (!latest) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
        <ShieldCheck className="mx-auto text-[hsl(36,45%,45%)]" size={48} aria-hidden="true" />
        <h1 className="font-display text-3xl tracking-tight">
          Welcome, {ctx.org.name}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Your workspace is ready. Start with a one-off CQC Readiness Audit — a manual review of
          your evidence across all 18 compliance areas, delivered with a readiness score, risk-rated
          findings and a priority action plan.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] px-6 py-3 text-sm font-medium hover:bg-[hsl(220,50%,15%)]/90 transition-colors"
        >
          Start your readiness audit <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const { audit, areas, findings, report } = latest;
  const counts = ragCounts(areas);
  const openFindings = findings.filter((f) => f.status === 'open');
  const score = audit.score ?? 0;
  const scoreVisible = audit.status === 'delivered' || audit.status === 'closed';

  const readinessTone =
    score >= 80
      ? 'bg-green-100 text-green-800'
      : score >= 60
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Compliance overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ctx.org.name} · Audit status:{' '}
            <span className="font-medium text-foreground">
              {AUDIT_STATUS_LABELS[audit.status]}
            </span>
            {audit.due_at && !scoreVisible
              ? ` · due ${formatDate(audit.due_at)}`
              : ''}
          </p>
        </div>
        {report ? (
          <a
            href={`/api/files/download?type=report&id=${report.id}`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <FileDown size={16} aria-hidden="true" /> Download audit report
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              CQC readiness score
            </p>
            {scoreVisible ? (
              <>
                <p className="mt-2 text-4xl font-semibold tabular-nums">{score}</p>
                <Badge className={`mt-2 ${readinessTone}`}>
                  {score >= 80 ? 'Strong' : score >= 60 ? 'Progressing' : 'Needs attention'}
                </Badge>
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-semibold text-muted-foreground">In review</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your score is calculated when the audit is delivered.
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Compliant areas</p>
            <p className="mt-2 text-4xl font-semibold text-green-700 tabular-nums">
              {scoreVisible ? counts.green : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">of 18 compliance areas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Needs improvement
            </p>
            <p className="mt-2 text-4xl font-semibold text-amber-700 tabular-nums">
              {scoreVisible ? counts.amber : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">amber-rated areas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Critical gaps</p>
            <p className="mt-2 text-4xl font-semibold text-red-700 tabular-nums">
              {scoreVisible ? counts.red : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">red-rated areas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg tracking-tight">Priority actions</h2>
              <span className="text-xs text-muted-foreground">
                {openFindings.length} open
              </span>
            </div>
            {!scoreVisible ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Your action plan appears here once the audit is delivered. In the meantime, upload
                your policies and evidence to the{' '}
                <Link href="/dashboard/evidence" className="text-[hsl(36,45%,45%)] hover:underline">
                  evidence vault
                </Link>{' '}
                so the review can begin.
              </p>
            ) : openFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No open actions — keep your evidence current.
              </p>
            ) : (
              <ul className="divide-y">
                {openFindings.slice(0, 6).map((f) => (
                  <li key={f.id} className="py-3 flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
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
                        <p className="text-xs text-muted-foreground mt-0.5">
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg tracking-tight">Recent documents</h2>
                <Link
                  href="/dashboard/documents"
                  className="text-xs text-[hsl(36,45%,45%)] hover:underline"
                >
                  View all
                </Link>
              </div>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Documents issued to you will appear here.
                </p>
              ) : (
                <ul className="divide-y">
                  {documents.slice(0, 4).map((d) => (
                    <li key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          v{d.version} · {formatDate(d.issued_at)}
                        </p>
                      </div>
                      <a
                        href={`/api/files/download?type=document&id=${d.id}`}
                        className="text-xs text-[hsl(36,45%,45%)] hover:underline shrink-0"
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg tracking-tight">Upcoming deadlines</h2>
                <Link
                  href="/dashboard/calendar"
                  className="text-xs text-[hsl(36,45%,45%)] hover:underline"
                >
                  Calendar
                </Link>
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
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
        </div>
      </div>
    </div>
  );
}
