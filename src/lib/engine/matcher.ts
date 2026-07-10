import 'server-only';

/**
 * Deterministic evidence↔checklist matching.
 *
 * No AI, no network calls: pure token scoring, so results are instant,
 * repeatable and explainable. Every suggestion carries a confidence and a
 * human-readable reason; a person always makes the final call.
 */

const STOPWORDS = new Set([
  'the', 'and', 'of', 'for', 'a', 'an', 'to', 'in', 'on', 'with', 'or',
  'copy', 'final', 'draft', 'new', 'updated', 'update', 'version', 'signed',
  'scan', 'scanned', 'doc', 'document', 'file', 'template', 'blank', 'completed',
]);

// Domain synonyms/abbreviations widely used in care-service filenames.
const SYNONYMS: Record<string, string[]> = {
  mar: ['medicines', 'administration', 'record'],
  medication: ['medicines'],
  medications: ['medicines'],
  meds: ['medicines'],
  dbs: ['dbs'],
  sop: ['statement', 'purpose'],
  ipc: ['infection', 'prevention', 'control'],
  coshh: ['coshh'],
  riddor: ['riddor', 'accident'],
  mca: ['mental', 'capacity'],
  dols: ['deprivation', 'liberty'],
  rota: ['staffing'],
  hr: ['recruitment'],
  cd: ['controlled', 'drugs'],
  gdpr: ['data', 'protection'],
  ropa: ['processing', 'activities', 'record'],
  sar: ['subject', 'access', 'request'],
  bcp: ['business', 'continuity'],
  eol: ['end', 'life'],
  prn: ['prn'],
  hs: ['health', 'safety'],
  ra: ['risk', 'assessment'],
};

