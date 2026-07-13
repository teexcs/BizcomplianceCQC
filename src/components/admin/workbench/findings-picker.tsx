'use client';

import { useMemo, useState } from 'react';
import { BookText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { findingsLibrary, type LibraryEntry } from '@/lib/audit/findings-library';

export interface PickedFinding {
  area_code: string;
  severity: 'red' | 'amber' | 'green';
  title: string;
  detail: string;
  recommendation: string;
  priority: 'fix_first' | 'days_7' | 'days_14' | 'days_30';
}

const SEV_DOT: Record<string, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
};

/**
 * Manual picker over the findings library — searchable standard wording the
 * auditor can insert into the finding form and then edit. Complements the
 * automatic drafting: here the auditor deliberately reaches for a template.
 */
export function FindingsPicker({ onPick }: { onPick: (f: PickedFinding) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const library = useMemo(() => findingsLibrary(), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter((e) =>
      `${e.areaCode} ${e.areaName} ${e.gapLabel} ${e.preview.title}`.toLowerCase().includes(q),
    );
  }, [library, query]);

  function pick(e: LibraryEntry) {
    onPick({
      area_code: e.areaCode,
      severity: e.preview.severity,
      title: e.preview.title,
      detail: e.preview.detail,
      recommendation: e.preview.recommendation,
      priority: e.preview.priority,
    });
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="rounded-lg border border-dashed border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <BookText size={14} aria-hidden="true" />
        Insert from findings library
        <span className="ml-auto text-[11px] text-muted-foreground">{library.length} standard findings</span>
      </button>

      {open ? (
        <div className="border-t border-border p-3 space-y-2">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by area or issue (e.g. safeguarding, DBS, medicines)…"
              className="h-8 pl-8 text-xs"
              aria-label="Search the findings library"
              autoFocus
            />
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {results.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">No matches.</li>
            ) : (
              results.map((e) => (
                <li key={`${e.areaCode}-${e.gap}`}>
                  <button
                    type="button"
                    onClick={() => pick(e)}
                    className={cn(
                      'w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', SEV_DOT[e.preview.severity])} aria-hidden="true" />
                      <span className="text-xs font-medium">{e.preview.title}</span>
                    </div>
                    <p className="mt-0.5 pl-4 text-[11px] text-muted-foreground">
                      {e.areaCode} {e.areaName} · {e.gapLabel}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
