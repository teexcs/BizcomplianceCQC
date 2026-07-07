import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAdminStats, getAuditPipeline, getEvidenceQueue, getAllRequests } from '@/lib/data/admin';
import { AUDIT_STATUS_LABELS } from '@/lib/audit/scoring';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  intake: 'bg-blue-500/15 text-blue-300',
  evidence: 'bg-amber-500/15 text-amber-300',
  in_review: 'bg-amber-500/15 text-amber-300',
  report_draft: 'bg-purple-500/15 text-purple-300',
  delivered: 'bg-green-500/15 text-green-300',
  closed: 'bg-muted text-muted-foreground',
};

export default async function AdminCommandCentre() {
  const [stats, pipeline, evidence, requests] = await Promise.all([
    getAdminStats(),
    getAuditPipeline(),
    getEvidenceQueue(),
    getAllRequests(),
  ]);

  const activeAudits = pipeline.filter((a) => !['delivered', 'closed'].includes(a.status));
  const pendingEvidence = evidence.filter((e) => e.review_status === 'pending');
  const openRequests = requests.filter((r) => ['open', 'in_review'].includes(r.status));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[hsl(220,60%,72%)] mb-2">
          Founder workspace
        </p>
        <h1 className="font-display text-3xl tracking-tight">CQC audit command centre</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Intake, evidence review, risk scoring and client reports — the whole 48-hour audit
          pipeline in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active audits</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.activeAudits}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.auditsDueSoon} due within 24 hours
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidence queued</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.evidencePending}</p>
            <p className="mt-1 text-xs text-muted-foreground">awaiting your review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly revenue</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              £{((stats.revenueThisMonthPence / 100) + stats.mrr).toLocaleString('en-GB')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              £{stats.mrr} MRR · £{(stats.revenueThisMonthPence / 100).toLocaleString('en-GB')} one-off this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Clients</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.clientCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.activeSubscriptions} on monthly plans
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg tracking-tight">Audit pipeline</h2>
              <Link
                href="/admin/audits"
                className="text-xs text-[hsl(220,60%,72%)] hover:underline inline-flex items-center gap-1"
              >
                All audits <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
            {activeAudits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No active audits. New purchases appear here automatically.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {activeAudits.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/audits/${a.id}`}
                      className="py-3 flex items-center gap-4 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#242b38] to-[#0d1626] grid place-items-center text-[hsl(220,60%,72%)] text-xs font-bold shrink-0">
                        {(a.organisation?.name ?? '??')
                          .split(' ')
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {a.organisation?.name ?? 'Unknown client'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.kind === 're_audit' ? 'Re-audit' : 'One-off audit'} · started{' '}
                          {formatDate(a.started_at)}
                          {a.due_at ? ` · due ${formatDate(a.due_at)}` : ''}
                        </p>
                      </div>
                      <Badge className={STATUS_STYLES[a.status] ?? ''}>
                        {AUDIT_STATUS_LABELS[a.status]}
                      </Badge>
                    </Link>
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
                <h2 className="font-display text-lg tracking-tight">Evidence review queue</h2>
                <Link href="/admin/evidence" className="text-xs text-[hsl(220,60%,72%)] hover:underline">
                  Open queue
                </Link>
              </div>
              {pendingEvidence.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Queue clear.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingEvidence.slice(0, 5).map((e) => (
                    <li key={e.id} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                      <p className="text-sm font-medium truncate">{e.file_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.organisation?.name ?? ''} · {formatDate(e.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg tracking-tight">Open requests</h2>
                <Link href="/admin/requests" className="text-xs text-[hsl(220,60%,72%)] hover:underline">
                  All requests
                </Link>
              </div>
              {openRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No open requests.</p>
              ) : (
                <ul className="space-y-2">
                  {openRequests.slice(0, 4).map((r) => (
                    <li key={r.id} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium truncate">{r.type}</p>
                        <span
                          className={`text-xs font-semibold shrink-0 ${
                            r.priority === 'high'
                              ? 'text-red-400'
                              : r.priority === 'medium'
                                ? 'text-amber-300'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {r.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {r.organisation?.name ?? ''} · {formatDate(r.created_at)}
                      </p>
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
