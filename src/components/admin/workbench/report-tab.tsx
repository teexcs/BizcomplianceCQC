'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Send, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { generateReport, publishReport, setAuditSummary } from '@/lib/actions/admin';
import { formatDate } from '@/lib/utils';
import type { Audit, Report } from '@/types/database';

interface Props {
  audit: Audit;
  reports: Report[];
}

export function ReportTab({ audit, reports }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(audit.summary ?? '');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { tone: 'ok', text: okText }
          : { tone: 'error', text: result.error ?? 'Something went wrong.' },
      );
      router.refresh();
    });
  }

  const latest = reports[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Label htmlFor="audit-summary">Executive summary (appears on page one of the report)</Label>
        <Textarea
          id="audit-summary"
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Two or three sentences on the provider's overall readiness position, their strengths, and where the critical gaps sit."
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => setAuditSummary(audit.id, summary), 'Summary saved.')}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          Save summary
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg tracking-tight">Report versions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate a draft PDF, review it, then publish to deliver it to the client (this also
              marks the audit as delivered and emails them).
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => generateReport(audit.id), 'Report generated — review the PDF below.')
            }
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[hsl(220,45%,55%)] to-[hsl(220,50%,38%)] text-[#111722] px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {busy ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <FileText size={15} aria-hidden="true" />
            )}
            Generate {latest ? 'new version' : 'report'}
          </button>
        </div>

        {message ? (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`text-sm mb-3 ${message.tone === 'ok' ? 'text-green-400' : 'text-destructive'}`}
          >
            {message.text}
          </p>
        ) : null}

        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No report generated yet. Complete the checklist and findings first, then generate.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Version {r.version} · Score {r.score}/100
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Generated {formatDate(r.created_at)}
                    {r.issued_at ? ` · published ${formatDate(r.issued_at)}` : ''}
                  </p>
                </div>
                {r.published ? (
                  <Badge className="bg-green-500/15 text-green-300">Published</Badge>
                ) : (
                  <Badge variant="outline">Draft</Badge>
                )}
                <a
                  href={`/api/files/download?type=report&id=${r.id}`}
                  className="text-xs text-[hsl(220,60%,72%)] hover:underline"
                >
                  View PDF
                </a>
                {!r.published ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => publishReport(r.id),
                        'Report published — the client has been notified.',
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-green-600/90 text-white px-3 py-1.5 text-xs font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    <Send size={12} aria-hidden="true" /> Publish to client
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
