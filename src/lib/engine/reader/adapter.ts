import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { AuditItem, ItemStatus } from '@/types/database';
import type { AutopilotStats } from '@/lib/engine/autopilot';
import { verifyEvidence, type VerifiableFile, type VerificationResult } from '@/lib/audit/verification';
import { gradeSignal, type SignalConfidence } from '@/lib/audit/signal-confidence';
import { partitionGaps } from '@/lib/audit/signal-context';
import { assessIntegrity } from '@/lib/audit/document-integrity';
// Verbatim copy of the standalone policy-evidence-reader engine. These modules
// are byte-identical to ~/Downloads/policy-evidence-reader and must not be
// edited here — treat them as a vendored, tested dependency. Typed via the
// wrappers below.
import { classify as classifyRaw } from './lib/classify.mjs';
import { analyzeDocument as analyzeDocumentRaw, analyzeSet as analyzeSetRaw } from './lib/analyze.mjs';
import { renderMaster as renderMasterRaw } from './lib/report.mjs';
import { AREAS } from './manifest.mjs';

const AREAS_MAP = AREAS as Record<string, string>;

/* ---------- Types mirroring the verbatim engine's output ---------- */

interface Citation {
  line: number;
  quote: string;
}

interface DocSignal {
  id: string;
  label: string;
  weight: 'critical' | 'expected';
  found: boolean;
  citations: Citation[];
}

interface RedFlag {
  id: string;
  label: string;
  severity: 'critical' | 'advisory';
  line: number;
  quote: string;
}

interface DocReview {
  line: number;
  quote: string;
  date: string;
  status: 'overdue' | 'due_soon' | 'current';
}

interface Classification {
  ref: string | null;
  area: string | null;
  confidence: 'definitive' | 'high' | 'medium' | 'low' | 'none';
  reason: string;
}

interface AnalyzedDoc {
  fileName: string;
  readable: boolean;
  classification: Classification;
  signals: DocSignal[];
  redFlags: RedFlag[];
  review: DocReview | null;
}

/** The reader's own document shape (built here from DB text, not the filesystem). */
interface IngestedDoc {
  path: string;
  relPath: string;
  fileName: string;
  ext: string;
  readable: boolean;
  lines: string[];
  charCount: number;
  warning: string | null;
}

const classify = classifyRaw as unknown as (doc: IngestedDoc) => Classification;
const analyzeDocument = analyzeDocumentRaw as unknown as (
  doc: IngestedDoc,
  cls: Classification,
) => AnalyzedDoc;

/** The full analysis of a whole evidence set + its headline totals. */
export interface AnalysisTotals {
  filesReceived: number;
  readable: number;
  unreadable: number;
  manifestTotal: number;
  manifestSupplied: number;
  manifestMissing: number;
  missingLegal: number;
  missingCqc: number;
  criticalSignalsMet: number;
  criticalSignalsTotal: number;
  criticalRedFlags: number;
  overdueDocs: number;
}
interface AnalyzeSetResult {
  totals: AnalysisTotals;
  [key: string]: unknown;
}
const analyzeSet = analyzeSetRaw as unknown as (ingested: {
  root: string;
  roots: string[];
  docs: IngestedDoc[];
}) => AnalyzeSetResult;
const renderMaster = renderMasterRaw as unknown as (result: AnalyzeSetResult) => string;

/* ---------- DB → engine bridge ---------- */

interface EvidenceRow {
  id: string;
  file_name: string;
  extract_status: string | null;
  extracted_text: string | null;
}

/** Build the reader's line-numbered document from already-extracted DB text. */
function toIngestedDoc(e: EvidenceRow): IngestedDoc {
  const ext = (e.file_name.split('.').pop() ?? '').toLowerCase();
  const text = e.extracted_text ?? '';
  const readable = e.extract_status === 'done' && text.trim().length > 0;
  const lines = readable ? text.replace(/\r\n?/g, '\n').split('\n') : [];
  return {
    path: e.file_name,
    relPath: e.file_name,
    fileName: e.file_name,
    ext,
    readable,
    lines,
    charCount: text.length,
    warning: readable ? null : 'Not machine-readable yet — needs human review.',
  };
}

/** Same reference pattern the engine uses (e.g. "SG-01"), for DB-driven matching. */
const REF_RE = /\b([A-Z]{2})[-_ ]?(\d{2})\b/;
function refFromName(name: string): string | null {
  const m = name.toUpperCase().match(REF_RE);
  return m ? `${m[1]}-${m[2]}` : null;
}

interface ReaderSuggestion {
  status: ItemStatus;
  evidenceId: string;
  confidence: number;
  reason: string;
}

/** Signal-coverage of a document against its area's CQC signal set. */
interface SignalCoverage {
  criticalFound: number;
  criticalTotal: number;
  found: number;
  total: number;
  /** Labels of critical signals NOT evidenced — the named risk gaps. */
  missingCritical: string[];
}

function signalCoverage(r: AnalyzedDoc): SignalCoverage {
  const critical = r.signals.filter((s) => s.weight === 'critical');
  return {
    criticalFound: critical.filter((s) => s.found).length,
    criticalTotal: critical.length,
    found: r.signals.filter((s) => s.found).length,
    total: r.signals.length,
    missingCritical: critical.filter((s) => !s.found).map((s) => s.label),
  };
}

/**
 * Turn one document's deterministic analysis into an honest, PROPORTIONALLY
 * graded checklist suggestion — every reason is a verbatim quote from the
 * client's own file, and every gap is a named "not found":
 *   • unfilled placeholders → not acceptable as evidence (present-but-template)
 *   • past its review date  → out of date
 *   • thin critical-signal coverage → present but with named at-risk gaps, at
 *     lower confidence, so a shallow policy is never rated as fully compliant.
 *   • strong coverage       → present, citing the exact line that proves it.
 *
 * `areaOnly` = matched by compliance area (client's own doc), not an exact
 * library template — those are graded more cautiously.
 */
