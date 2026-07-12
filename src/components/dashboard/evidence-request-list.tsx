import { FileText, ClipboardList, ListChecks, Layers, FolderCheck } from 'lucide-react';
import { evidenceRequestList, evidenceRequestCounts, type EvidenceKind } from '@/lib/audit/evidence-request';

const KIND_ICON: Record<EvidenceKind, typeof FileText> = {
  document: FileText,
  record: FolderCheck,
  log: ListChecks,
  matrix: Layers,
  sample: ClipboardList,
};

const KIND_LABEL: Record<EvidenceKind, string> = {
  document: 'Policy',
  record: 'Record',
  log: 'Log',
  matrix: 'Matrix',
  sample: 'Sample',
};

/**
 * The pre-audit "what to send us" checklist — Step 1 of a proper independent
 * audit. Shows the provider exactly which records prove their policies are
 * lived, grouped by CQC area, before the audit runs.
 */
export function EvidenceRequestList() {
  const areas = evidenceRequestList();
  const counts = evidenceRequestCounts();

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg tracking-tight">What to send before your audit</h2>
          <p className="text-xs text-muted-foreground">
            {counts.total} items · {counts.critical} essential · {counts.samples} record samples
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          A real inspection checks whether your policies are lived — not just written. Send whatever
          of these you have; anything missing simply becomes part of your action plan, so there is no
          need to wait until it&apos;s perfect.
        </p>
      </div>

      <div className="divide-y divide-border">
        {areas.map((area) => (
          <div key={area.code} className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {area.code}. {area.area}
            </p>
            <ul className="mt-2 space-y-1.5">
              {area.items.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <li key={item.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
                      aria-hidden="true"
                    >
                      <Icon size={14} />
                    </span>
                    <span className="flex-1 leading-relaxed">
                      {item.label}
                      {item.critical ? (
                        <span className="ml-1.5 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(4,65%,42%)]">
                          Essential
                        </span>
                      ) : null}
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        {KIND_LABEL[item.kind]}
                      </span>
                      <span className="block text-xs text-muted-foreground/90">
                        Proves: {item.verifies}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
