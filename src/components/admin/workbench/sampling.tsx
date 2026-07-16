'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileSearch, ScanSearch, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { saveFileSample, deleteFileSample, setEvidenceArea } from '@/lib/actions/admin';
import { engineApply, engineSuggest } from '@/lib/actions/engine';
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

const EXTRACT_STYLE: Record<string, string> = {
  done: 'bg-green-500/15 text-green-300',
  pending: 'bg-amber-500/15 text-amber-300',
  unsupported: 'bg-muted text-muted-foreground',
  failed: 'bg-red-500/15 text-red-300',
};

function extractLabel(file: EvidenceFile): string {
  if (file.extract_status === 'done') {
    return file.word_count ? `scanned · ${file.word_count} words` : 'scanned';
  }
  if (file.extract_status === 'pending') return 'awaiting scan';
  if (file.extract_status === 'unsupported') return 'manual review';
  return 'scan failed';
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
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  // Local draft notes/type per evidence id so typing is responsive.
  const [drafts, setDrafts] = useState<Record<string, { type: string; notes: string }>>({});

  const sampleByEvidence = useMemo(
    () => new Map(samples.map((s) => [s.evidence_id, s])),
    [samples],
  );

  const files = useMemo(() => evidence, [evidence]);
  const reviewed = files.filter((f) => sampleByEvidence.has(f.id)).length;
  const scanned = files.filter((f) => f.extract_status === 'done').length;
  const pendingScan = files.filter((f) => f.extract_status === 'pending').length;

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

  function assignArea(f: EvidenceFile, areaCode: string) {
    if (!areaCode) return;
    setError(null);
    startTransition(async () => {
      const res = await setEvidenceArea({ evidenceId: f.id, auditId, areaCode });
      if (!res.ok) setError(res.error ?? 'Could not assign the area.');
      else router.refresh();
    });
  }

  function runScan(rescan = false) {
    setError(null);
    setScanMessage(null);
    startTransition(async () => {
      const result = await engineSuggest(auditId, rescan);
      if (!result.ok || !result.suggest) {
        setError(result.error ?? 'Could not scan the submitted files.');
        return;
      }
      setScanMessage(
        `Scan complete: ${result.suggest.evidenceScanned} files scanned, ${result.suggest.itemsMatched} matched to the audit checklist, ${result.suggest.itemsSuggestedMissing} likely gaps flagged.`,
      );
      router.refresh();
    });
  }

  function applyScan() {
    setError(null);
    setScanMessage(null);
    startTransition(async () => {
      const result = await engineApply(auditId);
      if (!result.ok || !result.apply) {
        setError(result.error ?? 'Could not apply the scan to the audit.');
        return;
      }
      setScanMessage(
        `Applied to audit: ${result.apply.applied} checklist statuses, ${result.apply.ragsSet} area ratings, ${result.apply.findingsDrafted} findings. Score: ${result.apply.score}/100.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              <FileSearch size={15} className="mr-1.5 -mt-0.5 inline" aria-hidden="true" />
              Submitted files — scan and sample evidence
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {files.length} submitted · {scanned} scanned · {pendingScan} awaiting scan · {reviewed} sampled
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || files.length === 0}
              onClick={() => runScan(false)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              <ScanSearch size={14} aria-hidden="true" /> {busy ? 'Working...' : 'Run scan'}
            </button>
            <button
              type="button"
              disabled={busy || files.length === 0}
              onClick={() => {
                if (window.confirm('Re-read every document from scratch? This clears the current checklist decisions for this audit and re-scans all uploaded files.')) {
                  runScan(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              <ScanSearch size={14} aria-hidden="true" /> Re-scan all
            </button>
            <button
              type="button"
              disabled={busy || files.length === 0}
              onClick={applyScan}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Wand2 size={14} aria-hidden="true" /> Apply scan to audit
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This is the audit evidence inbox. <strong>Run scan</strong> reads uploaded documents and
          maps them to the checklist; <strong>Re-scan all</strong> clears prior decisions and reads
          everything again (use after new uploads or on a delivered audit). Then{' '}
          <strong>Apply</strong> to rate every area, score the audit and draft the action plan.
        </p>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        {scanMessage ? (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {scanMessage}
          </p>
        ) : null}
      </div>

      {files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No submitted evidence files for this client yet.
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {f.area_code ? (
                        <span className="text-xs text-muted-foreground">{areaLabel}</span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          ⚠ Unclassified — assign an area below so it is audited
                        </span>
                      )}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          EXTRACT_STYLE[f.extract_status] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {extractLabel(f)}
                      </span>
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                        scannable evidence
                      </span>
                      {f.audit_id === auditId ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          this audit
                        </span>
                      ) : f.audit_id ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          linked to another audit
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          unlinked
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {!f.area_code ? (
                      <Select
                        value=""
                        onChange={(e) => assignArea(f, e.target.value)}
                        aria-label={`Assign compliance area for ${f.file_name}`}
                        className="h-8 w-44 text-xs"
                      >
                        <option value="" disabled>
                          Assign area…
                        </option>
                        {Object.entries(AREA_NAME).map(([code, name]) => (
                          <option key={code} value={code}>
                            {code} {name}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                    <Select
                      value={draft.type}
                      onChange={(e) => setDraft(f, { type: e.target.value })}
                      aria-label={`Sample type for ${f.file_name}`}
                      className="h-8 w-44 text-xs"
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
