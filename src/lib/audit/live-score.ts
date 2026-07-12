import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { analyzeEvidenceByRef } from '@/lib/engine/reader/adapter';
import { computeReadinessScore, DOC_SHARE, REQUIREMENT_WEIGHT } from '@/lib/audit/scoring';
import {
  diffReasons,
  liveItemStatus,
  type ScoreFactors,
  type ScoreReason,
} from '@/lib/audit/live-score-core';
import type { ItemStatus, RequirementLevel, SafQuestion, SafResponse } from '@/types/database';

/**
 * Live readiness score.
 *
 * The delivered audit is the founder's authoritative baseline. On top of it we
 * apply the two things that change over time on their own:
 *   - AGING: an in-date document quietly crosses its 12-month review date and
 *     becomes out-of-date — the score decays even if nobody touches anything.
 *   - RENEWAL: a fresh, in-date, customised document appears in the vault for a
 *     previously missing/out-of-date item — the score recovers.
 *
 * Any item the current vault can speak to is scored live from the vault; items
 * it can't (SAF-driven, off-vault, manual) keep the founder's baseline status.
 * Every recompute is diffed against the previous snapshot to explain, credit-
 * score style, exactly why the number moved. The pure maths lives in
 * `live-score-core.ts`; this module adds the database reads.
 */

export type { ScoreFactors, ScoreReason } from '@/lib/audit/live-score-core';

export interface LiveScoreResult {
  auditId: string;
  score: number;
  factors: ScoreFactors;
  itemMeta: Map<string, { title: string; requirement: RequirementLevel }>;
}

type Admin = ReturnType<typeof createAdminClient>;

interface ItemRow {
  ref: string;
  title: string;
  requirement: RequirementLevel;
  status: ItemStatus;
  area_code: string;
  evidence_id: string | null;
}

interface EvidenceRow {
  id: string;
  file_name: string;
  extract_status: string | null;
  extracted_text: string | null;
  created_at: string;
}

