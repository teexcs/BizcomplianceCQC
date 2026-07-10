'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Checklist } from './checklist';
import { SafSheet } from './saf-sheet';
import { Findings } from './findings';
import { ReportTab } from './report-tab';
import { setAuditStatus } from '@/lib/actions/admin';
import { AUDIT_STATUS_LABELS } from '@/lib/audit/scoring';
import type {
  Audit,
  AuditArea,
  AuditFinding,
  AuditItem,
  AuditStatus,
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
  const [tab, setTab] = useState('checklist');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="audit-status" className="text-xs uppercase tracking-wide text-muted-foreground">
          Audit status
        </label>
        <Select
          id="audit-status"
          value={status}
          onChange={(e) => {
            const next = e.target.value as AuditStatus;
            setStatus(next);
            startTransition(async () => {
              await setAuditStatus(props.audit.id, next);
              router.refresh();
            });
          }}
          className="w-52"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {AUDIT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
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
        <TabsContent value="report" activeValue={tab} className="mt-5">
          <ReportTab audit={props.audit} reports={props.reports} organisationName={props.organisationName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
