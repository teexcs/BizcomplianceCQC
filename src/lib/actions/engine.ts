'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/data/session';
import { createClient } from '@/lib/supabase/server';
import {
  runAutopilotApply,
  type AutopilotStats,
  type ApplyStats,
} from '@/lib/engine/autopilot';
import {
  runReaderSuggest,
  buildAuditAnalysis,
  verifyOrgEvidence,
  getEvidenceProof,
  getExecutionProof,
  detectContradictions,
  detectWrongService,
  type EvidenceProof,
  type ExecutionProof,
  type Contradiction,
  type WrongServiceFlag,
} from '@/lib/engine/reader/adapter';
import { sweepPendingExtractionsForOrg } from '@/lib/evidence/process';
import type { VerificationResult } from '@/lib/audit/verification';

export interface EngineActionResult {
  ok: boolean;
  error?: string;
  suggest?: AutopilotStats;
  apply?: ApplyStats;
}

/** Scan the vault and write suggestions onto every undecided checklist item. */
export async function engineSuggest(auditId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  try {
    const supabase = await createClient();
    const { data: audit } = await supabase
      .from('audits')
      .select('org_id')
      .eq('id', auditId)
      .single<{ org_id: string }>();
    if (!audit) return { ok: false, error: 'Audit not found.' };
    await sweepPendingExtractionsForOrg(audit.org_id);
    const suggest = await runReaderSuggest(auditId);
    revalidatePath(`/admin/audits/${auditId}`);
    return { ok: true, suggest };
  } catch (e) {
    console.error('[engine] suggest failed', e);
    return { ok: false, error: 'Engine run failed — try again.' };
  }
}

/**
 * Build the internal, full "everything quoted" analysis for the auditor to
 * review (the reader's master report). Read-only — nothing is written.
 */
export async function getAuditAnalysis(
  auditId: string,
): Promise<{ ok: boolean; markdown?: string; error?: string }> {
  await requireAdminSession();
  try {
    const { markdown } = await buildAuditAnalysis(auditId);
    return { ok: true, markdown };
  } catch (e) {
    console.error('[engine] analysis failed', e);
    return { ok: false, error: 'Could not build the analysis — try again.' };
  }
}

/**
 * Structured evidence verification for one audit's org — powers the admin
 * verification panel. Read-only. Resolves the org from the audit id so the UI
 * only needs the audit it's already viewing.
 */
export async function getEvidenceVerification(
  auditId: string,
): Promise<{ ok: boolean; verification?: VerificationResult; error?: string }> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: audit, error } = await supabase
    .from('audits')
    .select('org_id')
    .eq('id', auditId)
    .single<{ org_id: string }>();
  if (error || !audit) return { ok: false, error: 'Audit not found.' };
  try {
    const verification = await verifyOrgEvidence(audit.org_id);
    return { ok: true, verification };
  } catch (e) {
    console.error('[engine] verification failed', e);
    return { ok: false, error: 'Could not verify evidence — try again.' };
  }
}

/**
 * The trust surface for admin: per-area PROVEN signals (quoted from the client's
 * own docs) + NOT-FOUND gaps, plus EXECUTION proof (policy claims cross-checked
 * against filled-in records). Read-only.
 */
export async function getEvidenceTrust(auditId: string): Promise<{
  ok: boolean;
  proof?: EvidenceProof;
  execution?: ExecutionProof;
  contradictions?: Contradiction[];
  wrongService?: WrongServiceFlag[];
  error?: string;
}> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: audit, error } = await supabase
    .from('audits')
    .select('org_id')
    .eq('id', auditId)
    .single<{ org_id: string }>();
  if (error || !audit) return { ok: false, error: 'Audit not found.' };
  try {
    const [proof, execution, contradictions, wrongService] = await Promise.all([
      getEvidenceProof(audit.org_id),
      getExecutionProof(audit.org_id),
      detectContradictions(audit.org_id),
      detectWrongService(audit.org_id),
    ]);
    return { ok: true, proof, execution, contradictions, wrongService };
  } catch (e) {
    console.error('[engine] evidence trust failed', e);
    return { ok: false, error: 'Could not build the evidence view — try again.' };
  }
}

export interface AuditDiff {
  hasPrevious: boolean;
  previousScore: number | null;
  currentScore: number | null;
  scoreDelta: number | null;
  closed: { ref: string; title: string }[]; // was a gap, now present
  regressed: { ref: string; title: string }[]; // was present, now a gap
  newGaps: { ref: string; title: string }[]; // gaps not present last time
}

const GAP_STATUSES = new Set(['missing', 'out_of_date']);

/**
 * Re-audit diff — what changed since the previous audit for this org. Compares
 * this audit's checklist to its parent (or the most recent prior audit) by ref:
 * gaps closed, items that regressed, and new gaps, plus the score movement.
 * This is the retention story ("since last time: 3 closed, +7 points").
 */
