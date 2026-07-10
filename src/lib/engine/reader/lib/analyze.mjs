/**
 * Analyze — the deterministic evidence engine.
 *
 * For every readable document it reads EVERY line and records, with exact
 * file + line citations quoted verbatim:
 *   • which area evidence signals are present (and which are absent)
 *   • document-control facts (version / review date / owner / legal basis)
 *   • red flags (unfilled placeholders, template artifacts, outdated regime)
 *   • the document's stated review date, and whether it is overdue
 *
 * Across the whole set it builds:
 *   • coverage of the 139-document manifest (supplied vs missing)
 *   • per-area evidence rollups (a signal is met if any area doc proves it)
 *   • extended-expectation coverage (evidence beyond the core library)
 *   • lists of unmatched and unreadable files for human attention
 *
 * It never invents evidence. Every positive statement is a quote of the
 * client's own text. Every negative statement is the plain fact that a pattern
 * was not found. This is what makes it safe to sell at £595.
 */
import { MANIFEST, AREAS } from '../manifest.mjs';
import {
  AREA_SIGNALS,
  EXTENDED_EXPECTATIONS,
  DOC_CHECKS,
  RED_FLAGS,
  REVIEW_DATE_LINE,
  DATE_PATTERNS,
} from '../rules.mjs';
import { classify } from './classify.mjs';

const MAX_QUOTE = 220;
const MAX_CITATIONS_PER_SIGNAL = 3;

function quoteOf(line) {
  const t = line.replace(/\s+/g, ' ').trim();
  return t.length > MAX_QUOTE ? `${t.slice(0, MAX_QUOTE)}…` : t;
}

/** Find up to N lines in a document that match any of the given patterns. */
function findCitations(lines, patterns, limit = MAX_CITATIONS_PER_SIGNAL) {
  const cites = [];
  for (let i = 0; i < lines.length && cites.length < limit; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (patterns.some((p) => p.test(line))) {
      cites.push({ line: i + 1, quote: quoteOf(line) });
    }
  }
  return cites;
}

function parseReviewDate(lines) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(REVIEW_DATE_LINE);
    if (!m) continue;
    const tail = m[m.length - 1] || lines[i];
    for (const dp of DATE_PATTERNS) {
      const dm = tail.match(dp.re);
      if (dm) {
        const d = dp.build(dm);
        if (d && !Number.isNaN(d.getTime())) {
          return { line: i + 1, quote: quoteOf(lines[i]), date: d };
        }
      }
    }
  }
  return null;
}

/**
 * Analyse a single document against a target area's signals.
 * @param {import('./ingest.mjs').IngestedDoc} doc
 * @param {ReturnType<typeof classify>} cls
 */
export function analyzeDocument(doc, cls) {
  const result = {
    file: doc.relPath,
    fileName: doc.fileName,
    ext: doc.ext,
    readable: doc.readable,
    warning: doc.warning,
    classification: cls,
    lineCount: doc.lines.length,
    signals: [], // per-area signal presence in THIS doc
    docControl: [],
    redFlags: [],
    review: null,
  };
  if (!doc.readable) return result;

  const areaSignals = cls.area ? AREA_SIGNALS[cls.area] ?? [] : [];
  for (const sig of areaSignals) {
    const cites = findCitations(doc.lines, sig.patterns);
    result.signals.push({
      id: sig.id,
      label: sig.label,
      weight: sig.weight,
      found: cites.length > 0,
      citations: cites,
    });
  }

  for (const chk of DOC_CHECKS) {
    const cites = findCitations(doc.lines, chk.found, 1);
    result.docControl.push({
      id: chk.id,
      label: chk.label,
      found: cites.length > 0,
      citation: cites[0] ?? null,
    });
  }

  for (const flag of RED_FLAGS) {
    for (let i = 0; i < doc.lines.length; i++) {
      if (flag.pattern.test(doc.lines[i])) {
        result.redFlags.push({
          id: flag.id,
          label: flag.label,
          severity: flag.severity,
          line: i + 1,
          quote: quoteOf(doc.lines[i]),
        });
      }
    }
  }

  const review = parseReviewDate(doc.lines);
  if (review) {
    const now = new Date();
    const overdue = review.date.getTime() < now.getTime();
    const soon =
      !overdue && review.date.getTime() - now.getTime() < 60 * 86400000; // within 60 days
    result.review = {
      line: review.line,
      quote: review.quote,
      date: review.date.toISOString().slice(0, 10),
      status: overdue ? 'overdue' : soon ? 'due_soon' : 'current',
    };
  }

  return result;
}

