'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { SafAnswer, SafQuestion } from '@/types/database';

const ANSWERS: { value: SafAnswer; label: string; score: number }[] = [
  { value: 'yes', label: 'Yes', score: 1 },
  { value: 'partial', label: 'Partial', score: 0.5 },
  { value: 'no', label: 'No', score: 0 },
  { value: 'na', label: 'N/A', score: 0 },
];

function buildQuiz(questions: SafQuestion[]): SafQuestion[] {
  const priority = questions.filter((q) => q.priority);
  const remainder = questions.filter((q) => !q.priority);
  const pick: SafQuestion[] = [];
  for (const q of priority.slice(0, 5)) pick.push(q);
  for (const q of remainder.slice(0, 5)) pick.push(q);
  return pick.slice(0, 10);
}

export function MockSafQuiz({ questions }: { questions: SafQuestion[] }) {
  const quiz = useMemo(() => buildQuiz(questions), [questions]);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, SafAnswer>>({});

  const current = quiz[index] ?? null;
  const completed = quiz.length > 0 && index >= quiz.length;
  const score = quiz.reduce((sum, question) => {
    const answer = answers[question.id] ?? 'unset';
    const row = ANSWERS.find((a) => a.value === answer);
    return sum + (row?.score ?? 0);
  }, 0);
  const percent = quiz.length ? Math.round((score / quiz.length) * 100) : 0;
  const missed = quiz.filter((question) => {
    const answer = answers[question.id];
    return answer !== 'yes' && answer !== 'partial';
  });

  function choose(value: SafAnswer) {
    if (!current) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value }));
    setIndex((currentIndex) => currentIndex + 1);
  }

  function restart() {
    setAnswers({});
    setIndex(0);
    setActive(false);
  }

  if (!active) {
    return (
      <div className="rounded-none border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Mock quiz</p>
            <h2 className="font-display text-2xl tracking-tight">Turn the checklist into practice</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Work through the checklist below, then run a short quiz based on the same SAF questions so your team can rehearse the inspection conversation.
            </p>
          </div>
          <Badge variant="outline">{quiz.length} questions</Badge>
        </div>
        <button
          type="button"
          onClick={() => setActive(true)}
          className="inline-flex items-center justify-center rounded-md bg-[hsl(220,50%,15%)] px-4 py-2.5 text-sm font-medium text-[hsl(36,33%,97%)] transition-colors hover:bg-[hsl(220,50%,20%)]"
        >
          Start mock quiz
        </button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="rounded-none border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Mock quiz</p>
            <h2 className="font-display text-2xl tracking-tight">Quiz complete</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You scored {percent}% across {quiz.length} questions.
            </p>
          </div>
          <Badge className="bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)]">{percent}%</Badge>
        </div>

        {missed.length ? (
          <div className="rounded-none border border-border bg-muted/20 p-4">
            <p className="text-sm font-medium">Review these next</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {missed.slice(0, 5).map((question) => (
                <li key={question.id}>{question.question}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Strong run. Keep using the checklist to keep the answers consistent.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setAnswers({});
            }}
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Retry quiz
          </button>
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center justify-center rounded-md bg-[hsl(220,50%,15%)] px-4 py-2 text-sm font-medium text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,20%)]"
          >
            Back to checklist
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="rounded-none border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Mock quiz</p>
            <h2 className="font-display text-2xl tracking-tight">Question {index + 1} of {quiz.length}</h2>
          </div>
        <Badge variant="outline">{quiz.length ? Math.round((index / quiz.length) * 100) : 0}% complete</Badge>
        </div>

      <div className="rounded-none border border-border bg-muted/20 p-4">
        <p className="text-sm font-medium leading-relaxed">{current.question}</p>
        {current.evidence_hint ? (
          <p className="mt-2 text-xs text-muted-foreground italic">
            Evidence to have ready: {current.evidence_hint}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {ANSWERS.map((answer) => (
          <button
            key={answer.value}
            type="button"
            onClick={() => choose(answer.value)}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {answer.label}
          </button>
        ))}
      </div>
    </div>
  );
}
