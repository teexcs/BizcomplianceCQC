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

// Weighting follows the checklist's requirement key: a missing LEGAL document
// is a likely RED for its area; CQC-expected items carry most of the remaining
// weight; best-practice and optional items refine the score without dominating.
const REQUIREMENT_WEIGHT: Record<RequirementLevel, number> = {
  legal: 3,
  cqc: 2,
  best: 1,
  optional: 0.5,
};

const ITEM_SCORE: Record<Exclude<ItemStatus, 'na' | 'unset'>, number> = {
  present: 1,
  out_of_date: 0.4,
  missing: 0,
};

const SAF_SCORE: Record<Exclude<SafAnswer, 'na' | 'unset'>, number> = {
  yes: 1,
  partial: 0.5,
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
    const w = priority ? 2 : 1;
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

/**
 * Overall readiness score, 0–100.
 * Documents carry 60%, the SAF interview 40%. If one half has no answers yet,
 * the other half carries the full weight so partial audits still show progress.
 */
export function computeReadinessScore(
  items: Pick<AuditItem, 'requirement' | 'status'>[],
  responses: Pick<SafResponse, 'question_id' | 'answer'>[],
  questions: Pick<SafQuestion, 'id' | 'priority'>[],
): number {
  const doc = scoreDocuments(items);
  const saf = scoreSaf(responses, questions);
  const docAnswered = items.some((i) => i.status !== 'unset' && i.status !== 'na');
  const safAnswered = responses.some((r) => r.answer !== 'unset' && r.answer !== 'na');

  let combined: number;
  if (docAnswered && safAnswered) combined = 0.6 * doc.scored + 0.4 * saf.scored;
  else if (docAnswered) combined = doc.scored;
  else if (safAnswered) combined = saf.scored;
  else combined = 0;

  return Math.round(combined * 100);
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

  const missing = considered.filter((i) => i.status === 'missing').length;
  if (missing / considered.length > 0.3) return 'red';
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
