import 'server-only';
// NOTE: the old fuzzy-matcher SUGGEST brain that used to live here was retired
// when the deterministic policy-evidence-reader took over — see
// docs/OLD_ENGINE.md. What remains is the shared APPLY pipeline
// (apply suggestions → RAG areas → draft findings → score) that the reader's
// suggestions flow into. One brain decides; this turns decisions into the report.
import { createAdminClient } from '@/lib/supabase/server';
import { inferSafNegatives } from './saf-crosswalk';
import { computeReadinessScore, suggestAreaRag } from '@/lib/audit/scoring';
import { resolveFinding, type GapType, type ResolvedFinding } from '@/lib/audit/findings-library';
import { verifyOrgEvidence } from '@/lib/engine/reader/adapter';
import type { AuditArea, AuditItem, SafQuestion, SafResponse } from '@/types/database';

type Admin = ReturnType<typeof createAdminClient>;

/** file_samples row joined to its evidence file name, for sampling findings. */
interface SampleRow {
  sample_type: string;
  verdict: 'partial' | 'not_compliant';
  area_code: string | null;
  findings: string | null;
  evidence: { file_name: string } | null;
}

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
  /** Of findingsDrafted, how many came from each detection source. */
  findingsFromDocuments: number;
  findingsFromVerification: number;
  findingsFromSampling: number;
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
  const orgId = audit.org_id;

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

  // 2. RAG every area from the applied checklist AND fill its notes with what
  //    the engine found — so a non-missing area shows WHERE the evidence is,
  //    not a blank RAG. evidence_sighted lists the documents/quotes that prove
  //    the area; findings lists what is still missing or out of date.
  const { data: areas } = await admin
    .from('audit_areas')
    .select('id, area_code, rag, evidence_sighted, findings')
    .eq('audit_id', auditId);
  let ragsSet = 0;
  await runPooled(
    (areas as Pick<AuditArea, 'id' | 'area_code' | 'rag' | 'evidence_sighted' | 'findings'>[]) ?? [],
    8,
    async (area) => {
      const areaItems = allItems.filter((i) => i.area_code === area.area_code);
      const rag = suggestAreaRag(areaItems);

      const present = areaItems.filter((i) => i.status === 'present');
      const missing = areaItems.filter((i) => i.status === 'missing');
      const stale = areaItems.filter((i) => i.status === 'out_of_date');

      // Evidence sighted: the AI's own quoted reasons for the present items
      // (these carry "Evidence found in … (line N)"), so you see exactly what
      // it found and where. Falls back to the item title.
      const sighted = present
        .slice(0, 8)
        .map((i) => {
          const reason = (i.note ?? i.suggestion_reason ?? '').trim();
          return reason ? `• ${i.title}: ${reason}` : `• ${i.title}`;
        })
        .join('\n');
      const gaps = [
        ...missing.map((i) => `• Missing: ${i.title}`),
        ...stale.map((i) => `• Out of date: ${i.title}`),
      ]
        .slice(0, 10)
        .join('\n');

      const patch: Record<string, unknown> = {};
      if (rag !== 'unset' && rag !== area.rag) {
        patch.rag = rag;
        ragsSet++;
      }
      // Only auto-fill notes the founder hasn't already written.
      if (sighted && !area.evidence_sighted) patch.evidence_sighted = sighted;
      if (gaps && !area.findings) patch.findings = gaps;

      if (Object.keys(patch).length > 0) {
        await admin.from('audit_areas').update(patch).eq('id', area.id);
      }
    },
  );

  // 3. Draft findings from every detection source, all through the findings
  //    library so the wording is consistent and regulator-grade. Deduped by
  //    title and capped so the action plan stays actionable. The founder edits
  //    or deletes any of these before the report goes out.
  const { data: existingFindings } = await admin
    .from('audit_findings')
    .select('title')
    .eq('audit_id', auditId);
  const existingTitles = new Set(((existingFindings as { title: string }[]) ?? []).map((f) => f.title));

  const FINDINGS_CAP = 30;
  const findingRows: Array<Record<string, unknown>> = [];
  const source = { documents: 0, verification: 0, sampling: 0 };

  /** Push one library-resolved finding if unique and under the cap. */
  function addFinding(
    areaCode: string,
    resolved: ResolvedFinding,
    key: string,
    which: keyof typeof source,
    override?: { severity?: ResolvedFinding['severity']; priority?: ResolvedFinding['priority'] },
  ): boolean {
    if (findingRows.length >= FINDINGS_CAP) return false;
    const title = `${resolved.title} (${key})`;
    if (existingTitles.has(title)) return false;
    existingTitles.add(title); // guard against duplicates within this run too
    findingRows.push({
      audit_id: auditId,
      org_id: orgId,
      area_code: areaCode,
      severity: override?.severity ?? resolved.severity,
      title,
      detail: resolved.detail,
      recommendation: resolved.recommendation,
      priority: override?.priority ?? resolved.priority,
      sort: findingRows.length,
    });
    source[which]++;
    return true;
  }

  // 3a. Document gaps: confirmed-missing / out-of-date / uncustomised-template
  //     legal or CQC library items.
  const missing = allItems
    .filter(
      (i) =>
        (i.status === 'missing' || i.status === 'out_of_date') &&
        (i.requirement === 'legal' || i.requirement === 'cqc'),
    )
    .sort((a, b) => (a.requirement === b.requirement ? a.ref.localeCompare(b.ref) : a.requirement === 'legal' ? -1 : 1));

  for (const item of missing) {
    const isTemplate =
      item.status === 'missing' && /un-customised template/i.test(item.suggestion_reason ?? '');
    const gap: GapType = isTemplate
      ? 'template'
      : item.status === 'out_of_date'
        ? 'out_of_date'
        : 'missing';
    const resolved = resolveFinding(item.area_code, gap, item.title);
    // A CQC-expected (non-legal) miss is less severe than the library default.
    const override =
      item.requirement === 'legal'
        ? undefined
        : { severity: 'amber' as const, priority: 'days_7' as const };
    addFinding(item.area_code, resolved, item.ref, 'documents', override);
  }

  // 3b. Verification gaps: a policy is present but the corroborating record
  //     that proves it in practice was not supplied. Only the essential
  //     (critical) policy-only items are auto-drafted; the rest are visible in
  //     the report's Evidence Reviewed section and available via the picker.
  try {
    const verification = await verifyOrgEvidence(orgId);
    for (const area of verification.areas) {
      for (const it of area.items) {
        if (it.state !== 'policy_only' || !it.item.critical) continue;
        const resolved = resolveFinding(area.code, 'policy_only', it.item.label);
        addFinding(area.code, resolved, `verify:${it.item.id}`, 'verification');
      }
    }
  } catch (e) {
    console.error('[autopilot] verification draft skipped', e);
  }

  // 3c. Sampling verdicts: individual client records the auditor judged
  //     partial or not-compliant become findings, carrying the auditor's own
  //     notes as the detail so the specific issue is preserved.
  const { data: samples } = await admin
    .from('file_samples')
    .select('sample_type, verdict, area_code, findings, evidence:evidence_files(file_name)')
    .eq('audit_id', auditId)
    .in('verdict', ['partial', 'not_compliant']);
  for (const s of (samples as unknown as SampleRow[]) ?? []) {
    const areaCode = s.area_code ?? '10'; // fall back to governance if unsorted
    const gap: GapType = s.verdict === 'partial' ? 'sample_partial' : 'sample_not_compliant';
    const subject = s.evidence?.file_name ?? 'Sampled record';
    const resolved = resolveFinding(areaCode, gap, subject);
    // Preserve the auditor's specific notes — they beat the generic wording.
    if (s.findings?.trim()) {
      resolved.detail = `${resolved.detail} Auditor note: ${s.findings.trim()}`;
    }
    addFinding(areaCode, resolved, `sample:${subject}`, 'sampling');
  }

  const findingsDrafted = findingRows.length;
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

  const stats: ApplyStats = {
    applied: toApply.length,
    ragsSet,
    findingsDrafted,
    findingsFromDocuments: source.documents,
    findingsFromVerification: source.verification,
    findingsFromSampling: source.sampling,
    safFlagged,
    score,
  };
  await admin.from('engine_runs').insert({
    kind: 'autopilot.apply',
    org_id: orgId,
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