export async function getAuditDiff(auditId: string): Promise<{ ok: boolean; diff?: AuditDiff; error?: string }> {
  await requireAdminSession();
  const supabase = await createClient();

  const { data: audit } = await supabase
    .from('audits')
    .select('id, org_id, parent_audit_id, score, created_at')
    .eq('id', auditId)
    .single<{ id: string; org_id: string; parent_audit_id: string | null; score: number | null; created_at: string }>();
  if (!audit) return { ok: false, error: 'Audit not found.' };

  // The prior audit: the explicit parent, else the newest earlier audit for the org.
  let prevId = audit.parent_audit_id;
  let prevScore: number | null = null;
  if (!prevId) {
    const { data: prev } = await supabase
      .from('audits')
      .select('id, score')
      .eq('org_id', audit.org_id)
      .neq('id', auditId)
      .lt('created_at', audit.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; score: number | null }>();
    prevId = prev?.id ?? null;
    prevScore = prev?.score ?? null;
  } else {
    const { data: parent } = await supabase.from('audits').select('score').eq('id', prevId).maybeSingle<{ score: number | null }>();
    prevScore = parent?.score ?? null;
  }

  if (!prevId) {
    return { ok: true, diff: { hasPrevious: false, previousScore: null, currentScore: audit.score, scoreDelta: null, closed: [], regressed: [], newGaps: [] } };
  }

  const [{ data: curItems }, { data: prevItems }] = await Promise.all([
    supabase.from('audit_items').select('ref, title, status').eq('audit_id', auditId),
    supabase.from('audit_items').select('ref, title, status').eq('audit_id', prevId),
  ]);
  const cur = (curItems as { ref: string; title: string; status: string }[]) ?? [];
  const prev = new Map(((prevItems as { ref: string; title: string; status: string }[]) ?? []).map((i) => [i.ref, i]));

  const closed: { ref: string; title: string }[] = [];
  const regressed: { ref: string; title: string }[] = [];
  const newGaps: { ref: string; title: string }[] = [];

  for (const c of cur) {
    const p = prev.get(c.ref);
    const curGap = GAP_STATUSES.has(c.status);
    const prevGap = p ? GAP_STATUSES.has(p.status) : false;
    if (p && prevGap && !curGap && c.status === 'present') closed.push({ ref: c.ref, title: c.title });
    else if (p && !prevGap && p.status === 'present' && curGap) regressed.push({ ref: c.ref, title: c.title });
    else if (!p && curGap) newGaps.push({ ref: c.ref, title: c.title });
  }

  const scoreDelta =
    audit.score != null && prevScore != null ? audit.score - prevScore : null;

  return {
    ok: true,
    diff: { hasPrevious: true, previousScore: prevScore, currentScore: audit.score, scoreDelta, closed, regressed, newGaps },
  };
}

/** Apply all suggestions, RAG areas, draft findings and rescore. */
export async function engineApply(auditId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  try {
    const apply = await runAutopilotApply(auditId);
    revalidatePath(`/admin/audits/${auditId}`);
    revalidatePath('/admin/audits');
    return { ok: true, apply };
  } catch (e) {
    console.error('[engine] apply failed', e);
    return { ok: false, error: 'Applying suggestions failed — try again.' };
  }
}

/** Accept one item's suggestion. */
export async function acceptSuggestion(itemId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('audit_items')
    .select('id, audit_id, status, suggested_status, suggested_evidence_id, suggestion_reason, note')
    .eq('id', itemId)
    .single<{
      id: string;
      audit_id: string;
      status: string;
      suggested_status: string;
      suggested_evidence_id: string | null;
      suggestion_reason: string | null;
      note: string | null;
    }>();
  if (error || !item) return { ok: false, error: 'Item not found.' };
  if (item.suggested_status === 'unset') return { ok: false, error: 'Nothing suggested for this item.' };

  const { error: upError } = await supabase
    .from('audit_items')
    .update({
      status: item.suggested_status,
      evidence_id: item.suggested_evidence_id,
      note: item.note ?? item.suggestion_reason,
    })
    .eq('id', itemId);
  if (upError) return { ok: false, error: 'Could not accept the suggestion.' };

  revalidatePath(`/admin/audits/${item.audit_id}`);
  return { ok: true };
}

/** Clear one item's suggestion (human disagrees). */
export async function dismissSuggestion(itemId: string): Promise<EngineActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('audit_items')
    .update({
      suggested_status: 'unset',
      suggested_evidence_id: null,
      suggestion_confidence: null,
      suggestion_reason: null,
    })
    .eq('id', itemId)
    .select('audit_id')
    .single<{ audit_id: string }>();
  if (error || !item) return { ok: false, error: 'Could not dismiss the suggestion.' };

  revalidatePath(`/admin/audits/${item.audit_id}`);
  return { ok: true };
}
