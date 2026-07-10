import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireOrgSession } from '@/lib/data/session';
import { createClient } from '@/lib/supabase/server';
import { FeatureLocked } from '@/components/dashboard/feature-locked';
import { MockSafQuiz } from '@/components/dashboard/mock-saf-quiz';
import { SAF_DOMAIN_LABELS } from '@/lib/audit/scoring';
import type { SafQuestion, SafDomain } from '@/types/database';

export const dynamic = 'force-dynamic';

const DOMAIN_ORDER: SafDomain[] = ['safe', 'effective', 'caring', 'responsive', 'well_led'];

export default async function SafPrepPage() {
  const ctx = await requireOrgSession();
  if (!ctx.entitlements.safPrep) {
    return (
      <FeatureLocked
        title="Mock SAF interview preparation"
        requiredPlan="Professional"
        description="Practise the 68 questions inspectors use as a framework across the five key questions, with the exact evidence each one looks for — so nothing catches your team off guard on the day."
      />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.from('saf_questions').select('*').order('id');
  const questions = (data as SafQuestion[]) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">SAF interview preparation</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          The Single Assessment Framework in full: {questions.length} questions across the five key
          questions, each with the evidence an inspector expects to see. Walk your team through the
          ★ priority questions first.
        </p>
      </div>

      <MockSafQuiz questions={questions} />

      {DOMAIN_ORDER.map((domain) => {
        const domainQuestions = questions.filter((q) => q.domain === domain);
        if (!domainQuestions.length) return null;
        const statements = new Map<number, SafQuestion[]>();
        for (const q of domainQuestions) {
          const list = statements.get(q.statement_no) ?? [];
          list.push(q);
          statements.set(q.statement_no, list);
        }
        return (
          <Card key={domain}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-xl tracking-tight">{SAF_DOMAIN_LABELS[domain]}</h2>
                <Badge variant="outline">{domainQuestions.length} questions</Badge>
              </div>
              {[...statements.entries()].map(([no, qs]) => (
                <div key={no} className="mt-4 first:mt-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {no}. {qs[0].statement}
                  </p>
                  <ul className="mt-2 space-y-2.5">
                    {qs.map((q) => (
                      <li key={q.id} className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-sm leading-relaxed">
                          {q.priority ? (
                            <span
                              className="text-[hsl(220,45%,45%)] font-semibold mr-1"
                              aria-label="Priority question"
                            >
                              ★
                            </span>
                          ) : null}
                          {q.question}
                        </p>
                        {q.evidence_hint ? (
                          <p className="mt-1.5 text-xs text-muted-foreground italic">
                            Evidence to have ready: {q.evidence_hint}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
