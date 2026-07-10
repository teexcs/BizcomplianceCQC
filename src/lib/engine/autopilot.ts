import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { assignEvidence, matchEvidence, type MatchCandidate } from './matcher';
import { inferSafNegatives } from './saf-crosswalk';
import { computeReadinessScore, suggestAreaRag } from '@/lib/audit/scoring';
import type { VerificationResult } from '@/lib/evidence/verify';
import type {
  AuditArea,
  AuditItem,
  ItemStatus,
  SafQuestion,
  SafResponse,
} from '@/types/database';

type Admin = ReturnType<typeof createAdminClient>;

export interface AutopilotStats {
  evidenceScanned: number;
  itemsMatched: number;
  itemsSuggestedMissing: number;
  itemsAlreadyDecided: number;
  itemsOutOfDate: number;
  itemsTemplateFlagged: number;
}

interface DerivedSuggestion {
  status: ItemStatus;
  reason: string;
  evidenceId: string | null;
}

/**
 * Turns a checklist match into an honest suggestion using the matched
 * document's content verification: an un-customised template is not evidence,
 * an out-of-cycle document is out of date, everything else is present.
 */
function deriveSuggestion(
  match: { evidenceId: string; confidence: number; reason: string; fileName: string },
  verification: Partial<VerificationResult> | null | undefined,
): DerivedSuggestion {
  if (verification?.isTemplate) {
    const hits = verification.templateHits?.length
      ? ` (${verification.templateHits.join(', ')})`
      : '';
    return {
      status: 'missing',
      reason: `Matched "${match.fileName}" but it is an un-customised template${hits} — it would not be accepted as evidence.`,
      evidenceId: match.evidenceId,
    };
  }
  if (verification?.isOutOfDate) {
    const dated = verification.reviewDate ? ` Dated ${verification.reviewDate};` : '';
    return {
      status: 'out_of_date',
      reason: `${match.reason} — ${match.fileName}.${dated} past its 12-month review cycle.`,
      evidenceId: match.evidenceId,
    };
  }
  return {
    status: 'present',
    reason: `${match.reason} — ${match.fileName}`,
    evidenceId: match.evidenceId,
  };
}

/** Shape of the evidence rows the engine reads (incl. Phase 0/1 intelligence). */
interface EngineEvidenceRow {
  id: string;
  file_name: string;
  area_code: string | null;
  scan_status: string;
  extracted_text: string | null;
  verification: Partial<VerificationResult> | null;
}

/**
 * Phase 1 — SUGGEST. Scans the organisation's whole evidence vault against the
 * audit's 139-item snapshot and writes a suggestion (status + evidence link +
 * confidence + reason) onto every undecided item. Never touches a decision a
 * human has already made.
 */