function deriveReaderSuggestion(
  r: AnalyzedDoc,
  evidenceId: string,
  areaOnly = false,
): ReaderSuggestion {
  const fileName = r.fileName;
  const placeholder = r.redFlags.find(
    (f) => f.severity === 'critical' && (f.id === 'unfilled-placeholder' || f.id === 'template-artifact'),
  );
  if (placeholder) {
    return {
      status: 'missing',
      evidenceId,
      confidence: 0.9,
      reason: `Matched "${fileName}" but it is an un-customised template — placeholders remain, e.g. "${placeholder.quote}" (line ${placeholder.line}). It would not be accepted as evidence until tailored to your service.`,
    };
  }
  if (r.review?.status === 'overdue') {
    return {
      status: 'out_of_date',
      evidenceId,
      confidence: 0.9,
      reason: `"${fileName}" is past its review date (${r.review.date}) — "${r.review.quote}" (line ${r.review.line}). Review and re-issue it.`,
    };
  }

  const cov = signalCoverage(r);
  const sig = r.signals.find((s) => s.found && s.citations.length > 0);
  const cite = sig?.citations[0];

  // No evidence signals fired at all → this document does not actually evidence
  // the area's requirements. Do NOT rate it present; flag for review.
  if (cov.found === 0) {
    return {
      status: 'out_of_date',
      evidenceId,
      confidence: 0.35,
      reason: `"${fileName}" was classified to this area but none of the ${cov.total} CQC evidence signals for it were found in the text. Review manually — it may be the wrong document or too thin to rely on.`,
    };
  }

  // Proportional grade: thin critical coverage = present but AT RISK, with the
  // specific missing signals named. Full/strong coverage = confident present.
  const criticalRatio = cov.criticalTotal > 0 ? cov.criticalFound / cov.criticalTotal : 1;
  const thin = criticalRatio < 0.5;
  const gapNote =
    cov.missingCritical.length > 0
      ? ` Not evidenced (still required): ${cov.missingCritical.slice(0, 5).join('; ')}${cov.missingCritical.length > 5 ? `; +${cov.missingCritical.length - 5} more` : ''}.`
      : '';
  const proofNote = cite
    ? `Evidence found in "${fileName}": "${cite.quote}" (line ${cite.line} — ${sig!.label}).`
    : `Matched "${fileName}" to this item.`;

  // Base confidence on coverage; area-only matches are capped lower still.
  let confidence = cite ? 0.6 + 0.35 * criticalRatio : 0.55;
  if (areaOnly) confidence = Math.min(confidence, 0.65);
  if (thin) confidence = Math.min(confidence, 0.5);

  return {
    status: 'present',
    evidenceId,
    confidence: Number(confidence.toFixed(2)),
    reason:
      `${proofNote} Covers ${cov.criticalFound}/${cov.criticalTotal} critical and ${cov.found}/${cov.total} total CQC signals for this area.` +
      gapNote,
  };
}

/**
 * Phase 1 — SUGGEST, powered by the deterministic reader engine.
 *
 * Reads every current evidence file's extracted text, analyses it line-by-line
 * with the vendored reader, and writes a quoted suggestion onto every undecided
 * checklist item. Coverage is matched against the audit's live snapshot (which
 * is built from your database library — 146 today and growing), never a frozen
 * list, so new documents and new CQC areas are picked up automatically.
 *
 * Drop-in replacement for runAutopilotSuggest: same stats shape, same columns,
 * so the existing apply → RAG → findings → score pipeline runs unchanged.
 */
