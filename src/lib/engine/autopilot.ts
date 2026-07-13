import 'server-only';
// NOTE: the old fuzzy-matcher SUGGEST brain that used to live here was retired
// when the deterministic policy-evidence-reader took over — see
// docs/OLD_ENGINE.md. What remains is the shared APPLY pipeline
// (apply suggestions → RAG areas → draft findings → score) that the reader's
// suggestions flow into. One brain decides; this turns decisions into the report.
import { createAdminClient } from '@/lib/supabase/server';
import { inferSafNegatives } from './saf-crosswalk';
import { computeReadinessScore, suggestAreaRag } from '@/lib/audit/scoring';
import { resolveFinding, type GapType } from '@/lib/audit/findings-library';
import type { AuditArea, AuditItem, SafQuestion, SafResponse } from '@/types/database';

type Admin = ReturnType<typeof createAdminClient>;

export interface AutopilotStats {
  evidenceScanned: number;
  itemsMatched: number;
  itemsSuggestedMissing: number;
  itemsAlreadyDecided: number;
  itemsOutOfDate: number;
  itemsTemplateFlagged: number;
}

export interface ApplyStats {
  applied: number;
  ragsSet: number;
  findingsDrafted: number;
  safFlagged: number;
  score: number;
}

/**
 * Phase 2 — APPLY. Turns accepted suggestions into real statuses, RAGs every
 * area by the checklist rule, drafts findings for missing legally-required /
 * CQC-expected documents and recomputes the readiness score. The founder
 * reviews the result — nothing is published to the client automatically.
 */
export async function runAutopilotApply(auditId: string): Promise<ApplyStats> {
  const started = Date.now();
  const admin = createAdminClient();

  const { data: audit } = await admin
    .from('audits')
    .select('id, org_id')
    .eq('id', auditId)
    .single<{ id: string; org_id: string }>();
  if (!audit) throw new Error('Audit not found');

  const { data: items } = await admin.from('audit_items').select('*').eq('audit_id', auditId);
  const allItems = (items as AuditItem[]) ?? [];

  // 1. Apply suggestions to undecided items.
  const toApply = allItems.filter((i) => i.status === 'unset' && i.suggested_status !== 'unset');
  await runPooled(toApply, 12, async (item) => {
    await admin
      .from('audit_items')
      .update({
        status: item.suggested_status,
        evidence_id: item.suggested_evidence_id,
        note: item.note ?? item.suggestion_reason,
      })
      .eq('id', item.id);
  });

  // Refresh local state to reflect applied statuses.
  for (const item of toApply) {
    item.status = item.suggested_status;
  }

  // 2. RAG every area from the applied checklist.
  const { data: areas } = await admin
    .from('audit_areas')
    .select('id, area_code, rag')
    .eq('audit_id', auditId);
  let ragsSet = 0;
  await runPooled((areas as Pick<AuditArea, 'id' | 'area_code' | 'rag'>[]) ?? [], 8, async (area) => {
    const areaItems = allItems.filter((i) => i.area_code === area.area_code);
    const rag = suggestAreaRag(areaItems);
    if (rag !== 'unset' && rag !== area.rag) {
      ragsSet++;
      await admin.from('audit_areas').update({ rag }).eq('id', area.id);
    }
  });

  // 3. Draft findings for confirmed-missing legal/CQC documents (deduped by title).
  const { data: existingFindings } = await admin
    .from('audit_findings')
    .select('title')
    .eq('audit_id', auditId);
  const existingTitles = new Set(((existingFindings as { title: string }[]) ?? []).map((f) => f.title));

  const missing = allItems
    .filter(
      (i) =>
        (i.status === 'missing' || i.status === 'out_of_date') &&
        (i.requirement === 'legal' || i.requirement === 'cqc'),
    )
    .sort((a, b) => (a.requirement === b.requirement ? a.ref.localeCompare(b.ref) : a.requirement === 'legal' ? -1 : 1));

  let findingsDrafted = 0;
  const findingRows = [];
  for (const item of missing) {
    // A "missing" item whose evidence was a template is a distinct, accurate
    // story: the document exists but was never customised.
    const isTemplate =
      item.status === 'missing' && /un-customised template/i.test(item.suggestion_reason ?? '');

    // Map the detected item state to the library's gap type, then draw
    // regulator-grade wording from the findings library (per-area where
    // available, generic otherwise) rather than writing it inline.
    const gap: GapType = isTemplate
      ? 'template'
      : item.status === 'out_of_date'
        ? 'out_of_date'
        : 'missing';
    const resolved = resolveFinding(item.area_code, gap, item.title);

    // The title carries the ref for de-duplication and traceability.
    const title = `${resolved.title} (${item.ref})`;
    if (existingTitles.has(title)) continue;

    // A CQC-expected (non-legal) miss is less severe than the library default
    // (which assumes legal); soften severity/priority to match the requirement.
    const severity = item.requirement === 'legal' ? resolved.severity : 'amber';
    const priority = item.requirement === 'legal' ? resolved.priority : 'days_7';

    findingRows.push({
      audit_id: auditId,
      org_id: audit.org_id,
      area_code: item.area_code,
      severity,
      title,
      detail: resolved.detail,
      recommendation: resolved.recommendation,
      priority,
      sort: findingsDrafted,
    });
    findingsDrafted++;
    if (findingsDrafted >= 20) break; // keep the action plan actionable
  }
  if (findingRows.length) {
    await admin.from('audit_findings').insert(findingRows);
  }

  // 4. SAF cross-reference: flag questions whose backing document is missing.
  const statusByRef = new Map(allItems.map((i) => [i.ref, i.status]));
  const safNegatives = inferSafNegatives(statusByRef);
  let safFlagged = 0;
  if (safNegatives.length) {
    const { data: safRows } = await admin
      .from('saf_responses')
      .select('id, question_id, answer')
      .eq('audit_id', auditId);
    const byQuestion = new Map(
      ((safRows as { id: string; question_id: number; answer: string }[]) ?? []).map((r) => [
        r.question_id,
        r,
      ]),
    );
    const safUpdates = safNegatives
      .map((n) => ({ row: byQuestion.get(n.questionId), reason: n.reason }))
      .filter((u) => u.row && u.row.answer === 'unset');
    await runPooled(safUpdates, 8, async (u) => {
      await admin
        .from('saf_responses')
        .update({ suggested_answer: 'no', suggestion_reason: u.reason })
        .eq('id', u.row!.id);
    });
    safFlagged = safUpdates.length;
  }

  // 5. Recompute the readiness score.
  const [{ data: responses }, { data: questions }] = await Promise.all([
    admin.from('saf_responses').select('question_id, answer').eq('audit_id', auditId),
    admin.from('saf_questions').select('id, priority'),
  ]);
  const score = computeReadinessScore(
    allItems,
    (responses as Pick<SafResponse, 'question_id' | 'answer'>[]) ?? [],
    (questions as Pick<SafQuestion, 'id' | 'priority'>[]) ?? [],
  );
  await admin
    .from('audits')
    .update({ score, status: 'in_review' })
    .eq('id', auditId)
    .in('status', ['intake', 'evidence']);
  await admin.from('audits').update({ score }).eq('id', auditId);

  const stats: ApplyStats = { applied: toApply.length, ragsSet, findingsDrafted, safFlagged, score };
  await admin.from('engine_runs').insert({
    kind: 'autopilot.apply',
    org_id: audit.org_id,
    audit_id: auditId,
    stats: stats as unknown as Record<string, unknown>,
    duration_ms: Date.now() - started,
  });

  return stats;
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