export async function runAutopilotSuggest(auditId: string): Promise<AutopilotStats> {
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
      .select('id, file_name, area_code, scan_status, extracted_text, verification, lifecycle_state')
      .eq('org_id', audit.org_id)
      .eq('lifecycle_state', 'current')
      .neq('scan_status', 'infected'),
  ]);
  const allItems = (items as AuditItem[]) ?? [];
  const evidenceRows = (evidence as EngineEvidenceRow[]) ?? [];
  const files = evidenceRows.map((e) => ({
    id: e.id,
    fileName: e.file_name,
    areaCode: e.area_code,
    content: e.extracted_text,
  }));
  const verificationById = new Map(evidenceRows.map((e) => [e.id, e.verification]));

  const candidates: MatchCandidate[] = allItems.map((i) => ({
    ref: i.ref,
    areaCode: i.area_code,
    title: i.title,
    docType: '',
  }));

  const assignments = assignEvidence(files, candidates);

  const stats: AutopilotStats = {
    evidenceScanned: files.length,
    itemsMatched: 0,
    itemsSuggestedMissing: 0,
    itemsAlreadyDecided: 0,
    itemsOutOfDate: 0,
    itemsTemplateFlagged: 0,
  };

  // Batched update: one round trip per changed item, run concurrently in
  // small pools to stay fast without hammering the pooler.
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  for (const item of allItems) {
    if (item.status !== 'unset') {
      stats.itemsAlreadyDecided++;
      continue;
    }
    const match = assignments.get(item.ref);
    if (match) {
      stats.itemsMatched++;
      const suggestion = deriveSuggestion(match, verificationById.get(match.evidenceId));
      if (suggestion.status === 'out_of_date') stats.itemsOutOfDate++;
      if (suggestion.status === 'missing') stats.itemsTemplateFlagged++;
      updates.push({
        id: item.id,
        patch: {
          suggested_status: suggestion.status,
          suggested_evidence_id: suggestion.evidenceId,
          suggestion_confidence: match.confidence,
          suggestion_reason: suggestion.reason,
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
          suggestion_reason: 'No matching evidence found in the vault',
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
    kind: 'autopilot.suggest',
    org_id: audit.org_id,
    audit_id: auditId,
    stats: stats as unknown as Record<string, unknown>,
    duration_ms: Date.now() - started,
  });

  return stats;
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
    const requiredBy = item.requirement === 'legal' ? 'legally required' : 'expected by CQC';

    const verb = isTemplate ? 'present but not customised' : item.status === 'missing' ? 'not evidenced' : 'out of date';
    const title = `${item.title} ${verb} (${item.ref})`;
    if (existingTitles.has(title)) continue;

    let detail: string;
    let recommendation: string;
    if (isTemplate) {
      detail = `A document for "${item.title}" exists but is an un-customised template — placeholder text remains, so it would not be accepted as evidence. This item is ${requiredBy}.`;
      recommendation = `Tailor the template to your service — replace every placeholder field and record the review date — then re-file it under area ${item.area_code}.`;
    } else if (item.status === 'missing') {
      detail = `No document matching "${item.title}" was found in the evidence vault. This item is ${requiredBy}.`;
      recommendation = `Put "${item.title}" in place and file the evidence under area ${item.area_code}. A compliant template can be issued from the BizCompliance library.`;
    } else {
      detail = `"${item.title}" was located but is outside its review cycle.`;
      recommendation = `Review and re-issue "${item.title}", then record the review date in the document control block.`;
    }

    findingRows.push({
      audit_id: auditId,
      org_id: audit.org_id,
      area_code: item.area_code,
      severity: item.requirement === 'legal' ? 'red' : 'amber',
      title,
      detail,
      recommendation,
      priority: item.requirement === 'legal' ? 'fix_first' : 'days_7',
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

/**
 * Real-time matching for a single new upload: keeps suggestions warm without
 * a full engine run. Called from the evidence upload route.
 */
export async function suggestForNewEvidence(evidenceId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: file } = await admin
    .from('evidence_files')
    .select('id, org_id, file_name, area_code, extracted_text, verification, lifecycle_state')
    .eq('id', evidenceId)
    .single<{
      id: string;
      org_id: string;
      file_name: string;
      area_code: string | null;
      extracted_text: string | null;
      verification: Partial<VerificationResult> | null;
      lifecycle_state: string;
    }>();
  if (!file) return;
  if (file.lifecycle_state !== 'current') return;

  const { data: audit } = await admin
    .from('audits')
    .select('id')
    .eq('org_id', file.org_id)
    .not('status', 'in', '("delivered","closed")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!audit) return;

  const { data: items } = await admin
    .from('audit_items')
    .select('id, ref, area_code, title, status, suggestion_confidence')
    .eq('audit_id', audit.id)
    .eq('status', 'unset');
  const undecided =
    (items as Pick<AuditItem, 'id' | 'ref' | 'area_code' | 'title' | 'status' | 'suggestion_confidence'>[]) ?? [];
  if (undecided.length === 0) return;

  const matches = matchEvidence(
    { fileName: file.file_name, areaCode: file.area_code, content: file.extracted_text },
    undecided.map((i) => ({ ref: i.ref, areaCode: i.area_code, title: i.title, docType: '' })),
  );
  const best = matches[0];
  if (!best) return;

  const item = undecided.find((i) => i.ref === best.ref);
  if (!item) return;
  // Only improve on an existing suggestion.
  if ((item.suggestion_confidence ?? 0) >= best.confidence) return;

  const suggestion = deriveSuggestion(
    { evidenceId: file.id, confidence: best.confidence, reason: best.reason, fileName: file.file_name },
    file.verification,
  );

  await admin
    .from('audit_items')
    .update({
      suggested_status: suggestion.status,
      suggested_evidence_id: suggestion.evidenceId,
      suggestion_confidence: best.confidence,
      suggestion_reason: suggestion.reason,
    })
    .eq('id', item.id);

  await admin.from('engine_runs').insert({
    kind: 'match.upload',
    org_id: file.org_id,
    audit_id: audit.id,
    stats: { evidence_id: file.id, ref: best.ref, confidence: best.confidence },
  });
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