export async function runReaderSuggest(
  auditId: string,
  opts: { rescan?: boolean } = {},
): Promise<AutopilotStats> {
  const started = Date.now();
  const admin = createAdminClient();

  const { data: audit } = await admin
    .from('audits')
    .select('id, org_id')
    .eq('id', auditId)
    .single<{ id: string; org_id: string }>();
  if (!audit) throw new Error('Audit not found');

  // Fresh scan: clear prior decisions/suggestions so every item is re-read
  // against the current evidence. Without this, a previously-decided audit
  // (e.g. one already delivered) would leave 'Run engine' with almost nothing
  // to do — which reads as "it isn't scanning my documents".
  if (opts.rescan) {
    await admin
      .from('audit_items')
      .update({
        status: 'unset',
        evidence_id: null,
        suggested_status: 'unset',
        suggested_evidence_id: null,
        suggestion_confidence: null,
        suggestion_reason: null,
      })
      .eq('audit_id', auditId);
  }

  const [{ data: items }, { data: evidence }] = await Promise.all([
    admin.from('audit_items').select('*').eq('audit_id', auditId),
    admin
      .from('evidence_files')
      .select('id, file_name, extract_status, extracted_text, scan_status, lifecycle_state')
      .eq('org_id', audit.org_id),
  ]);
  const allItems = (items as AuditItem[]) ?? [];
  const evRows = (evidence as EvidenceRow[]) ?? [];

  // Analyse each document once with the verbatim engine.
  const analyzed = evRows.map((e) => {
    const doc = toIngestedDoc(e);
    const cls = classify(doc);
    const result = analyzeDocument(doc, cls);
    return { evidenceId: e.id, fileName: e.file_name, result };
  });

  // Index the best document per library reference (engine classification first,
  // then the filename reference — this is what makes coverage DB-driven).
  const byRef = new Map<string, (typeof analyzed)[number]>();
  for (const a of analyzed) {
    if (!a.result.readable) continue;
    const ref = a.result.classification.ref ?? refFromName(a.fileName);
    if (ref && !byRef.has(ref)) byRef.set(ref, a);
  }

  // Index the STRONGEST document per CQC area — regardless of whether it maps
  // to a library reference. This is what lets the engine assess a client's OWN
  // policies (not just BizCompliance templates) against the CQC signal
  // rulebook: a real safeguarding policy that fires area-02 signals can satisfy
  // area-02 checklist items even though it carries no "SG-01" reference.
  const signalStrength = (a: (typeof analyzed)[number]) =>
    a.result.signals.filter((s) => s.found).length;
  const byArea = new Map<string, (typeof analyzed)[number]>();
  for (const a of analyzed) {
    if (!a.result.readable) continue;
    const area = a.result.classification.area;
    if (!area) continue;
    const current = byArea.get(area);
    if (!current || signalStrength(a) > signalStrength(current)) byArea.set(area, a);
  }

  const stats: AutopilotStats = {
    evidenceScanned: evRows.length,
    itemsMatched: 0,
    itemsSuggestedMissing: 0,
    itemsAlreadyDecided: 0,
    itemsOutOfDate: 0,
    itemsTemplateFlagged: 0,
  };

  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  for (const item of allItems) {
    if (item.status !== 'unset') {
      stats.itemsAlreadyDecided++;
      continue;
    }
    // Prefer an exact library-reference match; otherwise fall back to the
    // strongest client policy classified to this item's AREA that actually
    // fires CQC signals — so the client's own documents get assessed too.
    const refMatch = byRef.get(item.ref);
    const areaMatch = refMatch
      ? null
      : (() => {
          const cand = byArea.get(item.area_code);
          return cand && cand.result.signals.some((s) => s.found) ? cand : null;
        })();
    const match = refMatch ?? areaMatch;
    if (match) {
      stats.itemsMatched++;
      // When matched by area (not an exact library doc), grade cautiously and
      // say so — the founder should eyeball these before accepting.
      const byAreaOnly = !refMatch && Boolean(areaMatch);
      const s = deriveReaderSuggestion(match.result, match.evidenceId, byAreaOnly);
      if (s.status === 'out_of_date') stats.itemsOutOfDate++;
      if (s.status === 'missing') stats.itemsTemplateFlagged++;
      updates.push({
        id: item.id,
        patch: {
          suggested_status: s.status,
          suggested_evidence_id: s.evidenceId,
          suggestion_confidence: s.confidence,
          suggestion_reason: byAreaOnly
            ? `Assessed against your own document "${match.fileName}" (matched by compliance area, not a library template). ${s.reason}`
            : s.reason,
        },
      });
    } else if (item.requirement === 'legal' || item.requirement === 'cqc') {
      stats.itemsSuggestedMissing++;
      updates.push({
        id: item.id,
        patch: {
          suggested_status: 'missing' satisfies ItemStatus,
          suggested_evidence_id: null,
          suggestion_confidence: null,
          suggestion_reason: 'No matching evidence found in the vault.',
        },
      });
    } else {
      updates.push({
        id: item.id,
        patch: {
          suggested_status: 'unset' satisfies ItemStatus,
          suggested_evidence_id: null,
          suggestion_confidence: null,
          suggestion_reason: null,
        },
      });
    }
  }

  await runPooled(updates, 12, async (u) => {
    await admin.from('audit_items').update(u.patch).eq('id', u.id);
  });

  await admin.from('engine_runs').insert({
    kind: 'reader.suggest',
    org_id: audit.org_id,
    audit_id: auditId,
    stats: stats as unknown as Record<string, unknown>,
    duration_ms: Date.now() - started,
  });

  return stats;
}

export interface VaultCoverage {
  /** Distinct library documents matched by readable evidence in the vault. */
  matched: number;
  /** Total documents in the live library (146 today; grows with the library). */
  libraryTotal: number;
  /** Legally-required documents matched / total. */
  legalMatched: number;
  legalTotal: number;
  /** CQC areas (of 18) with at least one matched document. */
  areasCovered: number;
  areasTotal: number;
  /** Files uploaded but not machine-readable yet (still count for the human audit). */
  unreadableFiles: number;
  /** Readable files that could not be auto-classified to any CQC area — must be
   * reviewed manually so nothing is silently ignored. */
  unclassifiedFiles: number;
  currentFiles: number;
}

/**
 * Real, engine-computed coverage of the org's evidence vault against the live
 * library — the honest replacement for any arbitrary "N files uploaded" bar.
 * Classification-only (no full line scan), so it's cheap enough for page loads.
 *
 * Deliberately guidance, not a gate: the audit reviews whatever the client has
 * and hunts for everything CQC might flag — gaps are findings, not blockers.
 */
export async function getVaultCoverage(orgId: string): Promise<VaultCoverage> {
  const admin = createAdminClient();
  const [{ data: evidence }, { data: assets }, { count: areasTotal }] = await Promise.all([
    admin
      .from('evidence_files')
      .select('id, file_name, extract_status, extracted_text, scan_status, lifecycle_state')
      .eq('org_id', orgId),
    admin.from('library_assets').select('ref, area_code, requirement'),
    admin.from('library_areas').select('code', { count: 'exact', head: true }),
  ]);

  const rows = (evidence as EvidenceRow[]) ?? [];
  const library = (assets as { ref: string; area_code: string; requirement: string }[]) ?? [];
  const byRef = new Map(library.map((a) => [a.ref, a]));

  const matchedRefs = new Set<string>();
  let unreadableFiles = 0;
  let unclassifiedFiles = 0;
  for (const e of rows) {
    const doc = toIngestedDoc(e);
    if (!doc.readable) {
      unreadableFiles++;
      continue;
    }
    const cls = classify(doc);
    const ref = cls.ref ?? refFromName(e.file_name);
    if (ref && byRef.has(ref)) matchedRefs.add(ref);
    // A readable file that maps to neither a library reference nor a CQC area
    // would otherwise be invisible to the audit — count it so it is surfaced
    // for manual review rather than silently ignored.
    if (!cls.area && !(ref && byRef.has(ref))) unclassifiedFiles++;
  }

  const legalRefs = library.filter((a) => a.requirement === 'legal');
  const legalMatched = legalRefs.filter((a) => matchedRefs.has(a.ref)).length;
  const areaSet = new Set<string>();
  for (const ref of matchedRefs) {
    const asset = byRef.get(ref);
    if (asset) areaSet.add(asset.area_code);
  }

  return {
    matched: matchedRefs.size,
    libraryTotal: library.length,
    legalMatched,
    legalTotal: legalRefs.length,
    areasCovered: areaSet.size,
    areasTotal: areasTotal ?? 18,
    unreadableFiles,
    unclassifiedFiles,
    currentFiles: rows.length,
  };
}

