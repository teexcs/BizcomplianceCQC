import type {
  AuditItem,
  AuditArea,
  SafResponse,
  SafQuestion,
  RagStatus,
  RequirementLevel,
  ItemStatus,
  SafAnswer,
} from '@/types/database';

/**
 * HARSH MARKING SCHEME — deliberate, and documented so it can be defended.
 *
 * A lot rides on the accuracy of the delivered report, so the score errs
 * strict: a provider must not look nearly-ready while carrying gaps a CQC
 * inspector would seize on. The rules, all enforced in this file:
 *
 *   1. Documents carry 60% of the score, the SAF interview 40% — the evidence
 *      base leads, the inspection interview refines.
 *   2. An out-of-date document earns 25% credit (not 40%) — an expired policy
 *      is barely better than none at inspection.
 *   3. A "partial" SAF answer earns 40% credit (not 50%).
 *   4. Priority SAF questions weigh ×3 — they're the rapid-triage questions
 *      an inspection turns on.
 *   5. The score itself stays PROPORTIONAL to the evidence (145/146 present
 *      really is ~94). Legal breaches are surfaced loudly instead of
 *      distorting the number: each one RAGs its area RED (suggestAreaRag)
 *      and is called out as a warning on the dashboard and in the PDF.
 */
export const REQUIREMENT_WEIGHT: Record<RequirementLevel, number> = {
  legal: 3,
  cqc: 2,
  best: 1,
  optional: 0.5,
};

export const ITEM_SCORE: Record<Exclude<ItemStatus, 'na' | 'unset'>, number> = {
  present: 1,
  out_of_date: 0.25, // rule 2 — expired evidence barely counts
  missing: 0,
};

/** Documents / SAF halves of the blended score. */
export const DOC_SHARE = 0.6;
export const SAF_SHARE = 0.4;

/** Rule 4 — priority SAF questions weigh ×3. */
export const SAF_PRIORITY_WEIGHT = 3;

/** Points an item contributes at its status (0 for na/unset). */
export function itemStatusValue(status: ItemStatus): number {
  return status === 'na' || status === 'unset' ? 0 : ITEM_SCORE[status];
}

const SAF_SCORE: Record<Exclude<SafAnswer, 'na' | 'unset'>, number> = {
  yes: 1,
  partial: 0.4, // rule 3
  no: 0,
};

export interface DocScoreBreakdown {
  scored: number; // 0..1 weighted
  answered: number;
  total: number;
  legalMissing: number;
  missing: number;
  outOfDate: number;
}

export function scoreDocuments(items: Pick<AuditItem, 'requirement' | 'status'>[]): DocScoreBreakdown {
  let weightSum = 0;
  let achieved = 0;
  let answered = 0;
  let legalMissing = 0;
  let missing = 0;
  let outOfDate = 0;

  for (const item of items) {
    if (item.status === 'unset' || item.status === 'na') {
      if (item.status !== 'unset') answered++;
      continue;
    }
    answered++;
    const w = REQUIREMENT_WEIGHT[item.requirement];
    weightSum += w;
    achieved += w * ITEM_SCORE[item.status];
    if (item.status === 'missing') {
      missing++;
      if (item.requirement === 'legal') legalMissing++;
    }
    if (item.status === 'out_of_date') {
      outOfDate++;
      if (item.requirement === 'legal') legalMissing++;
    }
  }

  return {
    scored: weightSum > 0 ? achieved / weightSum : 0,
    answered,
    total: items.length,
    legalMissing,
    missing,
    outOfDate,
  };
}

export interface SafScoreBreakdown {
  scored: number; // 0..1 weighted
  answered: number;
  total: number;
  priorityFails: number;
}

export function scoreSaf(
  responses: Pick<SafResponse, 'question_id' | 'answer'>[],
  questions: Pick<SafQuestion, 'id' | 'priority'>[],
): SafScoreBreakdown {
  const priorityById = new Map(questions.map((q) => [q.id, q.priority]));
  let weightSum = 0;
  let achieved = 0;
  let answered = 0;
  let priorityFails = 0;

  for (const r of responses) {
    if (r.answer === 'unset' || r.answer === 'na') {
      if (r.answer !== 'unset') answered++;
      continue;
    }
    answered++;
    const priority = priorityById.get(r.question_id) ?? false;
    const w = priority ? SAF_PRIORITY_WEIGHT : 1;
    weightSum += w;
    achieved += w * SAF_SCORE[r.answer];
    if (priority && r.answer === 'no') priorityFails++;
  }

  return {
    scored: weightSum > 0 ? achieved / weightSum : 0,
    answered,
    total: responses.length,
    priorityFails,
  };
}

