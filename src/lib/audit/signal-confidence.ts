/**
 * Signal confidence & explainability.
 *
 * The vendored engine reports a signal as found / not found with quoted
 * citations. This app-layer module turns that into a graded confidence with a
 * plain-English "why", so the auditor can trust strong matches at a glance and
 * knows exactly which weak matches to double-check by eye. It NEVER changes
 * whether a signal is found — it only explains the strength of the evidence.
 *
 * Pure and deterministic: the same citations always produce the same grade.
 */

export type ConfidenceLevel = 'strong' | 'moderate' | 'weak';

export interface SignalConfidence {
  level: ConfidenceLevel;
  /** 0–100, monotonic with strength — for sorting/threshold decisions. */
  score: number;
  /** Number of distinct evidence lines that matched. */
  matchCount: number;
  /** Number of distinct documents the evidence came from. */
  documentCount: number;
  /** Plain-English explanation the auditor can read and defend. */
  reason: string;
}

export interface CitationLike {
  fileName?: string;
  line: number;
  quote: string;
}

/**
 * Grade the strength of evidence for one signal from its citations.
 *
 *  • strong   — corroborated (≥2 lines, or evidence in ≥2 documents);
 *  • moderate — a single clear, substantial citation;
 *  • weak     — a single short/thin citation (worth an eyeball).
 */
export function gradeSignal(citations: CitationLike[]): SignalConfidence {
  const matchCount = citations.length;
  const documentCount = new Set(
    citations.map((c) => c.fileName ?? '').filter((n) => n.length > 0),
  ).size || (matchCount > 0 ? 1 : 0);

  if (matchCount === 0) {
    return {
      level: 'weak',
      score: 0,
      matchCount: 0,
      documentCount: 0,
      reason: 'No supporting line was found for this point.',
    };
  }

  // A citation is "substantial" when it is a real sentence, not a stray token.
  const longestQuote = Math.max(...citations.map((c) => c.quote.trim().length));
  const substantial = longestQuote >= 40;

  let level: ConfidenceLevel;
  let score: number;
  if (matchCount >= 2 || documentCount >= 2) {
    level = 'strong';
    // More corroboration and more documents push the score up.
    score = Math.min(100, 70 + matchCount * 6 + (documentCount - 1) * 8);
  } else if (substantial) {
    level = 'moderate';
    score = 55;
  } else {
    level = 'weak';
    score = 35;
  }

  const where =
    documentCount >= 2
      ? `${matchCount} lines across ${documentCount} documents`
      : matchCount >= 2
        ? `${matchCount} lines in the document`
        : substantial
          ? 'one clear reference'
          : 'a single brief reference';

  const reason =
    level === 'strong'
      ? `Corroborated by ${where} — high confidence this is genuinely covered.`
      : level === 'moderate'
        ? `Evidenced by ${where}. Reasonable confidence; confirm it is not boilerplate.`
        : `Only ${where} — verify by eye that this really covers the requirement.`;

  return { level, score, matchCount, documentCount, reason };
}

/** Aggregate confidence across a set of signals (e.g. an area's proven signals). */
export function aggregateConfidence(grades: SignalConfidence[]): {
  strong: number;
  moderate: number;
  weak: number;
} {
  return {
    strong: grades.filter((g) => g.level === 'strong').length,
    moderate: grades.filter((g) => g.level === 'moderate').length,
    weak: grades.filter((g) => g.level === 'weak').length,
  };
}

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
};