/* ---------- Evidence proof: quoted, per-area trust surface ---------- */

export interface ProvenSignal {
  label: string;
  weight: 'critical' | 'expected';
  /** The verbatim line(s) from the client's own document that prove it. */
  citations: { fileName: string; line: number; quote: string }[];
  /** Graded strength of the evidence + a plain-English "why". */
  confidence: SignalConfidence;
}

export interface AreaProof {
  areaCode: string;
  areaName: string;
  /** Signals evidenced with a real quote from the uploaded documents. */
  proven: ProvenSignal[];
  /** Firm gaps: expected signals genuinely not found (not situational). */
  notFound: { label: string; weight: 'critical' | 'expected' }[];
  /** Situational prompts: only apply if the service does the relevant thing. */
  situational: { label: string; weight: 'critical' | 'expected' }[];
  /** Critical signals proven / total, EXCLUDING situational ones. */
  criticalProven: number;
  criticalTotal: number;
  /** Files that contributed evidence to this area. */
  files: string[];
  /** Anti-gaming warnings: files that match terms but aren't real policies. */
  integrityWarnings: { fileName: string; reason: string }[];
}

export interface EvidenceProof {
  areas: AreaProof[];
  totalProven: number;
  totalCriticalProven: number;
  totalCritical: number;
}

/**
 * The TRUST surface: for the org's uploaded evidence, return per CQC area every
 * signal that is actually PROVEN — with the verbatim quote and line number from
 * the client's own document — and every expected signal that was NOT found.
 *
 * This is what lets the auditor (and the report) say, with a citation, "there
 * IS real evidence supporting this" versus "this was claimed but not evidenced".
 * Deterministic and quote-backed: nothing is asserted without a line to point
 * to, and nothing found is hidden.
 */
export async function getEvidenceProof(orgId: string): Promise<EvidenceProof> {
  const admin = createAdminClient();
  const { data: evidence } = await admin
    .from('evidence_files')
    .select('id, file_name, area_code, extract_status, extracted_text, scan_status, lifecycle_state')
    .eq('org_id', orgId);

  const rows = (evidence as (EvidenceRow & { area_code: string | null })[]) ?? [];

  // Analyse each readable doc; group the proven signals by the area the doc
  // belongs to (stored area first, else the reader's classification).
  interface Agg {
    proven: Map<string, Omit<ProvenSignal, 'confidence'>>;
    notFound: Map<string, { label: string; weight: 'critical' | 'expected' }>;
    files: Set<string>;
    integrityWarnings: { fileName: string; reason: string }[];
  }
  const byArea = new Map<string, Agg>();

  for (const e of rows) {
    const doc = toIngestedDoc(e);
    if (!doc.readable) continue;
    const cls = classify(doc);
    const area = e.area_code ?? cls.area;
    if (!area) continue;
    const result = analyzeDocument(doc, cls);
    const fullText = doc.lines.join('\n');
    // Records (matrices, MAR charts, logs, registers) are execution evidence,
    // NOT policy documents — they may legitimately PROVE a signal but must never
    // be marked down for lacking policy language. So we take their positive
    // matches but ignore their "not found" gaps.
    const { isRecord } = isRecordDocument(e.file_name, fullText);

    // Anti-gaming: a document that fires many signals but reads like a keyword
    // list is not a real policy. Do NOT credit its signals; flag it instead.
    const signalsFired = result.signals.filter((s) => s.found).length;
    const integrity = isRecord ? { level: 'ok' as const, reason: null } : assessIntegrity(fullText, signalsFired);
    const gamed = integrity.level === 'not_a_policy';

    let agg = byArea.get(area);
    if (!agg) {
      agg = { proven: new Map(), notFound: new Map(), files: new Set(), integrityWarnings: [] };
      byArea.set(area, agg);
    }
    if (gamed && integrity.reason) {
      agg.integrityWarnings.push({ fileName: e.file_name, reason: integrity.reason });
    }

    for (const s of result.signals) {
      // Gamed documents don't get to prove anything — their matches are hollow.
      if (gamed) {
        if (!s.found && !isRecord && !agg.proven.has(s.label)) {
          agg.notFound.set(s.label, { label: s.label, weight: s.weight });
        }
        continue;
      }
      if (s.found && s.citations.length > 0) {
        agg.files.add(e.file_name);
        const existing = agg.proven.get(s.label) ?? { label: s.label, weight: s.weight, citations: [] };
        // Keep up to 4 citations so confidence can see corroboration across
        // multiple lines/documents (display still shows the first 1–2).
        for (const c of s.citations.slice(0, 4)) {
          if (existing.citations.length < 6) {
            existing.citations.push({ fileName: e.file_name, line: c.line, quote: c.quote });
          }
        }
        agg.proven.set(s.label, existing);
        // If it was previously only in notFound (from another doc), it's proven now.
        agg.notFound.delete(s.label);
      } else if (!isRecord && !s.found && !agg.proven.has(s.label)) {
        agg.notFound.set(s.label, { label: s.label, weight: s.weight });
      }
    }
  }

  const areas: AreaProof[] = [];
  let totalProven = 0;
  let totalCriticalProven = 0;
  let totalCritical = 0;

  for (const [areaCode, agg] of [...byArea.entries()].sort()) {
    const proven: ProvenSignal[] = [...agg.proven.values()].map((p) => ({
      ...p,
      confidence: gradeSignal(p.citations),
    }));
    // Route situational (service-type-specific) gaps out of the firm count so a
    // standard provider isn't marked down for practices it doesn't do.
    const { firm, situational } = partitionGaps([...agg.notFound.values()]);
    const criticalProven = proven.filter((p) => p.weight === 'critical').length;
    // Critical total counts proven + FIRM critical gaps only (not situational).
    const criticalTotal = criticalProven + firm.filter((n) => n.weight === 'critical').length;
    totalProven += proven.length;
    totalCriticalProven += criticalProven;
    totalCritical += criticalTotal;
    areas.push({
      areaCode,
      areaName: AREAS_MAP[areaCode] ?? `Area ${areaCode}`,
      proven,
      notFound: firm,
      situational,
      criticalProven,
      criticalTotal,
      files: [...agg.files],
      integrityWarnings: agg.integrityWarnings,
    });
  }

  return { areas, totalProven, totalCriticalProven, totalCritical };
}