export function tokenize(raw: string): string[] {
  const cleaned = raw
    .toLowerCase()
    .replace(/\.(docx?|pdf|xlsx?|csv|png|jpe?g|webp)$/i, '')
    // strip version/date noise: v3, v1.2, 2024-2026, (1), _final
    .replace(/\bv\d+(\.\d+)?\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ');

  const tokens: string[] = [];
  for (const token of cleaned.split(' ')) {
    if (!token || token.length < 2 || STOPWORDS.has(token)) continue;
    if (SYNONYMS[token]) tokens.push(...SYNONYMS[token]);
    else tokens.push(token);
  }
  return [...new Set(tokens)];
}

export interface MatchCandidate {
  /** e.g. 'SG-01' */
  ref: string;
  areaCode: string;
  title: string;
  docType: string;
}

export interface MatchInput {
  fileName: string;
  areaCode: string | null;
  /** Extracted document text (Phase 0). Confirms and rescues weak filenames. */
  content?: string | null;
}

export interface MatchResult {
  ref: string;
  confidence: number; // 0..1
  reason: string;
}

const REF_PATTERN = /\b([a-z]{2})[\s_-]?(\d{2})\b/i;
// The document's identity lives in its opening (title, purpose, headings);
// scanning the whole body invites cross-topic false positives.
const CONTENT_SCAN_CHARS = 6000;

/**
 * Scores one evidence file against every checklist item and returns matches
 * above threshold, best first.
 *
 * Precedence: an explicit library reference in the filename wins outright; then
 * filename term-coverage (high precision); document text both *confirms* a
 * filename match (raising confidence) and *rescues* a badly-named file whose
 * content clearly matches an item in the same area.
 */
export function matchEvidence(
  input: MatchInput,
  candidates: MatchCandidate[],
  threshold = 0.55,
): MatchResult[] {
  // Exact ref in the filename (e.g. "SG-01 Safeguarding Policy.docx") wins outright.
  const refMatch = input.fileName.match(REF_PATTERN);
  if (refMatch) {
    const ref = `${refMatch[1].toUpperCase()}-${refMatch[2]}`;
    const exact = candidates.find((c) => c.ref === ref);
    if (exact) {
      return [{ ref, confidence: 1, reason: `Filename carries the library reference ${ref}` }];
    }
  }

  const fileSet = new Set(tokenize(input.fileName));
  const contentSet = input.content
    ? new Set(tokenize(input.content.slice(0, CONTENT_SCAN_CHARS)))
    : new Set<string>();
  const hasContent = contentSet.size > 0;
  if (fileSet.size === 0 && !hasContent) return [];

  const results: MatchResult[] = [];
  for (const candidate of candidates) {
    const titleTokens = tokenize(`${candidate.title} ${candidate.docType}`);
    if (titleTokens.length === 0) continue;

    let fileHits = 0;
    let contentHits = 0;
    for (const t of titleTokens) {
      if (fileSet.has(t)) fileHits++;
      if (contentSet.has(t)) contentHits++;
    }
    // Coverage of the item title is what matters — a long filename shouldn't
    // dilute a perfect title hit.
    const fileScore = fileHits / titleTokens.length;
    const contentScore = contentHits / titleTokens.length;
    const sameArea = Boolean(input.areaCode && input.areaCode === candidate.areaCode);

    let score = fileScore;
    let via: 'filename' | 'confirmed' | 'content' = 'filename';
    if (fileScore >= threshold && contentScore > 0) {
      // Document text confirms what the filename claimed.
      score = fileScore + 0.1;
      via = 'confirmed';
    } else if (fileScore < threshold && hasContent && sameArea && contentScore >= 0.6) {
      // Weakly-named file whose content clearly matches an item in its area.
      score = contentScore;
      via = 'content';
    }

    if (sameArea) score += 0.15; // filed under this area

    score = Math.min(score, 0.99); // only an explicit ref earns 1.0

    if (score >= threshold) {
      results.push({
        ref: candidate.ref,
        confidence: Number(score.toFixed(3)),
        reason: matchReason(via, fileHits, contentHits, titleTokens.length, sameArea),
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

function matchReason(
  via: 'filename' | 'confirmed' | 'content',
  fileHits: number,
  contentHits: number,
  total: number,
  sameArea: boolean,
): string {
  const areaSuffix = sameArea ? ' in the same area' : '';
  if (via === 'content') {
    return `Document text matches ${contentHits}/${total} title terms${areaSuffix}`;
  }
  if (via === 'confirmed') {
    return `Matches ${fileHits}/${total} title terms, confirmed in the document text`;
  }
  if (fileHits > 0) {
    return `Matches ${fileHits}/${total} title terms${areaSuffix}`;
  }
  return 'Filed under this compliance area';
}

/**
 * Given many evidence files and many items, produces the best one-to-one
 * assignment (greedy by confidence — optimal enough at this scale and O(n log n)).
 */
export function assignEvidence(
  files: { id: string; fileName: string; areaCode: string | null; content?: string | null }[],
  candidates: MatchCandidate[],
  threshold = 0.55,
): Map<string, { evidenceId: string; confidence: number; reason: string; fileName: string }> {
  const all: {
    ref: string;
    evidenceId: string;
    confidence: number;
    reason: string;
    fileName: string;
  }[] = [];

  for (const file of files) {
    for (const match of matchEvidence(
      { fileName: file.fileName, areaCode: file.areaCode, content: file.content },
      candidates,
      threshold,
    )) {
      all.push({ ...match, evidenceId: file.id, fileName: file.fileName });
    }
  }

  all.sort((a, b) => b.confidence - a.confidence);

  const byRef = new Map<string, { evidenceId: string; confidence: number; reason: string; fileName: string }>();
  const usedEvidence = new Set<string>();
  for (const m of all) {
    if (byRef.has(m.ref) || usedEvidence.has(m.evidenceId)) continue;
    byRef.set(m.ref, {
      evidenceId: m.evidenceId,
      confidence: m.confidence,
      reason: m.reason,
      fileName: m.fileName,
    });
    usedEvidence.add(m.evidenceId);
  }
  return byRef;
}
