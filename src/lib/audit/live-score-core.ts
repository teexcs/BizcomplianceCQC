import { REQUIREMENT_WEIGHT, itemStatusValue } from './scoring';
import type { ItemStatus, RequirementLevel } from '@/types/database';
import type { VerificationResult } from '@/lib/evidence/verify';

/**
 * Pure live-score maths — no I/O, no server dependencies — so it can be unit
 * tested directly. `live-score.ts` wraps these with the database reads.
 */

export const REVIEW_CYCLE_MONTHS = 12;

export interface ScoreFactors {
  /** ref -> effective status used for scoring. */
  itemStatuses: Record<string, ItemStatus>;
  /** Sum of requirement weights over answered doc items (for delta maths). */
  docWeightSum: number;
  /** Document half of the blended score: 0.6 when SAF answered, else 1. */
  docShare: number;
  counts: { present: number; outOfDate: number; missing: number; legalBreaches: number };
}

export interface ScoreReason {
  ref: string;
  delta: number; // signed points
  label: string;
}

export function monthsSince(isoDate: string): number {
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return 0;
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

export interface EvidenceSignal {
  reviewDate?: string | null;
  isTemplate?: boolean | null;
}

/**
 * Effective, as-of-now status for one checklist item.
 *
 * Crucially, the founder's delivered decision is the baseline — so a freshly
 * delivered audit's live score EQUALS its delivered score. It only diverges as
 * two real-world things happen over time:
 *   - AGING: an item the founder marked present, whose own on-file document has
 *     now crossed its 12-month review date (or is a template), decays.
 *   - RENEWAL: an item that was missing/out-of-date gains a fresh, in-date,
 *     customised document in the vault, and recovers.
 * Anything the vault can't clearly speak to keeps the founder's decision — the
 * score never moves for an invisible reason.
 */
export function liveItemStatus(
  base: ItemStatus,
  linked: EvidenceSignal | null | undefined,
  renewal: EvidenceSignal | null | undefined,
): ItemStatus {
  if (base === 'present') {
    if (linked?.isTemplate) return 'missing';
    if (linked?.reviewDate && monthsSince(linked.reviewDate) > REVIEW_CYCLE_MONTHS) {
      return 'out_of_date';
    }
    return 'present';
  }
  if (base === 'missing' || base === 'out_of_date') {
    const fresh =
      renewal &&
      !renewal.isTemplate &&
      (!renewal.reviewDate || monthsSince(renewal.reviewDate) <= REVIEW_CYCLE_MONTHS);
    return fresh ? 'present' : base;
  }
  return base;
}

/** Signed point contribution of a single item's status change to the 0–100 score. */
export function pointDelta(
  requirement: RequirementLevel,
  from: ItemStatus,
  to: ItemStatus,
  docWeightSum: number,
  docShare: number,
): number {
  if (docWeightSum <= 0) return 0;
  const change = itemStatusValue(to) - itemStatusValue(from);
  return Math.round((docShare * 100 * REQUIREMENT_WEIGHT[requirement] * change) / docWeightSum);
}

export function reasonLabel(title: string, from: ItemStatus, to: ItemStatus): string {
  const key = `${from}->${to}`;
  switch (key) {
    case 'present->out_of_date':
      return `${title} passed its 12-month review date`;
    case 'present->missing':
      return `${title} is no longer valid (un-customised template)`;
    case 'out_of_date->missing':
      return `${title} is still not replaced`;
    case 'out_of_date->present':
      return `${title} was renewed and is back in date`;
    case 'missing->present':
      return `${title} is now evidenced`;
    case 'missing->out_of_date':
      return `${title} was added but its review date has passed`;
    default:
      return `${title} changed`;
  }
}

/**
 * Diffs two snapshots into credit-score-style reasons: which items moved, in
 * which direction, and how many points each cost or earned. Biggest movers first.
 */
export function diffReasons(
  previous: ScoreFactors,
  current: ScoreFactors,
  itemMeta: Map<string, { title: string; requirement: RequirementLevel }>,
): ScoreReason[] {
  const reasons: ScoreReason[] = [];
  for (const [ref, currStatus] of Object.entries(current.itemStatuses)) {
    const prevStatus = previous.itemStatuses[ref];
    if (prevStatus === undefined || prevStatus === currStatus) continue;
    const meta = itemMeta.get(ref);
    if (!meta) continue;
    const delta = pointDelta(
      meta.requirement,
      prevStatus,
      currStatus,
      current.docWeightSum,
      current.docShare,
    );
    if (delta === 0) continue;
    reasons.push({ ref, delta, label: reasonLabel(meta.title, prevStatus, currStatus) });
  }
  return reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