/* ---------- Cross-document contradiction detection ---------- */

export interface Contradiction {
  /** The subject the documents disagree on (e.g. "supervision", "medicines review"). */
  topic: string;
  /** The conflicting statements, each quoted with its source. */
  statements: { fileName: string; line: number; quote: string; value: string }[];
}

// Cadence words ranked so we can tell that two documents state different
// frequencies for the same subject.
const CADENCE_RE =
  /\b(daily|weekly|fortnightly|monthly|bi-?monthly|quarterly|six-?monthly|half-?yearly|annually|yearly|every\s+\d+\s+(days?|weeks?|months?|years?))\b/i;

// Subjects worth checking for conflicting cadences — the ones inspectors probe.
const CADENCE_SUBJECTS: { topic: string; re: RegExp }[] = [
  { topic: 'supervision', re: /supervision/i },
  { topic: 'appraisal', re: /appraisal/i },
  { topic: 'medicines review / audit', re: /medicin(e|es)\s+(review|audit)|mar\s+audit/i },
  { topic: 'risk assessment review', re: /risk assessment.{0,20}review|review.{0,20}risk assessment/i },
  { topic: 'care plan review', re: /care plan.{0,20}review|review.{0,20}care plan/i },
  { topic: 'policy review cycle', re: /polic(y|ies).{0,20}review|review.{0,20}polic/i },
  { topic: 'fire drill / safety check', re: /fire (drill|safety)|safety check/i },
  { topic: 'training refresh', re: /training.{0,20}(refresh|renew|update)|annual training/i },
];

function normaliseCadence(raw: string): string {
  const c = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/half-?yearly/.test(c)) return 'six-monthly';
  if (/yearly/.test(c)) return 'annually';
  return c;
}

/**
 * Detect where two of the org's documents state DIFFERENT frequencies for the
 * same subject (e.g. supervision "monthly" in one policy, "quarterly" in
 * another). Inspectors seize on internal inconsistency — surfacing it is an
 * advanced audit capability. Every reported contradiction is quote-backed from
 * both documents; nothing is inferred.
 */
export async function detectContradictions(orgId: string): Promise<Contradiction[]> {
  const admin = createAdminClient();
  const { data: evidence } = await admin
    .from('evidence_files')
    .select('id, file_name, extract_status, extracted_text, scan_status, lifecycle_state')
    .eq('org_id', orgId);
  const rows = (evidence as EvidenceRow[]) ?? [];

  // Gather, per subject, every (file, line, cadence value) seen.
  const bySubject = new Map<string, { fileName: string; line: number; quote: string; value: string }[]>();

  for (const e of rows) {
    const doc = toIngestedDoc(e);
    if (!doc.readable) continue;
    for (let i = 0; i < doc.lines.length; i++) {
      const line = doc.lines[i];
      if (!line.trim()) continue;
      const cadenceMatch = line.match(CADENCE_RE);
      if (!cadenceMatch) continue;
      for (const subj of CADENCE_SUBJECTS) {
        if (!subj.re.test(line)) continue;
        const q = line.replace(/\s+/g, ' ').trim();
        const entry = {
          fileName: e.file_name,
          line: i + 1,
          quote: q.length > 200 ? `${q.slice(0, 200)}…` : q,
          value: normaliseCadence(cadenceMatch[0]),
        };
        const list = bySubject.get(subj.topic) ?? [];
        list.push(entry);
        bySubject.set(subj.topic, list);
      }
    }
  }

  const contradictions: Contradiction[] = [];
  for (const [topic, entries] of bySubject) {
    // A contradiction is ≥2 DISTINCT cadence values for the same subject —
    // whether across two documents OR within a single one (a policy that says
    // both "monthly" and "quarterly" is just as much a problem at inspection).
    const distinctValues = new Set(entries.map((x) => x.value));
    if (distinctValues.size >= 2) {
      // Keep one representative statement per distinct value.
      const seen = new Set<string>();
      const statements = entries.filter((x) => {
        if (seen.has(x.value)) return false;
        seen.add(x.value);
        return true;
      });
      contradictions.push({ topic, statements });
    }
  }
  return contradictions;
}

