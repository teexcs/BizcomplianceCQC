/**
 * Document integrity — anti-gaming checks.
 *
 * The signal engine fires when patterns match, so a provider could try to game
 * an audit by pasting a bare list of keywords ("safeguarding Regulation 13
 * abuse section 42 whistleblowing…") that fires many signals without being a
 * real policy. This module inspects the SUBSTANCE of a document and flags when
 * matched evidence is unusually thin, dense, or unstructured — so a keyword
 * dump is surfaced as "verify this is a real policy" rather than silently
 * credited.
 *
 * It never overrides the engine's found/not-found — it adds a warning the
 * auditor sees, and downgrades confidence so gamed docs cannot read as strong.
 * Deterministic and explainable.
 */

export type IntegrityLevel = 'ok' | 'suspect' | 'not_a_policy';

export interface DocumentIntegrity {
  level: IntegrityLevel;
  /** Words per matched signal — low means keyword-dense (gaming signal). */
  wordsPerSignal: number;
  /** Fraction of lines that read like real sentences (have a verb-ish structure). */
  sentenceRatio: number;
  words: number;
  reason: string | null;
}

// Common English function words — a real policy is full of them; a keyword list
// has almost none. Their density separates prose from a term dump.
const FUNCTION_WORDS =
  /\b(the|a|an|is|are|be|to|of|and|or|we|our|will|must|should|that|this|with|for|in|on|as|by|any|all|where|which|who|when|if|not|has|have|been|may|can|under|through|their|they|it|its)\b/gi;

/**
 * Assess whether a document is a genuine policy or a gaming attempt, given how
 * many evidence signals it fired.
 *
 * @param text        the document's extracted text
 * @param signalsFired number of evidence signals matched in it
 */
export function assessIntegrity(text: string, signalsFired: number): DocumentIntegrity {
  const clean = text.replace(/\s+/g, ' ').trim();
  const words = clean ? clean.split(' ').length : 0;
  const wordsPerSignal = signalsFired > 0 ? words / signalsFired : words;

  // Function-word density: prose ≈ 30–50%; a keyword dump ≈ under 10%.
  const functionMatches = (clean.match(FUNCTION_WORDS) ?? []).length;
  const functionDensity = words > 0 ? functionMatches / words : 0;

  // Sentence-likeness: lines/segments that end in a full stop and are long
  // enough to be a real sentence.
  const segments = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const sentenceLike = segments.filter((s) => s.split(' ').length >= 6).length;
  const sentenceRatio = segments.length > 0 ? sentenceLike / segments.length : 0;

  let level: IntegrityLevel = 'ok';
  let reason: string | null = null;

  // A document firing several signals but with very low prose density / very
  // few words per signal is almost certainly a keyword list, not a policy.
  if (signalsFired >= 3 && (functionDensity < 0.12 || wordsPerSignal < 5)) {
    level = 'not_a_policy';
    reason =
      'This document matches many compliance terms but reads like a keyword list, not a written policy — it should not be accepted as evidence until it is a real, structured document.';
  } else if (signalsFired >= 4 && sentenceRatio < 0.3 && words < 120) {
    level = 'suspect';
    reason =
      'This document is short and lightly structured for the breadth of terms it matches — verify it is a genuine policy rather than a summary or checklist.';
  }

  return { level, wordsPerSignal: Math.round(wordsPerSignal), sentenceRatio, words, reason };
}
