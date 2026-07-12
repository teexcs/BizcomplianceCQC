'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileSearch, Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { saveFileSample, deleteFileSample } from '@/lib/actions/admin';
import { AREAS } from '@/lib/engine/reader/manifest.mjs';
import type { EvidenceFile, FileSample, SampleVerdict } from '@/types/database';

const AREA_NAME = AREAS as Record<string, string>;

const VERDICTS: { value: SampleVerdict; label: string; style: string }[] = [
  { value: 'compliant', label: 'Compliant', style: 'bg-green-500/20 text-green-300 ring-1 ring-green-500/40' },
  { value: 'partial', label: 'Partial', style: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' },
  { value: 'not_compliant', label: 'Not compliant', style: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40' },
  { value: 'not_applicable', label: 'N/A', style: 'bg-muted text-foreground ring-1 ring-border' },
];

// The record types an auditor typically samples for depth.
const SAMPLE_TYPES = [
  'care_plan',
  'risk_assessment',
  'mar_chart',
  'staff_file',
  'recruitment_file',
  'supervision',
  'training_record',
  'other',
] as const;

const SAMPLE_TYPE_LABEL: Record<string, string> = {
  care_plan: 'Care plan',
  risk_assessment: 'Risk assessment',
  mar_chart: 'MAR chart',
  staff_file: 'Staff file',
  recruitment_file: 'Recruitment file',
  supervision: 'Supervision',
  training_record: 'Training record',
  other: 'Other',
};

/** Guess a sensible default sample type from a file name. */
function guessType(name: string): string {
  const n = name.toLowerCase();
  if (/care\s*plan|support\s*plan/.test(n)) return 'care_plan';
  if (/risk\s*assess/.test(n)) return 'risk_assessment';
  if (/\bmar\b|medication administration/.test(n)) return 'mar_chart';
  if (/recruit/.test(n)) return 'recruitment_file';
  if (/staff\s*file|personnel/.test(n)) return 'staff_file';
  if (/supervis/.test(n)) return 'supervision';
  if (/training|certificat|matrix/.test(n)) return 'training_record';
  return 'other';
}

interface Props {
  auditId: string;
  evidence: EvidenceFile[];
  samples: FileSample[];
}

/**
 * File sampling — the auditor pulls individual client records and reviews them
 * in depth, recording a verdict and findings per file. This is the evidence
 * that lets the report say exactly which files were examined and what was
 * found, rather than only that a policy exists.
 */
export function Sampling({ auditId, evidence, samples }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Local draft notes/type per evidence id so typing is responsive.
  const [drafts, setDrafts] = useState<Record<string, { type: string; notes: string }>>({});

  const sampleByEvidence = useMemo(
    () => new Map(samples.map((s) => [s.evidence_id, s])),
    [samples],
  );

  // Only current, non-infected files are worth sampling.
  const files = useMemo(
    () =>
      evidence.filter(
        (e) => e.lifecycle_state === 'current' && e.scan_status !== 'infected',
      ),
    [evidence],
  );

  const reviewed = files.filter((f) => sampleByEvidence.has(f.id)).length;

  function draftFor(f: EvidenceFile): { type: string; notes: string } {
    const existing = sampleByEvidence.get(f.id);
    return (
      drafts[f.id] ?? {
        type: existing?.sample_type ?? guessType(f.file_name),
        notes: existing?.findings ?? '',
      }
    );
  }

  function setDraft(f: EvidenceFile, patch: Partial<{ type: string; notes: string }>) {
    const base = draftFor(f);
    setDrafts((d) => ({ ...d, [f.id]: { ...base, ...patch } }));
  }

  function save(f: EvidenceFile, verdict: SampleVerdict) {
    const draft = draftFor(f);
    setError(null);
    startTransition(async () => {
      const res = await saveFileSample({
        auditId,
        evidenceId: f.id,
        sampleType: draft.type,
        verdict,
        findings: draft.notes,
      });
      if (!res.ok) setError(res.error ?? 'Could not save.');
      else router.refresh();
    });
  }

  function remove(sampleId: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteFileSample(sampleId, auditId);
      if (!res.ok) setError(res.error ?? 'Could not remove.');
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            <FileSearch size={15} className="mr-1.5 -mt-0.5 inline" aria-hidden="true" />
            File sampling — read individual records in depth
          </p>
          <p className="text-xs text-muted-foreground">
            {reviewed}/{files.length} files sampled
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pull specific records (care plans, MAR charts, staff files) and check them for
          completeness, consistency and regulatory alignment. Your verdict and notes appear in the
          report&apos;s file-sampling section.
        </p>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </div>

      {files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No current evidence files to sample yet. Files uploaded by the client will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {files.map((f) => {
            const sample = sampleByEvidence.get(f.id);
            const draft = draftFor(f);
            const areaLabel = f.area_code ? `${f.area_code} ${AREA_NAME[f.area_code] ?? ''}` : 'Unsorted';
            return (
              <li key={f.id} className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-medium break-all">{f.file_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{areaLabel}</p>
                  </div>
                  <div className="w-44">
                    <Select
                      value={draft.type}
                      onChange={(e) => setDraft(f, { type: e.target.value })}
                      aria-label={`Sample type for ${f.file_name}`}
                      className="h-8 text-xs"
                    >
                      {SAMPLE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {SAMPLE_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <Textarea
                  value={draft.notes}
                  onChange={(e) => setDraft(f, { notes: e.target.value })}
                  placeholder="What did you check, and what did you find? (e.g. care plan dated, signed, reviewed within 12 months; risk assessment cross-references the plan…)"
                  className="mt-2.5 min-h-[64px] text-xs"
                  aria-label={`Findings for ${f.file_name}`}
                />

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {VERDICTS.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      disabled={busy}
                      onClick={() => save(f, v.value)}
                      aria-pressed={sample?.verdict === v.value}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50',
                        sample?.verdict === v.value
                          ? v.style
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {sample?.verdict === v.value ? (
                        <Check size={11} className="mr-1 -mt-0.5 inline" aria-hidden="true" />
                      ) : null}
                      {v.label}
                    </button>
                  ))}
                  {sample ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(sample.id)}
                      className="ml-auto text-[11px] text-muted-foreground hover:text-red-400 disabled:opacity-50"
                    >
                      Remove from sample
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