// Markers of the CHILDREN'S safeguarding framework — if these appear in a doc
// filed under ADULT safeguarding (area 02/03), it's likely the wrong policy.
const WRONG_SERVICE_MARKERS =
  /\b(keeping children safe in education|kcsie|working together to safeguard children|section 47|child protection|lado|ofsted|early years|eyfs|designated teacher|children act 1989|children's? home)\b/i;

export interface WrongServiceFlag {
  fileName: string;
  areaCode: string;
  quote: string;
  line: number;
}

/**
 * Flag documents that look like the WRONG service framework — e.g. a children's
 * safeguarding policy uploaded to an adult domiciliary audit. These fire some
 * signals but are the wrong basis and must not be credited without review.
 */
export async function detectWrongService(orgId: string): Promise<WrongServiceFlag[]> {
  const admin = createAdminClient();
  const { data: evidence } = await admin
    .from('evidence_files')
    .select('id, file_name, area_code, extract_status, extracted_text, scan_status, lifecycle_state')
    .eq('org_id', orgId);
  const rows = (evidence as (EvidenceRow & { area_code: string | null })[]) ?? [];

  const flags: WrongServiceFlag[] = [];
  for (const e of rows) {
    const doc = toIngestedDoc(e);
    if (!doc.readable) continue;
    const cls = classify(doc);
    const area = e.area_code ?? cls.area;
    // Only relevant where the doc claims a care-quality area.
    if (!area) continue;
    for (let i = 0; i < doc.lines.length; i++) {
      const m = doc.lines[i].match(WRONG_SERVICE_MARKERS);
      if (m) {
        const q = doc.lines[i].replace(/\s+/g, ' ').trim();
        flags.push({ fileName: e.file_name, areaCode: area, quote: q.length > 180 ? `${q.slice(0, 180)}…` : q, line: i + 1 });
        break; // one flag per file is enough
      }
    }
  }
  return flags;
}

/* ---------- Execution proof: is the policy actually being DONE? ---------- */

/**
 * A record document proves execution when it contains dated, named, or logged
 * entries — the fingerprints of a real record (a training matrix with dates, a
 * MAR chart with initials, an incident log with entries) rather than a policy
 * that merely describes what should happen.
 */
// Execution markers = the fingerprints of a FILLED-IN record, not prose. These
// are deliberately concrete (real dates, signatures, tabular data) so a policy
// that merely uses words like "record" or "log" is NOT mistaken for a record.
const EXECUTION_MARKERS: { id: string; label: string; re: RegExp }[] = [
  { id: 'date', label: 'dated entries', re: /\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b/i },
  { id: 'signature', label: 'signatures / initials', re: /\b(signed(?:\s+by)?|signature|print name|staff name|completed by|reviewed by)\b/i },
  { id: 'tabular', label: 'tabular data (dates + expiry/completed columns)', re: /\b(expiry|renewal\s*date|date\s*(reported|completed|due)|completion\s*date)\b/i },
];

// Filename words that strongly indicate a filled-in record artefact.
const RECORD_NAME_HINT =
  /\b(matrix|register|log\b|chart|mar\b|rota|certificate|audit|checklist|tracker|record\s|records\s|spreadsheet|form\b)\b/i;

/**
 * Is this file a filled-in RECORD (execution evidence) vs a POLICY document?
 * Requires real execution fingerprints — a record-type filename PLUS at least
 * one concrete marker, or two concrete markers on their own. Prose words like
 * "recorded"/"logged" alone are NOT enough (they belong in policies).
 */
function isRecordDocument(fileName: string, text: string): { isRecord: boolean; markers: string[] } {
  const nameHint = RECORD_NAME_HINT.test(fileName);
  const markers: string[] = [];
  for (const m of EXECUTION_MARKERS) {
    if (m.re.test(text)) markers.push(m.label);
  }
  // A record if: named like one AND shows ≥1 concrete marker, or ≥2 markers.
  const isRecord = (nameHint && markers.length >= 1) || markers.length >= 2;
  return { isRecord, markers };
}

export interface ExecutionClaim {
  /** The policy claim (a met signal in the policy doc). */
  claim: string;
  weight: 'critical' | 'expected';
  /** The policy line that makes the claim. */
  policyFile: string;
  policyLine: number;
  policyQuote: string;
  /** 'confirmed' when a supporting record exists in the area; else 'not_evidenced'. */
  state: 'confirmed' | 'not_evidenced';
  /** Quoted execution evidence from the record, when confirmed. */
  evidence: { fileName: string; line: number; quote: string; markers: string[] } | null;
}

export interface AreaExecution {
  areaCode: string;
  areaName: string;
  claims: ExecutionClaim[];
  confirmed: number;
  total: number;
  /** Record documents found in this area (the execution evidence sources). */
  recordFiles: string[];
}

export interface ExecutionProof {
  areas: AreaExecution[];
  totalConfirmed: number;
  totalClaims: number;
}

/**
 * EXECUTION PROOF — the "is the policy actually being DONE?" surface.
 *
 * For each area: take the claims a POLICY document makes (its met signals) and
 * check whether a RECORD document in the same area shows those claims are lived
 * — quoting the dated/signed/logged line that proves it. Where no supporting
 * record exists, the claim is reported as "claimed, not evidenced in practice".
 *
 * This is deliberately conservative and quote-backed: it never asserts a policy
 * is executed without pointing at a real record line. It complements — does not
 * replace — the auditor's own file sampling.
 */
export async function getExecutionProof(orgId: string): Promise<ExecutionProof> {
  const admin = createAdminClient();
  const { data: evidence } = await admin
    .from('evidence_files')
    .select('id, file_name, area_code, extract_status, extracted_text, scan_status, lifecycle_state')
    .eq('org_id', orgId);
  const rows = (evidence as (EvidenceRow & { area_code: string | null })[]) ?? [];

  // Split each area's docs into policies (claims) and records (execution proof).
  interface AreaDocs {
    policies: { fileName: string; analysis: AnalyzedDoc }[];
    records: { fileName: string; text: string; markers: string[] }[];
  }
  const byArea = new Map<string, AreaDocs>();

  for (const e of rows) {
    const doc = toIngestedDoc(e);
    if (!doc.readable) continue;
    const cls = classify(doc);
    const area = e.area_code ?? cls.area;
    if (!area) continue;
    const text = doc.lines.join('\n');
    const { isRecord, markers } = isRecordDocument(e.file_name, text);

    let bucket = byArea.get(area);
    if (!bucket) {
      bucket = { policies: [], records: [] };
      byArea.set(area, bucket);
    }
    if (isRecord) {
      bucket.records.push({ fileName: e.file_name, text, markers });
    } else {
      bucket.policies.push({ fileName: e.file_name, analysis: analyzeDocument(doc, cls) });
    }
  }

  const areas: AreaExecution[] = [];
  let totalConfirmed = 0;
  let totalClaims = 0;

  for (const [areaCode, docs] of [...byArea.entries()].sort()) {
    const claims: ExecutionClaim[] = [];
    // Each met signal in each policy doc is a claim to be executed.
    for (const pol of docs.policies) {
      for (const s of pol.analysis.signals) {
        if (!s.found || s.citations.length === 0) continue;
        const c = s.citations[0];
        // Look for supporting execution evidence: a record in the same area
        // whose text mentions the claim's subject AND shows execution markers.
        const evidence = findExecutionEvidence(s.label, docs.records);
        claims.push({
          claim: s.label,
          weight: s.weight,
          policyFile: pol.fileName,
          policyLine: c.line,
          policyQuote: c.quote,
          state: evidence ? 'confirmed' : 'not_evidenced',
          evidence,
        });
      }
    }
    const confirmed = claims.filter((c) => c.state === 'confirmed').length;
    totalConfirmed += confirmed;
    totalClaims += claims.length;
    areas.push({
      areaCode,
      areaName: AREAS_MAP[areaCode] ?? `Area ${areaCode}`,
      claims,
      confirmed,
      total: claims.length,
      recordFiles: docs.records.map((r) => r.fileName),
    });
  }

  return { areas, totalConfirmed, totalClaims };
}

/** Keywords lifted from a signal label, for matching against record text. */
function claimKeywords(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}
const STOPWORDS = new Set([
  'referenced', 'process', 'requirement', 'required', 'defined', 'stated', 'route',
  'available', 'addressed', 'controls', 'where', 'incl', 'e.g', 'their', 'related',
  'recording', 'record', 'records', 'with', 'that', 'this', 'from', 'into', 'must',
]);

/**
 * Find a record line that both mentions the claim's subject and shows an
 * execution marker (a date, signature, logged entry). Returns the quoted proof,
 * or null when no such line exists (→ claimed but not evidenced in practice).
 */
function findExecutionEvidence(
  claimLabel: string,
  records: { fileName: string; text: string; markers: string[] }[],
): { fileName: string; line: number; quote: string; markers: string[] } | null {
  const keys = claimKeywords(claimLabel);
  if (keys.length === 0) return null;

  for (const rec of records) {
    const lines = rec.text.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      const line = raw.toLowerCase();
      const mentionsClaim = keys.some((k) => line.includes(k));
      if (!mentionsClaim) continue;
      const marker = EXECUTION_MARKERS.find((m) => m.re.test(raw));
      if (marker) {
        const q = raw.replace(/\s+/g, ' ').trim();
        return {
          fileName: rec.fileName,
          line: i + 1,
          quote: q.length > 220 ? `${q.slice(0, 220)}…` : q,
          markers: rec.markers,
        };
      }
    }
  }
  // No line matched claim + marker together, but if a record in the area exists
  // at all and shows strong execution markers, treat it as weak corroboration.
  return null;
}

