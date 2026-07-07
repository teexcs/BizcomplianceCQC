'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { reviewEvidence } from '@/lib/actions/admin';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface EvidenceRowData {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  area_code: string | null;
  areaName: string | null;
  orgName: string;
  scan_status: string;
  review_status: string;
  reviewer_note: string | null;
  created_at: string;
}

export function EvidenceReviewRow({ row }: { row: EvidenceRowData }) {
  const router = useRouter();
  const [note, setNote] = useState(row.reviewer_note ?? '');
  const [busy, startTransition] = useTransition();

  function setStatus(review_status: 'reviewed' | 'flagged' | 'pending') {
    startTransition(async () => {
      await reviewEvidence({ evidenceId: row.id, review_status, reviewer_note: note || null });
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{row.file_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {row.orgName}
            {row.areaName ? ` · ${row.area_code} ${row.areaName}` : ' · unsorted'} ·{' '}
            {Math.max(1, Math.round(row.size_bytes / 1024))} KB · {formatDate(row.created_at)}
          </p>
        </div>
        {row.scan_status === 'pending' ? (
          <Badge variant="outline" title="Malware scanner not configured or unavailable">
            Unscanned
          </Badge>
        ) : null}
        <Badge
          className={cn(
            row.review_status === 'reviewed'
              ? 'bg-green-500/15 text-green-300'
              : row.review_status === 'flagged'
                ? 'bg-red-500/15 text-red-300'
                : 'bg-amber-500/15 text-amber-300',
          )}
        >
          {row.review_status}
        </Badge>
        <a
          href={`/api/files/download?type=evidence&id=${row.id}`}
          className="text-xs text-[hsl(36,60%,72%)] hover:underline"
        >
          Open
        </a>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reviewer note (visible to the client)…"
          aria-label={`Review note for ${row.file_name}`}
          className="flex-1 min-w-[220px] h-8 text-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus('reviewed')}
          className="rounded-md bg-green-600/90 text-white px-3 py-1.5 text-xs font-semibold hover:bg-green-600 disabled:opacity-50"
        >
          Mark reviewed
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setStatus('flagged')}
          className="rounded-md bg-red-600/80 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-600 disabled:opacity-50"
        >
          Flag
        </button>
      </div>
    </li>
  );
}
