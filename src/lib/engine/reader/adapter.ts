import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { AuditItem, ItemStatus } from '@/types/database';
import type { AutopilotStats } from '@/lib/engine/autopilot';
// Verbatim copy of the standalone policy-evidence-reader engine. These modules
// are byte-identical to ~/Downloads/policy-evidence-reader and must not be
// edited here — treat them as a vendored, tested dependency. Typed via the
// wrappers below.
import { classify as classifyRaw } from './lib/classify.mjs';
import { analyzeDocument as analyzeDocumentRaw, analyzeSet as analyzeSetRaw } from './lib/analyze.mjs';
import { renderMaster as renderMasterRaw } from './lib/report.mjs';

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

/**
 * Turn one document's deterministic analysis into an honest checklist
 * suggestion — every reason is a verbatim quote from the client's own file:
 *   • unfilled placeholders → not acceptable as evidence (present-but-template)
 *   • past its review date  → out of date
 *   • otherwise             → present, citing the exact line that proves it.
 */
function deriveReaderSuggestion(r: AnalyzedDoc, evidenceId: string): ReaderSuggestion {
  const fileName = r.fileName;
  const placeholder = r.redFlags.find(
    (f) => f.severity === 'critical' && (f.id === 'unfilled-placeholder' || f.id === 'template-artifact'),
  );
  if (placeholder) {
    return {
      status: 'missing',
      evidenceId,
      confidence: 0.9,
      // Phrasing includes "un-customised template" so the apply step tells the
      // accurate "exists but never customised" story in the drafted finding.
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
  const sig = r.signals.find((s) => s.found && s.citations.length > 0);
  const cite = sig?.citations[0];
  return {
    status: 'present',
    evidenceId,
    confidence: cite ? 0.95 : 0.7,
    reason: cite
      ? `Evidence found in "${fileName}": "${cite.quote}" (line ${cite.line} — ${sig!.label}).`
      : `Matched "${fileName}" to this item.`,
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
export async function runReaderSuggest(auditId: string): Promise<AutopilotStats> {
  const started = Date.now();
  const admin = createAdminClient();

  const { data: audit } = await admin
    .from('audits')
    .select('id, org_id')
    .eq('id', auditId)
    .single<{ id: string; org_id: string }>();
  if (!audit) throw new Error('Audit not found');

  const [{ data: items }, { data: evidence }] = await Promise.all([
    admin.from('audit_items').select('*').eq('audit_id', auditId),
    admin
      .from('evidence_files')
      .select('id, file_name, extract_status, extracted_text, scan_status, lifecycle_state')
      .eq('org_id', audit.org_id)
      .eq('lifecycle_state', 'current')
      .neq('scan_status', 'infected'),
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
    const match = byRef.get(item.ref);
    if (match) {
      stats.itemsMatched++;
      const s = deriveReaderSuggestion(match.result, match.evidenceId);
      if (s.status === 'out_of_date') stats.itemsOutOfDate++;
      if (s.status === 'missing') stats.itemsTemplateFlagged++;
      updates.push({
        id: item.id,
        patch: {
          suggested_status: s.status,
          suggested_evidence_id: s.evidenceId,
          suggestion_confidence: s.confidence,
          suggestion_reason: s.reason,
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
      .eq('org_id', orgId)
      .eq('lifecycle_state', 'current')
      .neq('scan_status', 'infected'),
    admin.from('library_assets').select('ref, area_code, requirement'),
    admin.from('library_areas').select('code', { count: 'exact', head: true }),
  ]);

  const rows = (evidence as EvidenceRow[]) ?? [];
  const library = (assets as { ref: string; area_code: string; requirement: string }[]) ?? [];
  const byRef = new Map(library.map((a) => [a.ref, a]));

  const matchedRefs = new Set<string>();
  let unreadableFiles = 0;
  for (const e of rows) {
    const doc = toIngestedDoc(e);
    if (!doc.readable) {
      unreadableFiles++;
      continue;
    }
    const cls = classify(doc);
    const ref = cls.ref ?? refFromName(e.file_name);
    if (ref && byRef.has(ref)) matchedRefs.add(ref);
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
    currentFiles: rows.length,
  };
}

/** Minimal evidence signal shape shared with live-score-core.ts's EvidenceSignal. */
export interface ReaderSignal {
  reviewDate: string | null;
  isTemplate: boolean;
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
      .eq('org_id', audit.org_id)
      .eq('lifecycle_state', 'current')
      .neq('scan_status', 'infected'),
  ]);

  const docs = ((evidence as EvidenceRow[]) ?? []).map(toIngestedDoc);
  const root = org?.name ? `${org.name} — evidence vault` : 'evidence vault';
  const result = analyzeSet({ root, roots: [root], docs });
  return { markdown: renderMaster(result), totals: result.totals };
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