/** Minimal evidence signal shape shared with live-score-core.ts's EvidenceSignal. */
export interface ReaderSignal {
  reviewDate: string | null;
  isTemplate: boolean;
}

/**
 * Classify one document into a CQC area using the reader engine's own
 * classifier — filename library-reference first, then document title, then
 * dominant content signal — the same brain the audit uses. Used to categorise
 * "let the system decide" uploads authoritatively once the text is read.
 *
 * Returns the area code (or null) and how confident the classifier is, so the
 * caller can decide whether to trust content over a weaker signal.
 */
export function classifyEvidenceArea(
  fileName: string,
  text: string,
): { areaCode: string | null; confidence: Classification['confidence'] } {
  const doc: IngestedDoc = {
    path: fileName,
    relPath: fileName,
    fileName,
    ext: (fileName.split('.').pop() ?? '').toLowerCase(),
    readable: text.trim().length > 0,
    lines: text.replace(/\r\n?/g, '\n').split('\n'),
    charCount: text.length,
    warning: null,
  };
  const cls = classify(doc);
  return { areaCode: cls.area ?? null, confidence: cls.confidence };
}

/**
 * Analyse a batch of evidence rows with the reader and index the result by
 * library reference — the shared building block for both the audit engine
 * (runReaderSuggest) and the live-readiness "renewal" check (live-score.ts),
 * so both read documents the same, deterministic way.
 */