/**
 * Analyse an entire ingested set.
 * @param {{ root: string, roots: string[], docs: import('./ingest.mjs').IngestedDoc[] }} ingested
 */
export function analyzeSet(ingested) {
  const perDoc = ingested.docs.map((d) => analyzeDocument(d, classify(d)));

  // --- Manifest coverage -------------------------------------------------
  // Only READABLE documents can count as supplied evidence. A filename that
  // resembles a library document is not evidence if we could not read the file
  // (e.g. a scanned image) — it stays in the "unreadable / needs review" list.
  const matchedRefs = new Set(
    perDoc.filter((d) => d.readable).map((d) => d.classification.ref).filter(Boolean),
  );
  const coverage = MANIFEST.map((m) => ({
    ref: m.ref,
    area: m.area,
    title: m.title,
    requirement: m.requirement,
    basis: m.basis,
    supplied: matchedRefs.has(m.ref),
  }));

  // --- Per-area evidence rollup -----------------------------------------
  const areaRollup = Object.keys(AREA_SIGNALS).map((area) => {
    const docsInArea = perDoc.filter((d) => d.classification.area === area && d.readable);
    const signals = (AREA_SIGNALS[area] ?? []).map((sig) => {
      const locations = [];
      for (const d of docsInArea) {
        const s = d.signals.find((x) => x.id === sig.id);
        if (s && s.found) {
          for (const c of s.citations) locations.push({ file: d.file, ...c });
        }
      }
      return {
        id: sig.id,
        label: sig.label,
        weight: sig.weight,
        met: locations.length > 0,
        locations: locations.slice(0, MAX_CITATIONS_PER_SIGNAL),
      };
    });
    const critical = signals.filter((s) => s.weight === 'critical');
    return {
      area,
      areaName: AREAS[area],
      docCount: docsInArea.length,
      signals,
      metCount: signals.filter((s) => s.met).length,
      totalCount: signals.length,
      criticalMet: critical.filter((s) => s.met).length,
      criticalTotal: critical.length,
      criticalGaps: critical.filter((s) => !s.met).map((s) => s.label),
    };
  });

  // --- Extended expectations (global scan) ------------------------------
  const allReadable = perDoc.filter((d) => d.readable);
  const extended = EXTENDED_EXPECTATIONS.map((exp) => {
    const locations = [];
    for (const d of ingested.docs) {
      if (!d.readable) continue;
      const cites = findCitations(d.lines, exp.patterns, 1);
      if (cites.length) locations.push({ file: d.relPath, ...cites[0] });
    }
    return {
      id: exp.id,
      label: exp.label,
      supplied: locations.length > 0,
      locations: locations.slice(0, MAX_CITATIONS_PER_SIGNAL),
    };
  });

  // --- Attention lists ---------------------------------------------------
  const unreadable = perDoc.filter((d) => !d.readable);
  const unmatched = perDoc.filter(
    (d) => d.readable && (d.classification.confidence === 'none' || d.classification.confidence === 'low'),
  );

  // --- Headline numbers --------------------------------------------------
  const suppliedCount = coverage.filter((c) => c.supplied).length;
  const missingLegal = coverage.filter((c) => !c.supplied && c.requirement === 'legal');
  const missingCqc = coverage.filter((c) => !c.supplied && c.requirement === 'cqc');
  const totalCriticalSignals = areaRollup.reduce((n, a) => n + a.criticalTotal, 0);
  const metCriticalSignals = areaRollup.reduce((n, a) => n + a.criticalMet, 0);
  const criticalRedFlags = perDoc.reduce(
    (n, d) => n + d.redFlags.filter((f) => f.severity === 'critical').length,
    0,
  );
  const overdueDocs = perDoc.filter((d) => d.review && d.review.status === 'overdue').length;

  return {
    generatedAt: new Date().toISOString(),
    root: ingested.root,
    totals: {
      filesReceived: ingested.docs.length,
      readable: allReadable.length,
      unreadable: unreadable.length,
      manifestTotal: MANIFEST.length,
      manifestSupplied: suppliedCount,
      manifestMissing: MANIFEST.length - suppliedCount,
      missingLegal: missingLegal.length,
      missingCqc: missingCqc.length,
      criticalSignalsMet: metCriticalSignals,
      criticalSignalsTotal: totalCriticalSignals,
      criticalRedFlags,
      overdueDocs,
    },
    perDoc,
    coverage,
    areaRollup,
    extended,
    unreadable: unreadable.map((d) => ({ file: d.file, ext: d.ext, warning: d.warning })),
    unmatched: unmatched.map((d) => ({
      file: d.file,
      confidence: d.classification.confidence,
      reason: d.classification.reason,
    })),
  };
}
