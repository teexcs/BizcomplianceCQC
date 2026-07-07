import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAuditWorkbench } from '@/lib/data/admin';
import { Workbench } from '@/components/admin/workbench/workbench';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AuditWorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const bundle = await getAuditWorkbench(id);
  if (!bundle) notFound();

  const { audit, organisation } = bundle;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/audits"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={13} aria-hidden="true" /> Audit pipeline
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">{organisation.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {audit.kind === 're_audit' ? 'Re-audit' : 'CQC Readiness Audit'} · started{' '}
              {formatDate(audit.started_at)}
              {audit.due_at ? ` · due ${formatDate(audit.due_at)}` : ''} ·{' '}
              {organisation.service_type.replace(/-/g, ' ')}
              {organisation.cqc_location_id ? ` · CQC ${organisation.cqc_location_id}` : ''}
            </p>
          </div>
          <Link
            href={`/admin/customers?org=${organisation.id}`}
            className="text-xs text-[hsl(220,60%,72%)] hover:underline"
          >
            Client record
          </Link>
        </div>
      </div>

      <Workbench
        audit={audit}
        items={bundle.items}
        areas={bundle.areas}
        libraryAreas={bundle.libraryAreas}
        safQuestions={bundle.safQuestions}
        safResponses={bundle.safResponses}
        findings={bundle.findings}
        reports={bundle.reports}
      />
    </div>
  );
}