export async function computeLiveScore(
  admin: Admin,
  orgId: string,
): Promise<LiveScoreResult | null> {
  const { data: audit } = await admin
    .from('audits')
    .select('id, delivered_at')
    .eq('org_id', orgId)
    .in('status', ['delivered', 'closed'])
    .order('delivered_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ id: string; delivered_at: string | null }>();
  if (!audit) return null;

  const [{ data: itemsData }, { data: evidenceData }] = await Promise.all([
    admin
      .from('audit_items')
      .select('ref, title, requirement, status, area_code, evidence_id')
      .eq('audit_id', audit.id),
    admin
      .from('evidence_files')
      .select('id, file_name, extract_status, extracted_text, created_at')
      .eq('org_id', orgId)
      .eq('lifecycle_state', 'current')
      .neq('scan_status', 'infected'),
  ]);

  const items = (itemsData as ItemRow[]) ?? [];
  if (items.length === 0) return null;
  const evidence = (evidenceData as EvidenceRow[]) ?? [];

  // Read every current document once with the same deterministic engine the
  // audit workbench uses, so "why did my score move" always matches what the
  // admin's own engine would find — no separate, weaker brain for this figure.
  const signalByEvidenceId = new Map(
    Array.from(analyzeEvidenceByRef(evidence).values()).map((v) => [v.evidenceId, v.signal]),
  );

  // Renewals may only come from evidence uploaded AFTER delivery — so at the
  // moment of delivery the live score equals the delivered score exactly, and
  // a gap can only be "renewed" by a genuinely new document.
  const deliveredAt = audit.delivered_at ? new Date(audit.delivered_at).getTime() : 0;
  const renewalSignalByRef = analyzeEvidenceByRef(
    evidence.filter((e) => new Date(e.created_at).getTime() > deliveredAt),
  );

  const itemMeta = new Map<string, { title: string; requirement: RequirementLevel }>();
  const itemStatuses: Record<string, ItemStatus> = {};
  const effectiveItems: { requirement: RequirementLevel; status: ItemStatus }[] = [];
  const counts = { present: 0, outOfDate: 0, missing: 0, legalBreaches: 0 };
  let docWeightSum = 0;

  for (const item of items) {
    // Aging is judged on the document the founder actually linked to this item;
    // renewal on the best current match in the vault for a gap.
    const linked = item.evidence_id ? signalByEvidenceId.get(item.evidence_id) ?? null : null;
    const renewal = renewalSignalByRef.get(item.ref)?.signal ?? null;
    const status = liveItemStatus(item.status, linked, renewal);

    itemMeta.set(item.ref, { title: item.title, requirement: item.requirement });
    itemStatuses[item.ref] = status;
    effectiveItems.push({ requirement: item.requirement, status });

    if (status !== 'unset' && status !== 'na') {
      docWeightSum += REQUIREMENT_WEIGHT[item.requirement];
    }
    if (status === 'present') counts.present++;
    if (status === 'out_of_date') counts.outOfDate++;
    if (status === 'missing') counts.missing++;
    if (item.requirement === 'legal' && (status === 'missing' || status === 'out_of_date')) {
      counts.legalBreaches++;
    }
  }

  const [{ data: responsesData }, { data: questionsData }] = await Promise.all([
    admin.from('saf_responses').select('question_id, answer').eq('audit_id', audit.id),
    admin.from('saf_questions').select('id, priority'),
  ]);
  const responses = (responsesData as Pick<SafResponse, 'question_id' | 'answer'>[]) ?? [];
  const questions = (questionsData as Pick<SafQuestion, 'id' | 'priority'>[]) ?? [];

  const score = computeReadinessScore(effectiveItems, responses, questions);
  const safAnswered = responses.some((r) => r.answer !== 'unset' && r.answer !== 'na');
  const docAnswered = docWeightSum > 0;
  const docShare = docAnswered && safAnswered ? DOC_SHARE : docAnswered ? 1 : 0;

  return {
    auditId: audit.id,
    score,
    factors: { itemStatuses, docWeightSum, docShare, counts },
    itemMeta,
  };
}

export interface SnapshotResult {
  score: number;
  previousScore: number | null;
  changed: boolean;
  reasons: ScoreReason[];
}

/**
 * Recomputes the live score for an org and records a snapshot when it has
 * materially changed. No-op for orgs without a delivered audit. Never throws.
 *
 * Deliberately does NOT touch `audits.score`: the delivered audit stays the
 * fixed, internally-consistent £595 deliverable (its score, RAG areas and
 * findings all reconcile). "Current readiness" lives here, in the snapshot
 * series, and is shown alongside — never overwriting — the delivered figure.
 */
export async function snapshotLiveScore(
  admin: Admin,
  orgId: string,
  source: string,
): Promise<SnapshotResult | null> {
  const live = await computeLiveScore(admin, orgId);
  if (!live) return null;

  const { data: prev } = await admin
    .from('readiness_snapshots')
    .select('score, factors')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ score: number; factors: ScoreFactors }>();

  const reasons = prev ? diffReasons(prev.factors, live.factors, live.itemMeta) : [];
  const changed = !prev || prev.score !== live.score || reasons.length > 0;
  if (!changed) {
    return { score: live.score, previousScore: prev?.score ?? null, changed: false, reasons: [] };
  }

  await admin.from('readiness_snapshots').insert({
    org_id: orgId,
    audit_id: live.auditId,
    score: live.score,
    factors: live.factors as unknown as Record<string, unknown>,
    reasons: reasons as unknown as Record<string, unknown>[],
    source,
  });

  return { score: live.score, previousScore: prev?.score ?? null, changed: true, reasons };
}

/** Snapshots every org that has a delivered audit — the daily aging pass. */
export async function snapshotAllLiveScores(admin: Admin): Promise<number> {
  const { data } = await admin
    .from('audits')
    .select('org_id')
    .in('status', ['delivered', 'closed']);
  const orgIds = [...new Set(((data as { org_id: string }[]) ?? []).map((a) => a.org_id))];
  let changed = 0;
  for (const orgId of orgIds) {
    const result = await snapshotLiveScore(admin, orgId, 'cron').catch((e) => {
      console.error('[live-score] snapshot failed', orgId, e);
      return null;
    });
    if (result?.changed) changed++;
  }
  return changed;
}
