'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, ScanSearch, Wand2, X, Zap } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  setAuditItemStatus,
  setAreaAssessment,
  applySuggestedRags,
} from '@/lib/actions/admin';
import {
  engineSuggest,
  engineApply,
  acceptSuggestion,
  dismissSuggestion,
} from '@/lib/actions/engine';
import { suggestAreaRag, ITEM_STATUS_LABELS, REQUIREMENT_LABELS } from '@/lib/audit/scoring';
import type { AuditArea, AuditItem, LibraryArea, ItemStatus, RagStatus } from '@/types/database';

const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'missing', label: 'Missing' },
  { value: 'out_of_date', label: 'Out-of-date' },
  { value: 'na', label: 'N/A' },
];

const STATUS_ACTIVE: Record<string, string> = {
  present: 'bg-green-500/20 text-green-300 ring-1 ring-green-500/40',
  missing: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40',
  out_of_date: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40',
  na: 'bg-muted text-foreground ring-1 ring-border',
};

const RAG_OPTIONS: { value: RagStatus; label: string; active: string }[] = [
  { value: 'green', label: 'GREEN', active: 'bg-green-500/20 text-green-300 ring-1 ring-green-500/40' },
  { value: 'amber', label: 'AMBER', active: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' },
  { value: 'red', label: 'RED', active: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40' },
];

const REQ_BADGE: Record<string, string> = {
  legal: 'bg-red-500/15 text-red-300',
  cqc: 'bg-blue-500/15 text-blue-300',
  best: 'bg-teal-500/15 text-teal-300',
  optional: 'bg-muted text-muted-foreground',
};

interface Props {
  items: AuditItem[];
  areas: AuditArea[];
  libraryAreas: LibraryArea[];
  auditId: string;
}

export function Checklist({ items, areas, libraryAreas, auditId }: Props) {
  const router = useRouter();
  const [openArea, setOpenArea] = useState<string | null>(libraryAreas[0]?.code ?? null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const itemsByArea = useMemo(() => {
    const map = new Map<string, AuditItem[]>();
    for (const item of items) {
      const list = map.get(item.area_code) ?? [];
      list.push(item);
      map.set(item.area_code, list);
    }
    return map;
  }, [items]);

  const areaByCode = useMemo(
    () => new Map(areas.map((a) => [a.area_code, a])),
    [areas],
  );

  function updateItem(item: AuditItem, status: ItemStatus) {
    setPendingItem(item.id);
    startTransition(async () => {
      await setAuditItemStatus({
        itemId: item.id,
        status: item.status === status ? 'unset' : status,
        note: item.note,
      });
      setPendingItem(null);
      router.refresh();
    });
  }

  const openSuggestions = items.filter(
    (i) => i.status === 'unset' && i.suggested_status !== 'unset',
  ).length;

  return (
    <div className="space-y-4">
      <EngineBar auditId={auditId} openSuggestions={openSuggestions} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.filter((i) => i.status !== 'unset').length} of {items.length} documents reviewed.
          Any LEGAL document marked Missing or Out-of-date suggests a RED area.
        </p>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await applySuggestedRags(auditId);
              router.refresh();
            })
          }
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Wand2 size={14} aria-hidden="true" /> Apply suggested RAGs to all areas
        </button>
      </div>

      {libraryAreas.map((la) => {
        const areaItems = itemsByArea.get(la.code) ?? [];
        const area = areaByCode.get(la.code);
        const done = areaItems.filter((i) => i.status !== 'unset').length;
        const suggested = suggestAreaRag(areaItems);
        const isOpen = openArea === la.code;

        return (
          <div key={la.code} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenArea(isOpen ? null : la.code)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="font-mono text-xs text-[hsl(220,60%,72%)] w-7 shrink-0">{la.code}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{la.name}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {done}/{areaItems.length} reviewed · {la.regulation_title}
                </span>
              </span>
              {area && area.rag !== 'unset' ? (
                <span
                  className={cn(
                    'text-[11px] font-bold px-2.5 py-1 rounded-full',
                    RAG_OPTIONS.find((r) => r.value === area.rag)?.active,
                  )}
                >
                  {area.rag.toUpperCase()}
                </span>
              ) : suggested !== 'unset' ? (
                <span className="text-[11px] text-muted-foreground">suggests {suggested.toUpperCase()}</span>
              ) : null}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={cn('transition-transform', isOpen ? 'rotate-180' : '')}
              />
            </button>

            {isOpen ? (
              <div className="border-t border-border">
                <ul className="divide-y divide-border">
                  {areaItems.map((item) => (
                    <li key={item.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">
                          {item.ref}
                        </span>
                        <span className="flex-1 min-w-0 text-sm">{item.title}</span>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                            REQ_BADGE[item.requirement],
                          )}
                        >
                          {REQUIREMENT_LABELS[item.requirement]}
                        </span>
                        <div
                          className="flex gap-1 shrink-0"
                          role="group"
                          aria-label={`Status for ${item.ref}`}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={pendingItem === item.id}
                              onClick={() => updateItem(item, opt.value)}
                              aria-pressed={item.status === opt.value}
                              className={cn(
                                'text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50',
                                item.status === opt.value
                                  ? STATUS_ACTIVE[opt.value]
                                  : 'bg-muted/50 text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {item.status === 'unset' && item.suggested_status !== 'unset' ? (
                        <SuggestionChip item={item} />
                      ) : null}
                      {item.status !== 'unset' && item.status !== 'present' ? (
                        <ItemNote item={item} />
                      ) : null}
                    </li>
                  ))}
                </ul>
                {area ? <AreaAssessment area={area} suggested={suggested} /> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EngineBar({ auditId, openSuggestions }: { auditId: string; openSuggestions: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function runSuggest() {
    setMessage(null);
    startTransition(async () => {
      const result = await engineSuggest(auditId);
      setMessage(
        result.ok && result.suggest
          ? `Engine scanned ${result.suggest.evidenceScanned} files: ${result.suggest.itemsMatched} matched to evidence, ${result.suggest.itemsSuggestedMissing} flagged as likely missing.`
          : result.error ?? 'Engine run failed.',
      );
      router.refresh();
    });
  }

  function runApply() {
    setMessage(null);
    startTransition(async () => {
      const result = await engineApply(auditId);
      setMessage(
        result.ok && result.apply
          ? `Applied ${result.apply.applied} statuses, rated ${result.apply.ragsSet} areas, drafted ${result.apply.findingsDrafted} findings ` +
            `(${result.apply.findingsFromDocuments} document, ${result.apply.findingsFromVerification} evidence-gap, ${result.apply.findingsFromSampling} sampling), ` +
            `flagged ${result.apply.safFlagged} SAF questions. Score: ${result.apply.score}/100.`
          : result.error ?? 'Apply failed.',
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Zap size={15} className="text-[hsl(220,60%,68%)]" aria-hidden="true" />
          Audit engine
        </span>
        <span className="text-xs text-muted-foreground flex-1 min-w-[200px]">
          {openSuggestions > 0
            ? `${openSuggestions} suggestions awaiting your review.`
            : 'Scans the evidence vault, matches files to the checklist, drafts findings and scores — you stay in control of every decision.'}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={runSuggest}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          <ScanSearch size={14} aria-hidden="true" /> {busy ? 'Working…' : 'Run engine'}
        </button>
        <button
          type="button"
          disabled={busy || openSuggestions === 0}
          onClick={runApply}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Check size={14} aria-hidden="true" /> Accept all &amp; draft findings
        </button>
      </div>
      {message ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function SuggestionChip({ item }: { item: AuditItem }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const isPresent = item.suggested_status === 'present';
  const confidence =
    item.suggestion_confidence != null ? ` · ${Math.round(item.suggestion_confidence * 100)}%` : '';

  return (
    <div className="mt-2 ml-[4.25rem] space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium',
            isPresent
              ? 'bg-[hsl(220,45%,55%)]/12 text-[hsl(220,60%,75%)]'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Zap size={11} aria-hidden="true" />
          Engine: {ITEM_STATUS_LABELS[item.suggested_status]}
          {confidence}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              await acceptSuggestion(item.id);
              router.refresh();
            })
          }
          aria-label={`Accept suggestion for ${item.ref}`}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Check size={11} aria-hidden="true" /> Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              await dismissSuggestion(item.id);
              router.refresh();
            })
          }
          aria-label={`Dismiss suggestion for ${item.ref}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <X size={11} aria-hidden="true" /> Dismiss
        </button>
      </div>
      {item.suggestion_reason ? (
        <p className="max-w-[640px] text-[11px] leading-relaxed text-muted-foreground/90">
          {item.suggestion_reason}
        </p>
      ) : null}
    </div>
  );
}

function ItemNote({ item }: { item: AuditItem }) {
  const router = useRouter();
  const [note, setNote] = useState(item.note ?? '');
  const [, startTransition] = useTransition();

  return (
    <div className="mt-2 pl-[4.25rem]">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (note !== (item.note ?? '')) {
            startTransition(async () => {
              await setAuditItemStatus({ itemId: item.id, status: item.status, note });
              router.refresh();
            });
          }
        }}
        placeholder={`Note for ${ITEM_STATUS_LABELS[item.status].toLowerCase()} item…`}
        className="text-xs h-8"
        aria-label={`Note for ${item.ref}`}
      />
    </div>
  );
}

function AreaAssessment({ area, suggested }: { area: AuditArea; suggested: RagStatus }) {
  const router = useRouter();
  const [values, setValues] = useState({
    evidence_sighted: area.evidence_sighted ?? '',
    findings: area.findings ?? '',
    action: area.action ?? '',
    owner: area.owner ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  function setRag(rag: RagStatus) {
    startTransition(async () => {
      await setAreaAssessment({ areaId: area.id, rag: area.rag === rag ? 'unset' : rag, ...values });
      router.refresh();
    });
  }

  function saveNarrative() {
    setSaving(true);
    startTransition(async () => {
      await setAreaAssessment({ areaId: area.id, rag: area.rag, ...values });
      setSaving(false);
      router.refresh();
    });
  }

  return (
    <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Area RAG
        </span>
        <div className="flex gap-1.5" role="group" aria-label="Area RAG rating">
          {RAG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRag(opt.value)}
              aria-pressed={area.rag === opt.value}
              className={cn(
                'text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors',
                area.rag === opt.value
                  ? opt.active
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {suggested !== 'unset' && suggested !== area.rag ? (
          <span className="text-xs text-muted-foreground">Checklist suggests {suggested.toUpperCase()}</span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Textarea
          rows={2}
          value={values.evidence_sighted}
          onChange={(e) => setValues((v) => ({ ...v, evidence_sighted: e.target.value }))}
          placeholder="Evidence sighted…"
          aria-label="Evidence sighted"
          className="text-xs"
        />
        <Textarea
          rows={2}
          value={values.findings}
          onChange={(e) => setValues((v) => ({ ...v, findings: e.target.value }))}
          placeholder="Findings…"
          aria-label="Findings"
          className="text-xs"
        />
        <Textarea
          rows={2}
          value={values.action}
          onChange={(e) => setValues((v) => ({ ...v, action: e.target.value }))}
          placeholder="Action required…"
          aria-label="Action"
          className="text-xs"
        />
        <div className="space-y-2">
          <Input
            value={values.owner}
            onChange={(e) => setValues((v) => ({ ...v, owner: e.target.value }))}
            placeholder="Action owner…"
            aria-label="Action owner"
            className="text-xs h-9"
          />
          <button
            type="button"
            onClick={saveNarrative}
            disabled={saving}
            className="w-full rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save area notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