export interface ScoreBreakdown {
  /** Final 0–100 score — always proportional to the evidence. */
  score: number;
  /** Loud warning when legal gaps exist (shown on dashboard + PDF, score untouched). */
  legalWarning: string | null;
  doc: DocScoreBreakdown;
  saf: SafScoreBreakdown;
  docShare: number;
  safShare: number;
}

/**
 * Overall readiness score, 0–100 — harsh but proportional (see the scheme at
 * the top of this file). Documents carry 60%, the SAF interview 40%; if
 * one half has no answers yet the other carries the full weight so
 * in-progress audits still show movement.
 */
export function computeScoreBreakdown(
  items: Pick<AuditItem, 'requirement' | 'status'>[],
  responses: Pick<SafResponse, 'question_id' | 'answer'>[],
  questions: Pick<SafQuestion, 'id' | 'priority'>[],
): ScoreBreakdown {
  const doc = scoreDocuments(items);
  const saf = scoreSaf(responses, questions);
  const docAnswered = items.some((i) => i.status !== 'unset' && i.status !== 'na');
  const safAnswered = responses.some((r) => r.answer !== 'unset' && r.answer !== 'na');

  let combined: number;
  let docShare = DOC_SHARE;
  let safShare = SAF_SHARE;
  if (docAnswered && safAnswered) combined = DOC_SHARE * doc.scored + SAF_SHARE * saf.scored;
  else if (docAnswered) {
    combined = doc.scored;
    docShare = 1;
    safShare = 0;
  } else if (safAnswered) {
    combined = saf.scored;
    docShare = 0;
    safShare = 1;
  } else {
    combined = 0;
  }

  const score = Math.round(combined * 100);

  // Legal gaps never distort the number — they are surfaced loudly instead.
  const legalWarning =
    doc.legalMissing > 0
      ? `${doc.legalMissing} legally-required document${doc.legalMissing === 1 ? ' is' : 's are'} missing or out of date — each marks its compliance area RED and would be an immediate focus at inspection.`
      : null;

  return { score, legalWarning, doc, saf, docShare, safShare };
}

export interface ScoreExplanation {
  /** One-line headline you can say on a call. */
  headline: string;
  /** The maths, spelled out: contribution of each half to the final number. */
  parts: { label: string; detail: string; points: number }[];
  /** The specific things dragging the score down, most material first. */
  drags: string[];
}

/**
 * Turn a ScoreBreakdown into a defensible, plain-English explanation — the
 * "why is it 82?" you can stand behind in front of a client. Pure: derived only
 * from the breakdown, so the explanation can never disagree with the number.
 */
export function explainScore(b: ScoreBreakdown): ScoreExplanation {
  const docPoints = Math.round(b.docShare * b.doc.scored * 100);
  const safPoints = Math.round(b.safShare * b.saf.scored * 100);

  const parts: { label: string; detail: string; points: number }[] = [
    {
      label: 'Documents & evidence',
      detail: `${Math.round(b.doc.scored * 100)}/100 on the evidence base, weighted ${Math.round(b.docShare * 100)}%`,
      points: docPoints,
    },
  ];
  if (b.safShare > 0 && b.saf.answered > 0) {
    parts.push({
      label: 'SAF interview',
      detail: `${Math.round(b.saf.scored * 100)}/100 across the five key questions, weighted ${Math.round(b.safShare * 100)}%`,
      points: safPoints,
    });
  }

  const drags: string[] = [];
  if (b.doc.legalMissing > 0) {
    drags.push(
      `${b.doc.legalMissing} legally-required document${b.doc.legalMissing === 1 ? '' : 's'} missing or out of date (each weighted ×3, so these hurt most)`,
    );
  }
  if (b.doc.missing > b.doc.legalMissing) {
    drags.push(`${b.doc.missing - b.doc.legalMissing} other expected document${b.doc.missing - b.doc.legalMissing === 1 ? '' : 's'} not evidenced`);
  }
  if (b.doc.outOfDate > 0) {
    drags.push(`${b.doc.outOfDate} document${b.doc.outOfDate === 1 ? '' : 's'} past review (counts at 25%)`);
  }
  if (b.saf.priorityFails > 0) {
    drags.push(`${b.saf.priorityFails} priority interview question${b.saf.priorityFails === 1 ? '' : 's'} answered "no" (weighted ×3)`);
  }

  const headline =
    b.score >= 85
      ? `${b.score}/100 — inspection-ready, with minor tidy-ups.`
      : b.score >= 70
        ? `${b.score}/100 — broadly ready; a focused action plan closes the gap.`
        : b.score >= 50
          ? `${b.score}/100 — meaningful gaps to address before an inspection.`
          : `${b.score}/100 — significant work needed; treat the fix-first items as urgent.`;

  return { headline, parts, drags };
}

