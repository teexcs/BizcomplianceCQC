'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { issueDocuments } from '@/lib/actions/admin';
import { REQUIREMENT_LABELS } from '@/lib/audit/scoring';
import type { LibraryArea, LibraryAsset } from '@/types/database';

const REQ_BADGE: Record<string, string> = {
  legal: 'bg-red-500/15 text-red-300',
  cqc: 'bg-blue-500/15 text-blue-300',
  best: 'bg-teal-500/15 text-teal-300',
  optional: 'bg-muted text-muted-foreground',
};

interface OrgOption {
  id: string;
  name: string;
}

interface Props {
  areas: LibraryArea[];
  assets: LibraryAsset[];
  organisations: OrgOption[];
}

export function LibraryBrowser({ areas, assets, organisations }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orgId, setOrgId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (areaFilter && a.area_code !== areaFilter) return false;
      if (!q) return true;
      return (
        a.ref.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.doc_type.toLowerCase().includes(q) ||
        (a.regulatory_basis ?? '').toLowerCase().includes(q)
      );
    });
  }, [assets, query, areaFilter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function issue() {
    if (!orgId || selected.size === 0) return;
    setMessage(null);
    startTransition(async () => {
      const result = await issueDocuments({
        orgId,
        assetIds: [...selected],
        note: note || undefined,
      });
      if (result.ok) {
        setMessage({
          tone: 'ok',
          text: result.error
            ? result.error
            : `${selected.size} document${selected.size === 1 ? '' : 's'} issued — the client has been emailed.`,
        });
        setSelected(new Set());
        setNote('');
        router.refresh();
      } else {
        setMessage({ tone: 'error', text: result.error ?? 'Issue failed.' });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">
            Issue {selected.size > 0 ? `${selected.size} selected` : 'documents'} to
          </span>
          <Select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            aria-label="Client to issue documents to"
            className="w-64"
          >
            <option value="">Select a client</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note shown in their vault"
            className="flex-1 min-w-[200px] h-9 text-xs"
            aria-label="Issue note"
          />
          <button
            type="button"
            disabled={busy || !orgId || selected.size === 0}
            onClick={issue}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[hsl(220,45%,55%)] to-[hsl(220,50%,38%)] text-[#111722] px-4 py-2 text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-40"
          >
            <Send size={14} aria-hidden="true" /> {busy ? 'Issuing…' : 'Issue documents'}
          </button>
        </div>
        {message ? (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`text-sm ${message.tone === 'ok' ? 'text-green-400' : 'text-destructive'}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ref, title, type or regulation…"
            aria-label="Search library"
            className="pl-9"
          />
        </div>
        <Select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          aria-label="Filter by area"
          className="w-72"
        >
          <option value="">All 18 areas</option>
          {areas.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {assets.length} documents
      </p>

      <ul className="grid gap-2">
        {filtered.map((asset) => {
          const isSelected = selected.has(asset.id);
          return (
            <li key={asset.id}>
              <label
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors',
                  isSelected
                    ? 'border-[hsl(220,45%,55%)]/60 bg-[hsl(220,45%,55%)]/10'
                    : 'border-border bg-card hover:bg-muted/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(asset.id)}
                  className="accent-[hsl(220,45%,55%)]"
                  aria-label={`Select ${asset.ref} ${asset.title}`}
                />
                <span className="font-mono text-xs text-[hsl(220,60%,72%)] w-14 shrink-0">
                  {asset.ref}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{asset.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {asset.doc_type} · {asset.regulatory_basis}
                  </span>
                </span>
                <Badge className={cn('shrink-0', REQ_BADGE[asset.requirement])}>
                  {REQUIREMENT_LABELS[asset.requirement]}
                </Badge>
                {asset.storage_path ? (
                  <a
                    href={`/api/files/download?type=library&id=${asset.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-[hsl(220,60%,72%)] hover:underline shrink-0"
                  >
                    Preview
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0" title="Run npm run seed:library">
                    No file
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