export function analyzeEvidenceByRef(
  rows: EvidenceRow[],
): Map<string, { evidenceId: string; fileName: string; signal: ReaderSignal }> {
  const byRef = new Map<string, { evidenceId: string; fileName: string; signal: ReaderSignal }>();
  for (const e of rows) {
    const doc = toIngestedDoc(e);
    if (!doc.readable) continue;
    const cls = classify(doc);
    const ref = cls.ref ?? refFromName(e.file_name);
    if (!ref || byRef.has(ref)) continue;
    const result = analyzeDocument(doc, cls);
    const isTemplate = result.redFlags.some(
      (f) => f.severity === 'critical' && (f.id === 'unfilled-placeholder' || f.id === 'template-artifact'),
    );
    byRef.set(ref, {
      evidenceId: e.id,
      fileName: e.file_name,
      signal: { reviewDate: result.review?.date ?? null, isTemplate },
    });
  }
  return byRef;
}

/**
 * EVIDENCE VERIFICATION (DB wrapper) — run the pure verification layer over the
 * org's live vault. For every file we reuse the SAME deterministic classifier
 * the coverage/suggest paths use to assign a CQC area, then hand the reduced
 * file list to verifyEvidence so policy-vs-record gaps are surfaced.
 *
 * Area is taken from the persisted `area_code` when present (admin/auto-sort has
 * decided it), otherwise from the reader's own classification — so verification
 * agrees with what the rest of the pipeline believes about each file.
 */
export async function verifyOrgEvidence(orgId: string): Promise<VerificationResult> {
  const admin = createAdminClient();
  const { data: evidence } = await admin
    .from('evidence_files')
    .select('id, file_name, area_code, extract_status, extracted_text, scan_status, lifecycle_state')
    .eq('org_id', orgId);

  const rows =
    (evidence as (EvidenceRow & { area_code: string | null })[]) ?? [];

  const files: VerifiableFile[] = rows.map((e) => {
    const doc = toIngestedDoc(e);
    const text = doc.readable ? doc.lines.join('\n') : '';
    // Prefer the stored area; fall back to the reader's classification.
    let areaCode = e.area_code ?? null;
    if (!areaCode && doc.readable) {
      const cls = classify(doc);
      areaCode = cls.area ?? null;
    }
    return { id: e.id, fileName: e.file_name, text, areaCode };
  });

  return verifyEvidence(files);
}

/**
 * The INTERNAL analysis — the reader's full "everything, quoted" report for the
 * auditor to review before issuing anything to the client. Read-only: it reads
 * the vault's extracted text, runs the whole-set analysis, and returns the same
 * master markdown the standalone tool writes to AUDIT_REPORT.md. Deterministic,
 * so it can be regenerated on demand without being stored.
 */
export async function buildAuditAnalysis(
  auditId: string,
): Promise<{ markdown: string; totals: AnalysisTotals }> {
  const admin = createAdminClient();

  const { data: audit } = await admin
    .from('audits')
    .select('id, org_id')
    .eq('id', auditId)
    .single<{ id: string; org_id: string }>();
  if (!audit) throw new Error('Audit not found');

  const [{ data: org }, { data: evidence }] = await Promise.all([
    admin.from('organisations').select('name').eq('id', audit.org_id).single<{ name: string }>(),
    admin
      .from('evidence_files')
      .select('id, file_name, extract_status, extracted_text, scan_status, lifecycle_state')
      .eq('org_id', audit.org_id),
  ]);

  const rows = (evidence as (EvidenceRow & { area_code?: string | null })[]) ?? [];
  const docs = rows.map(toIngestedDoc);
  const root = org?.name ? `${org.name} — evidence vault` : 'evidence vault';
  const result = analyzeSet({ root, roots: [root], docs });

  // Fold in the evidence-verification pass so the auditor's internal report
  // shows, per area, which policy claims are backed by a supporting record and
  // which are policy-only gaps — the heart of an evidence-based audit.
  const files: VerifiableFile[] = rows.map((e) => {
    const doc = toIngestedDoc(e);
    const text = doc.readable ? doc.lines.join('\n') : '';
    let areaCode = e.area_code ?? null;
    if (!areaCode && doc.readable) areaCode = classify(doc).area ?? null;
    return { id: e.id, fileName: e.file_name, text, areaCode };
  });
  const verification = verifyEvidence(files);
  const markdown = `${renderMaster(result)}\n\n${renderVerificationMarkdown(verification)}`;
  return { markdown, totals: result.totals };
}

/** Render the verification pass as a review-ready markdown section. */
function renderVerificationMarkdown(v: VerificationResult): string {
  const { totals } = v;
  const lines: string[] = [
    '---',
    '',
    '## Evidence verification — are the policies backed by records?',
    '',
    `A policy on its own is not evidence. Of ${totals.items} expected evidence items, ` +
      `**${totals.verified} are verified** by a supporting record, ` +
      `**${totals.policyOnly} are policy-only** (the policy exists but the proving record was not supplied), ` +
      `and **${totals.absent} are absent**. ` +
      `**${totals.criticalGaps} essential item${totals.criticalGaps === 1 ? '' : 's'}** ${totals.criticalGaps === 1 ? 'is' : 'are'} unverified.`,
    '',
  ];
  for (const area of v.areas) {
    const gaps = area.items.filter((i) => i.state !== 'verified');
    if (gaps.length === 0) {
      lines.push(`### ${area.code}. ${area.area} — ✅ all ${area.items.length} items verified`, '');
      continue;
    }
    lines.push(
      `### ${area.code}. ${area.area} — ${area.verified}/${area.items.length} verified` +
        (area.criticalGaps > 0 ? ` · ⚠️ ${area.criticalGaps} essential gap${area.criticalGaps === 1 ? '' : 's'}` : ''),
      '',
    );
    for (const g of gaps) {
      const tag = g.state === 'policy_only' ? 'POLICY-ONLY' : 'ABSENT';
      const crit = g.item.critical ? ' **[essential]**' : '';
      lines.push(`- **${tag}**${crit} — ${g.item.label}: ${g.reason}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Small concurrency pool: fast without overwhelming the connection pooler. */
async function runPooled<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  });
  await Promise.all(workers);
}