/** Overall readiness score, 0–100 (the headline number from the breakdown). */
export function computeReadinessScore(
  items: Pick<AuditItem, 'requirement' | 'status'>[],
  responses: Pick<SafResponse, 'question_id' | 'answer'>[],
  questions: Pick<SafQuestion, 'id' | 'priority'>[],
): number {
  return computeScoreBreakdown(items, responses, questions).score;
}

/**
 * Suggested area RAG per the checklist rule: any LEGAL document Missing or
 * Out-of-date is a likely RED for that area.
 */
export function suggestAreaRag(items: Pick<AuditItem, 'requirement' | 'status'>[]): RagStatus {
  const considered = items.filter((i) => i.status !== 'unset' && i.status !== 'na');
  if (considered.length === 0) return 'unset';

  const legalBreach = considered.some(
    (i) => i.requirement === 'legal' && (i.status === 'missing' || i.status === 'out_of_date'),
  );
  if (legalBreach) return 'red';

  // Harsh marking: over a quarter of an area's evidence missing is a RED, and
  // heavy staleness (missing + expired over 40%) is treated the same way.
  const missing = considered.filter((i) => i.status === 'missing').length;
  const stale = considered.filter((i) => i.status === 'out_of_date').length;
  if (missing / considered.length > 0.25) return 'red';
  if ((missing + stale) / considered.length > 0.4) return 'red';
  if (considered.some((i) => i.status === 'missing' || i.status === 'out_of_date')) return 'amber';
  return 'green';
}

export function ragCounts(areas: Pick<AuditArea, 'rag'>[]) {
  return {
    green: areas.filter((a) => a.rag === 'green').length,
    amber: areas.filter((a) => a.rag === 'amber').length,
    red: areas.filter((a) => a.rag === 'red').length,
    unset: areas.filter((a) => a.rag === 'unset').length,
  };
}

export const SAF_DOMAIN_LABELS: Record<string, string> = {
  safe: 'Safe',
  effective: 'Effective',
  caring: 'Caring',
  responsive: 'Responsive',
  well_led: 'Well-led',
};

export interface SafDomainScore {
  domain: string;
  label: string;
  /** 0–10 (one decimal) from answered questions; null when none answered. */
  score: number | null;
  answered: number;
  total: number;
  priorityFails: number;
}

/**
 * Per-domain SAF scores under the harsh scheme — the five key questions CQC
 * actually assesses. Pure, so the client dashboard, the admin SAF sheet and
 * the PDF report all compute the same numbers.
 */
export function safDomainScores(
  responses: Pick<SafResponse, 'question_id' | 'answer'>[],
  questions: Pick<SafQuestion, 'id' | 'domain' | 'priority'>[],
): SafDomainScore[] {
  const qById = new Map(questions.map((q) => [q.id, q]));
  const agg = new Map<
    string,
    { weight: number; achieved: number; answered: number; total: number; priorityFails: number }
  >();
  for (const q of questions) {
    const cur = agg.get(q.domain) ?? { weight: 0, achieved: 0, answered: 0, total: 0, priorityFails: 0 };
    cur.total++;
    agg.set(q.domain, cur);
  }
  for (const r of responses) {
    const q = qById.get(r.question_id);
    if (!q) continue;
    const cur = agg.get(q.domain);
    if (!cur) continue;
    if (r.answer === 'unset') continue;
    cur.answered++;
    if (r.answer === 'na') continue;
    const w = q.priority ? SAF_PRIORITY_WEIGHT : 1;
    cur.weight += w;
    cur.achieved += w * SAF_SCORE[r.answer];
    if (q.priority && r.answer === 'no') cur.priorityFails++;
  }

  return Object.entries(SAF_DOMAIN_LABELS).map(([domain, label]) => {
    const a = agg.get(domain);
    return {
      domain,
      label,
      score: a && a.weight > 0 ? Math.round((a.achieved / a.weight) * 100) / 10 : null,
      answered: a?.answered ?? 0,
      total: a?.total ?? 0,
      priorityFails: a?.priorityFails ?? 0,
    };
  });
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  unset: 'Not reviewed',
  present: 'Present',
  missing: 'Missing',
  out_of_date: 'Out-of-date',
  na: 'N/A',
};

export const REQUIREMENT_LABELS: Record<RequirementLevel, string> = {
  legal: 'LEGAL',
  cqc: 'CQC',
  best: 'BEST',
  optional: 'OPT',
};

export const FINDING_PRIORITY_LABELS: Record<string, string> = {
  fix_first: 'Fix first',
  days_7: '7 days',
  days_14: '14 days',
  days_30: '30 days',
};

export const AUDIT_STATUS_LABELS: Record<string, string> = {
  intake: 'Intake',
  evidence: 'Evidence collection',
  in_review: 'In review',
  report_draft: 'Report draft',
  delivered: 'Delivered',
  closed: 'Closed',
};
