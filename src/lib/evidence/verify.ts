import 'server-only';
import { areaIdentityScore } from './classify';

/**
 * Content verification — the difference between "a file named like a policy
 * exists" and "an inspector opening this file would accept it".
 *
 * Deterministic, explainable checks over the document's extracted text:
 *   - is it still an un-customised template (leftover placeholders)?
 *   - does it actually name THIS provider, or someone else's?
 *   - when was it last reviewed, and is it now out of its 12-month cycle?
 *   - does it read like the compliance area it's filed under?
 *   - does it carry the elements CQC expects (named lead, review cycle,
 *     regulatory basis, sign-off)?
 */

export interface VerificationInput {
  text: string;
  orgName: string | null;
  /** Checklist area we believe this document supports, if known. */
  expectedAreaCode: string | null;
  fileName: string;
}

export interface VerificationResult {
  hasText: boolean;
  /** 0..1 — how strongly the content matches the expected area. */
  identityConfidence: number;
  /** Still an un-customised template. */
  isTemplate: boolean;
  templateHits: string[];
  /** true = names this provider, false = doesn't, null = couldn't test. */
  providerNameMatch: boolean | null;
  /** ISO date of the governing review/issue date found, if any. */
  reviewDate: string | null;
  isOutOfDate: boolean;
  ageMonths: number | null;
  /** CQC-expected elements the document is missing. */
  missingElements: string[];
}

const REVIEW_CYCLE_MONTHS = 12;

// Leftover placeholder patterns that mean a template was never tailored.
const TEMPLATE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: '[insert …]', re: /\[\s*insert[^\]]*\]/i },
  { label: '[name]/[company]/[address]', re: /\[\s*(your |company |organisation |provider |business )?(name|company|organisation|address|logo)[^\]]*\]/i },
  { label: '[registered manager]', re: /\[\s*(registered\s+manager|responsible\s+individual|nominated\s+individual)[^\]]*\]/i },
  { label: '[date]', re: /\[\s*(date|dd\/mm\/yyyy|month year)[^\]]*\]/i },
  { label: '<<merge field>>', re: /<<[^>]+>>/ },
  { label: '{{placeholder}}', re: /\{\{[^}]+\}\}/ },
  { label: 'XXXX placeholder', re: /\bx{4,}\b/i },
  { label: '“to be confirmed”', re: /\b(tbc|tbd|to be confirmed|to be completed)\b/i },
  { label: 'insert … here', re: /insert[^.\n]{0,30}\bhere\b/i },
  { label: 'lorem ipsum', re: /lorem ipsum/i },
];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

interface DatedHit {
  date: Date;
  index: number;
}

/** Finds UK-format dates (dd/mm/yyyy, d Month yyyy, Month yyyy) with positions. */
function findDates(text: string): DatedHit[] {
  const hits: DatedHit[] = [];
  const now = Date.now();
  const floor = new Date('2005-01-01').getTime();

  const numeric = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
  for (let m; (m = numeric.exec(text)); ) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 0 || mo > 11) continue;
    const date = new Date(Date.UTC(y, mo, d));
    if (date.getTime() >= floor && date.getTime() <= now + 5 * 365 * 86400000) {
      hits.push({ date, index: m.index });
    }
  }

  const worded = /\b(\d{1,2})?(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{4})\b/gi;
  for (let m; (m = worded.exec(text)); ) {
    const day = m[1] ? Number(m[1]) : 1;
    const mo = MONTHS[m[2].toLowerCase()];
    const y = Number(m[3]);
    if (mo === undefined) continue;
    const date = new Date(Date.UTC(y, mo, day));
    if (date.getTime() >= floor && date.getTime() <= now + 5 * 365 * 86400000) {
      hits.push({ date, index: m.index });
    }
  }
  return hits;
}

function labelledNear(text: string, index: number, labels: RegExp): boolean {
  const from = Math.max(0, index - 45);
  return labels.test(text.slice(from, index + 8));
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|cic|c\.i\.c\.?|co|company|services|care|group)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function checkProviderName(text: string, orgName: string | null): boolean | null {
  if (!orgName) return null;
  const core = normaliseName(orgName);
  const tokens = core.split(' ').filter((t) => t.length >= 3);
  if (tokens.length === 0) return null;
  const hay = text.toLowerCase();
  const matched = tokens.filter((t) => hay.includes(t)).length;
  // Match if a clear majority of the distinctive name tokens appear.
  return matched / tokens.length >= 0.6;
}

export function verifyDocument(input: VerificationInput): VerificationResult {
  const text = input.text ?? '';
  const hasText = text.trim().length > 0;

  const templateHits = TEMPLATE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  const providerNameMatch = checkProviderName(text, input.orgName);

  // --- Review / issue date + out-of-date ---
  const reviewLabels = /(review|reviewed|next review|issue|issued|version|approved|dated|last updated|effective)/i;
  const dates = findDates(text);
  const labelled = dates.filter((d) => labelledNear(text, d.index, reviewLabels));
  const pool = labelled.length ? labelled : dates;
  const governing = pool.sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null;

  let reviewDate: string | null = null;
  let isOutOfDate = false;
  let ageMonths: number | null = null;
  if (governing) {
    reviewDate = governing.date.toISOString().slice(0, 10);
    ageMonths = monthsBetween(governing.date, new Date());
    // A future date is a "next review" target; past it, or an issue date older
    // than the cycle, means the document is out of date.
    isOutOfDate = ageMonths > REVIEW_CYCLE_MONTHS;
  }

  // --- Required elements ---
  const missingElements: string[] = [];
  if (!governing) missingElements.push('No review or issue date');
  if (!/(registered\s+manager|responsible\s+individual|nominated\s+individual|named\s+(lead|person)|safeguarding\s+lead|managing\s+director|signed)/i.test(text)) {
    missingElements.push('No named lead or sign-off');
  }
  if (!/(regulation\s*\d+|health\s+and\s+social\s+care\s+act|hsca|care\s+quality\s+commission|\bcqc\b|fundamental standards|schedule\s*\d)/i.test(text)) {
    missingElements.push('No regulatory basis cited');
  }
  if (!/(review(ed)?\s+(annually|every|date|cycle)|next\s+review|12[- ]month|annual review)/i.test(text)) {
    missingElements.push('No stated review cycle');
  }

  const identityConfidence = input.expectedAreaCode
    ? areaIdentityScore(text, input.expectedAreaCode)
    : 0;

  return {
    hasText,
    identityConfidence: Number(identityConfidence.toFixed(2)),
    isTemplate: templateHits.length > 0,
    templateHits,
    providerNameMatch,
    reviewDate,
    isOutOfDate,
    ageMonths,
    missingElements,
  };
}
