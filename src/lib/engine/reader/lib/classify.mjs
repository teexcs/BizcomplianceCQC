/**
 * Classify — decide which of the 139 library documents (and which CQC area)
 * each ingested file corresponds to.
 *
 * Strategy, most-reliable first:
 *   1. Exact library reference in the filename (e.g. "SG-01 ...") → definitive.
 *   2. Strong title-token overlap with a manifest title → confident.
 *   3. Content signals: which area's evidence patterns fire most in the text.
 * Every classification carries a confidence and a plain reason, and low-
 * confidence matches are surfaced to the human, never hidden.
 */
import { MANIFEST, AREAS } from '../manifest.mjs';
import { AREA_SIGNALS } from '../rules.mjs';

const REF_IN_NAME = /\b([A-Z]{2})[-_ ]?(\d{2})\b/;

const STOP = new Set([
  'the', 'and', 'of', 'for', 'a', 'an', 'to', 'in', 'on', 'with', 'or', 'policy',
  'procedure', 'form', 'record', 'log', 'checklist', 'template', 'audit', 'review',
  'assessment', 'register', 'management', 'care', 'service', 'staff', 'cqc',
]);

function tokens(s) {
  return [
    ...new Set(
      s
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((t) => t.length > 2 && !STOP.has(t)),
    ),
  ];
}

// Pre-tokenise the manifest once.
const MANIFEST_TOKENS = MANIFEST.map((m) => ({ item: m, toks: tokens(m.title) }));

/**
 * @param {import('./ingest.mjs').IngestedDoc} doc
 * @returns {{ ref: string|null, area: string|null, areaName: string|null,
 *             title: string|null, requirement: string|null, basis: string|null,
 *             confidence: 'definitive'|'high'|'medium'|'low'|'none', reason: string }}
 */
export function classify(doc) {
  // 1. Reference in filename.
  const refMatch = doc.fileName.toUpperCase().match(REF_IN_NAME);
  if (refMatch) {
    const ref = `${refMatch[1]}-${refMatch[2]}`;
    const hit = MANIFEST.find((m) => m.ref === ref);
    if (hit) {
      return decorate(hit, 'definitive', `Filename carries the library reference ${ref}`);
    }
  }

  // 2. Title-token overlap.
  const nameToks = new Set(tokens(doc.fileName));
  let best = null;
  let bestScore = 0;
  for (const { item, toks } of MANIFEST_TOKENS) {
    if (toks.length === 0) continue;
    let hits = 0;
    for (const t of toks) if (nameToks.has(t)) hits++;
    const score = hits / toks.length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (best && bestScore >= 0.6) {
    return decorate(best, 'high', `Filename matches "${best.title}" (${Math.round(bestScore * 100)}% of title terms)`);
  }
  if (best && bestScore >= 0.34) {
    return decorate(best, 'medium', `Filename partially matches "${best.title}" (${Math.round(bestScore * 100)}% of title terms) — confirm`);
  }

  // 3. Content signals: which area fires most.
  if (doc.readable) {
    const areaCode = dominantAreaFromContent(doc.lines);
    if (areaCode) {
      return {
        ref: null,
        area: areaCode,
        areaName: AREAS[areaCode] ?? null,
        title: null,
        requirement: null,
        basis: null,
        confidence: 'low',
        reason: `No filename match; content most resembles area ${areaCode} (${AREAS[areaCode]}). Confirm which document this is.`,
      };
    }
  }

  return {
    ref: null,
    area: null,
    areaName: null,
    title: null,
    requirement: null,
    basis: null,
    confidence: 'none',
    reason: 'Could not confidently match this file to a library document or compliance area. Human classification required.',
  };
}

function decorate(item, confidence, reason) {
  return {
    ref: item.ref,
    area: item.area,
    areaName: AREAS[item.area] ?? null,
    title: item.title,
    requirement: item.requirement,
    basis: item.basis,
    confidence,
    reason,
  };
}

function dominantAreaFromContent(lines) {
  const text = lines.join('\n');
  let bestArea = null;
  let bestHits = 0;
  for (const [area, signals] of Object.entries(AREA_SIGNALS)) {
    let hits = 0;
    for (const sig of signals) {
      if (sig.patterns.some((p) => p.test(text))) hits++;
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestArea = area;
    }
  }
  return bestHits >= 2 ? bestArea : null;
}
