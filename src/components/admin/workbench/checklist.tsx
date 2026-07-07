'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  setAuditItemStatus,
  setAreaAssessment,
  applySuggestedRags,
} from '@/lib/actions/admin';
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

  return (
    <div className="space-y-4">
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
              <span className="font-mono text-xs text-[hsl(36,60%,72%)] w-7 shrink-0">{la.code}</span>
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
