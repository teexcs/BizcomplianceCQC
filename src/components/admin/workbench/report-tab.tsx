'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Send, RefreshCw, ClipboardCheck, Copy } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { generateReport, publishReport, setAuditSummary } from '@/lib/actions/admin';
import { getAuditAnalysis } from '@/lib/actions/engine';
import { formatDate } from '@/lib/utils';
import type { Audit, Report } from '@/types/database';
import { ClientDocumentIssuer } from './client-document-issuer';

interface Props {
  audit: Audit;
  reports: Report[];
  organisationName: string;
}

export function ReportTab({ audit, reports, organisationName }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(audit.summary ?? '');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadAnalysis() {
    setAnalysisBusy(true);
    setMessage(null);
    const res = await getAuditAnalysis(audit.id);
    setAnalysisBusy(false);
    if (res.ok && res.markdown) setAnalysis(res.markdown);
    else setMessage({ tone: 'error', text: res.error ?? 'Could not build the analysis.' });
  }

  async function copyAnalysis() {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage({ tone: 'error', text: 'Copy failed — select the text and copy manually.' });
    }
  }

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg tracking-tight">Full evidence analysis (internal)</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              The deterministic reader&apos;s complete, quoted read of the vault — every signal found or
              not found, red flags, expired reviews and library coverage. This is your working document:
              review it to confirm your findings before you issue anything to the client. Not shown to
              the client.
            </p>
          </div>
          <button
            type="button"
            disabled={analysisBusy}
            onClick={loadAnalysis}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {analysisBusy ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <ClipboardCheck size={15} aria-hidden="true" />
            )}
            {analysis ? 'Rebuild analysis' : 'Build analysis'}
          </button>
        </div>
        {analysis ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={copyAnalysis}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Copy size={12} aria-hidden="true" /> {copied ? 'Copied ✓' : 'Copy report'}
              </button>
            </div>
            <pre className="max-h-[440px] overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs whitespace-pre-wrap font-mono leading-relaxed">
              {analysis}
            </pre>
          </div>
        ) : null}
      </div>

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

      <ClientDocumentIssuer
        auditId={audit.id}
        auditStatus={audit.status}
        organisationName={organisationName}
      />
    </div>
  );
}
