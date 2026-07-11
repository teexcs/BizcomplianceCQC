'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Zap, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { setSafAnswer } from '@/lib/actions/admin';
import { SAF_DOMAIN_LABELS } from '@/lib/audit/scoring';
import type { SafQuestion, SafResponse, SafAnswer, SafDomain } from '@/types/database';

const ANSWER_OPTIONS: { value: SafAnswer; label: string; active: string }[] = [
  { value: 'yes', label: 'Yes', active: 'bg-green-500/20 text-green-300 ring-1 ring-green-500/40' },
  { value: 'partial', label: 'Partial', active: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' },
  { value: 'no', label: 'No', active: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40' },
  { value: 'na', label: 'N/A', active: 'bg-muted text-foreground ring-1 ring-border' },
];

const DOMAIN_ORDER: SafDomain[] = ['safe', 'effective', 'caring', 'responsive', 'well_led'];

const DOMAIN_ACCENT: Record<SafDomain, string> = {
  safe: 'border-l-teal-500',
  effective: 'border-l-blue-500',
  caring: 'border-l-purple-500',
  responsive: 'border-l-amber-500',
  well_led: 'border-l-green-600',
};

interface Props {
  questions: SafQuestion[];
  responses: SafResponse[];
}

export function SafSheet({ questions, responses }: Props) {
  const router = useRouter();
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const responseByQuestion = useMemo(
    () => new Map(responses.map((r) => [r.question_id, r])),
    [responses],
  );

  const answered = responses.filter((r) => r.answer !== 'unset').length;

  function answer(resp: SafResponse, value: SafAnswer) {
    setPending(resp.id);
    startTransition(async () => {
      await setSafAnswer({
        responseId: resp.id,
        answer: resp.answer === value ? 'unset' : value,
        note: resp.note,
      });
      setPending(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {answered} of {questions.length} answered · ★ marks rapid-triage priority questions.
          Thresholds are provider-set, not statutory.
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={priorityOnly}
            onChange={(e) => setPriorityOnly(e.target.checked)}
            className="accent-[hsl(220,45%,55%)]"
          />
          Priority questions only
        </label>
      </div>

      {DOMAIN_ORDER.map((domain) => {
        const domainQuestions = questions
          .filter((q) => q.domain === domain)
          .filter((q) => !priorityOnly || q.priority);
        if (domainQuestions.length === 0) return null;

        const statements = new Map<number, SafQuestion[]>();
        for (const q of domainQuestions) {
          const list = statements.get(q.statement_no) ?? [];
          list.push(q);
          statements.set(q.statement_no, list);
        }

        return (
          <section key={domain} className={cn('rounded-xl border border-border bg-card border-l-4', DOMAIN_ACCENT[domain])}>
            <h3 className="px-5 pt-4 font-display text-lg tracking-tight">
              {SAF_DOMAIN_LABELS[domain]}
              <span className="ml-2 text-xs text-muted-foreground font-sans">
                {domainQuestions.length} questions
              </span>
            </h3>
            <div className="px-5 pb-4">
              {[...statements.entries()].map(([statementNo, qs]) => (
                <div key={statementNo} className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {statementNo}. {qs[0].statement}
                  </p>
                  <ul className="mt-2 space-y-3">
                    {qs.map((q) => {
                      const resp = responseByQuestion.get(q.id);
                      if (!resp) return null;
                      return (
                        <li key={q.id} className="rounded-lg bg-muted/25 px-4 py-3">
                          <div className="flex flex-wrap items-start gap-3">
                            <p className="flex-1 min-w-[240px] text-sm leading-relaxed">
                              {q.priority ? (
                                <Star
                                  size={13}
                                  aria-label="Priority question"
                                  className="inline mr-1.5 -mt-0.5 fill-[hsl(220,60%,60%)] text-[hsl(220,60%,60%)]"
                                />
                              ) : null}
                              <span className="font-mono text-xs text-muted-foreground mr-2">
                                {q.id}.
                              </span>
                              {q.question}
                            </p>
                            <div
                              className="flex gap-1 shrink-0"
                              role="group"
                              aria-label={`Answer for question ${q.id}`}
                            >
                              {ANSWER_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={pending === resp.id}
                                  onClick={() => answer(resp, opt.value)}
                                  aria-pressed={resp.answer === opt.value}
                                  className={cn(
                                    'text-[11px] px-2.5 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50',
                                    resp.answer === opt.value
                                      ? opt.active
                                      : 'bg-muted/50 text-muted-foreground hover:text-foreground',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {q.evidence_hint ? (
                            <p className="mt-1.5 text-xs text-muted-foreground italic">
                              Evidence: {q.evidence_hint}
                            </p>
                          ) : null}
                          {resp.answer === 'unset' && resp.suggested_answer !== 'unset' ? (
                            <SafSuggestion resp={resp} onAccept={answer} />
                          ) : null}
                          {resp.answer !== 'unset' ? <SafNote resp={resp} /> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SafSuggestion({
  resp,
  onAccept,
}: {
  resp: SafResponse;
  onAccept: (resp: SafResponse, value: SafAnswer) => void;
}) {
  const label = ANSWER_OPTIONS.find((o) => o.value === resp.suggested_answer)?.label ?? '';
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Zap size={11} aria-hidden="true" />
          Engine: {label}
        </span>
        <button
          type="button"
          onClick={() => onAccept(resp, resp.suggested_answer)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
        >
          <Check size={11} aria-hidden="true" /> Accept
        </button>
      </div>
      {resp.suggestion_reason ? (
        <p className="max-w-[640px] text-[11px] leading-relaxed text-muted-foreground/90">
          {resp.suggestion_reason}
        </p>
      ) : null}
    </div>
  );
}

function SafNote({ resp }: { resp: SafResponse }) {
  const router = useRouter();
  const [note, setNote] = useState(resp.note ?? '');
  const [, startTransition] = useTransition();

  return (
    <Input
      value={note}
      onChange={(e) => setNote(e.target.value)}
      onBlur={() => {
        if (note !== (resp.note ?? '')) {
          startTransition(async () => {
            await setSafAnswer({ responseId: resp.id, answer: resp.answer, note });
            router.refresh();
          });
        }
      }}
      placeholder="Evidence note…"
      aria-label={`Note for question ${resp.question_id}`}
      className="mt-2 text-xs h-8"
    />
  );
}
