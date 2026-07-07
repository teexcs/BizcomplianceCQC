import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAuditPipeline, getOrganisations } from '@/lib/data/admin';
import { AUDIT_STATUS_LABELS } from '@/lib/audit/scoring';
import { CreateAuditButton } from '@/components/admin/create-audit-button';
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

const SECTIONS: { title: string; statuses: string[] }[] = [
  { title: 'In progress', statuses: ['intake', 'evidence', 'in_review', 'report_draft'] },
  { title: 'Delivered', statuses: ['delivered'] },
  { title: 'Closed', statuses: ['closed'] },
];

export default async function AdminAuditsPage() {
  const [pipeline, organisations] = await Promise.all([getAuditPipeline(), getOrganisations()]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Audit pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every readiness audit, from intake to delivered report.
          </p>
        </div>
        <CreateAuditButton
          organisations={organisations.map((o) => ({ id: o.id, name: o.name }))}
        />
      </div>

      {SECTIONS.map((section) => {
        const rows = pipeline.filter((a) => section.statuses.includes(a.status));
        if (rows.length === 0 && section.title !== 'In progress') return null;
        return (
          <div key={section.title}>
            <h2 className="font-display text-lg tracking-tight mb-3">
              {section.title}{' '}
              <span className="text-sm text-muted-foreground font-sans">({rows.length})</span>
            </h2>
            {rows.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nothing here. New audit purchases land in this pipeline automatically.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {rows.map((a) => (
                  <Link key={a.id} href={`/admin/audits/${a.id}`}>
                    <Card className="hover:ring-1 hover:ring-[hsl(36,45%,55%)]/40 transition-shadow">
                      <CardContent className="py-4 flex flex-wrap items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#242b38] to-[#0d1626] grid place-items-center text-[hsl(36,60%,72%)] text-xs font-bold shrink-0">
                          {(a.organisation?.name ?? '??')
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {a.organisation?.name ?? 'Unknown client'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {a.kind === 're_audit' ? 'Re-audit' : 'One-off audit'} · started{' '}
                            {formatDate(a.started_at)}
                            {a.due_at && !['delivered', 'closed'].includes(a.status)
                              ? ` · due ${formatDate(a.due_at)}`
                              : ''}
                          </p>
                        </div>
                        {typeof a.score === 'number' ? (
                          <span className="text-sm font-semibold tabular-nums">{a.score}/100</span>
                        ) : null}
                        <Badge className={STATUS_STYLES[a.status] ?? ''}>
                          {AUDIT_STATUS_LABELS[a.status]}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
