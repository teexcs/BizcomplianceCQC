'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Checklist } from './checklist';
import { SafSheet } from './saf-sheet';
import { Findings } from './findings';
import { Sampling } from './sampling';
import { ReportTab } from './report-tab';
import { setAuditStatus } from '@/lib/actions/admin';
import { AUDIT_STATUS_LABELS } from '@/lib/audit/scoring';
import type {
  Audit,
  AuditArea,
  AuditFinding,
  AuditItem,
  AuditStatus,
  EvidenceFile,
  FileSample,
  LibraryArea,
  Report,
  SafQuestion,
  SafResponse,
} from '@/types/database';

interface Props {
  audit: Audit;
  items: AuditItem[];
  areas: AuditArea[];
  libraryAreas: LibraryArea[];
  safQuestions: SafQuestion[];
  safResponses: SafResponse[];
  findings: AuditFinding[];
  evidence: EvidenceFile[];
  fileSamples: FileSample[];
  reports: Report[];
  organisationName: string;
}

const STATUSES: AuditStatus[] = [
  'intake',
  'evidence',
  'in_review',
  'report_draft',
  'delivered',
  'closed',
];

export function Workbench(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<AuditStatus>(props.audit.status);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [tab, setTab] = useState('checklist');

  // Same readiness bar the server enforces on deliver/publish (see
  // checkAuditReadyToDeliver in lib/actions/admin.ts) — shown up front so an
  // admin sees the gap before hitting a blocked action, not after.
  const readiness = useMemo(() => {
    const total = props.items.length;
    const decided = props.items.filter((i) => i.status !== 'unset').length;
    const ragged = props.areas.filter((a) => a.rag !== 'unset').length;
    if (total === 0) return { ready: false, reason: 'This audit has no checklist items yet.' };
    if (decided === 0)
      return { ready: false, reason: 'No checklist items reviewed yet — run the engine and review the checklist.' };
    if (ragged === 0)
      return { ready: false, reason: 'No compliance areas rated yet — apply suggested RAGs or set them manually.' };
    return { ready: true, reason: undefined as string | undefined };
  }, [props.items, props.areas]);
  const alreadyDelivered = ['delivered', 'closed'].includes(props.audit.status);

  return (
    <div className="space-y-6">
      {!readiness.ready && !alreadyDelivered ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Not ready to deliver: {readiness.reason} The client won&apos;t see a score until this audit is
            marked Delivered, and delivering is blocked until then.
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="audit-status" className="text-xs uppercase tracking-wide text-muted-foreground">
          Audit status
        </label>
        <Select
          id="audit-status"
          value={status}
          onChange={(e) => {
            const next = e.target.value as AuditStatus;
            setStatusError(null);
            setStatus(next);
            startTransition(async () => {
              const result = await setAuditStatus(props.audit.id, next);
              if (!result.ok) {
                setStatus(props.audit.status);
                setStatusError(result.error ?? 'Could not update status.');
                return;
              }
              router.refresh();
            });
          }}
          className="w-52"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} disabled={s === 'delivered' && !readiness.ready && !alreadyDelivered}>
              {AUDIT_STATUS_LABELS[s]}
              {s === 'delivered' && !readiness.ready && !alreadyDelivered ? ' (not ready)' : ''}
            </option>
          ))}
        </Select>
        {statusError ? <span className="text-xs text-destructive">{statusError}</span> : null}
        {typeof props.audit.score === 'number' ? (
          <span className="ml-auto text-sm">
            Live readiness score:{' '}
            <strong className="text-lg tabular-nums">{props.audit.score}/100</strong>
          </span>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="checklist" active={tab === 'checklist'} onClick={() => setTab('checklist')}>
            Document checklist ({props.items.filter((i) => i.status !== 'unset').length}/
            {props.items.length})
          </TabsTrigger>
          <TabsTrigger value="saf" active={tab === 'saf'} onClick={() => setTab('saf')}>
            SAF interview ({props.safResponses.filter((r) => r.answer !== 'unset').length}/
            {props.safResponses.length})
          </TabsTrigger>
          <TabsTrigger value="findings" active={tab === 'findings'} onClick={() => setTab('findings')}>
            Findings ({props.findings.filter((f) => f.status === 'open').length})
          </TabsTrigger>
          <TabsTrigger value="sampling" active={tab === 'sampling'} onClick={() => setTab('sampling')}>
            File sampling ({props.fileSamples.length})
          </TabsTrigger>
          <TabsTrigger value="report" active={tab === 'report'} onClick={() => setTab('report')}>
            Report ({props.reports.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="checklist" activeValue={tab} className="mt-5">
          <Checklist
            items={props.items}
            areas={props.areas}
            libraryAreas={props.libraryAreas}
            auditId={props.audit.id}
          />
        </TabsContent>
        <TabsContent value="saf" activeValue={tab} className="mt-5">
          <SafSheet questions={props.safQuestions} responses={props.safResponses} />
        </TabsContent>
        <TabsContent value="findings" activeValue={tab} className="mt-5">
          <Findings
            findings={props.findings}
            libraryAreas={props.libraryAreas}
            auditId={props.audit.id}
          />
        </TabsContent>
        <TabsContent value="sampling" activeValue={tab} className="mt-5">
          <Sampling
            auditId={props.audit.id}
            evidence={props.evidence}
            samples={props.fileSamples}
          />
        </TabsContent>
        <TabsContent value="report" activeValue={tab} className="mt-5">
          <ReportTab audit={props.audit} reports={props.reports} organisationName={props.organisationName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
