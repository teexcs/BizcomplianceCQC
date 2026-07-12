import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ScoreBreakdown } from '@/lib/audit/scoring';

/**
 * "How your score is calculated" — makes the harsh marking scheme visible so
 * the number reads as rigorous, not arbitrary. Server-rendered, no interactivity.
 */
export function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  const docPct = Math.round(breakdown.doc.scored * 100);
  const safPct = Math.round(breakdown.saf.scored * 100);
  const safScored = breakdown.safShare > 0 && breakdown.saf.answered > 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h2 className="font-display text-lg tracking-tight">How your score is calculated</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Marked strictly, the way an inspection would — no gap is smoothed over.
          </p>
        </div>

        {breakdown.legalWarning ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-3">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[hsl(4,65%,42%)]" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-[hsl(4,65%,42%)]">{breakdown.legalWarning}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Documents &amp; evidence</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(breakdown.docShare * 100)}% of score
              </p>
            </div>
            <p className="mt-1 font-display text-2xl tabular-nums">{docPct}/100</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {breakdown.doc.answered} of {breakdown.doc.total} evidence points assessed ·{' '}
              {breakdown.doc.missing} missing · {breakdown.doc.outOfDate} out of date
              {breakdown.doc.legalMissing > 0 ? (
                <span className="font-medium text-[hsl(4,65%,42%)]">
                  {' '}
                  · {breakdown.doc.legalMissing} legally-required gap
                  {breakdown.doc.legalMissing === 1 ? '' : 's'}
                </span>
              ) : null}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">SAF inspection interview</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(breakdown.safShare * 100)}% of score
              </p>
            </div>
            <p className="mt-1 font-display text-2xl tabular-nums">
              {safScored ? `${safPct}/100` : '—'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {safScored ? (
                <>
                  {breakdown.saf.answered} of {breakdown.saf.total} questions answered
                  {breakdown.saf.priorityFails > 0 ? (
                    <span className="font-medium text-[hsl(4,65%,42%)]">
                      {' '}
                      · {breakdown.saf.priorityFails} priority question
                      {breakdown.saf.priorityFails === 1 ? '' : 's'} failed
                    </span>
                  ) : (
                    ' · no priority questions failed'
                  )}
                </>
              ) : (
                'Not yet scored — your documents currently carry the full weight. The interview covers the five key questions CQC actually assesses.'
              )}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">The marking rules</p>
          <ul className="mt-1.5 space-y-1 list-disc pl-4">
            <li>
              Documents are weighted by consequence: legally required ×3 · CQC-expected ×2 · best
              practice ×1 · optional ×0.5.
            </li>
            <li>Present earns full credit · out of date earns 25% · missing earns nothing.</li>
            <li>
              SAF answers: yes = full credit · partial = 40% · no = 0, with priority questions
              weighted ×3.
            </li>
            <li>
              A missing or expired legally-required document marks its whole compliance area RED
              and is flagged at the top of your report.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
