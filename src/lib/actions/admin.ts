'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdminSession } from '@/lib/data/session';
import {
  computeReadinessScore,
  computeScoreBreakdown,
  safDomainScores,
  suggestAreaRag,
} from '@/lib/audit/scoring';
import { renderAuditReportPdf } from '@/lib/report/generate';
import { verifyOrgEvidence } from '@/lib/engine/reader/adapter';
import { sendEmail } from '@/lib/email/send';
import {
  documentsIssuedEmail,
  reportPublishedEmail,
  requestUpdateEmail,
} from '@/lib/email/templates';
import { entitlementsFor, siteVisitQuotaForPlan, formatQuota } from '@/lib/plans/entitlements';
import { buildOrgPatchValues, personalizeDocx } from '@/lib/documents/personalize';
import type { PlanId } from '@/lib/stripe/plans';
import type {
  Audit,
  AuditArea,
  AuditFinding,
  AuditItem,
  LibraryArea,
  LibraryAsset,
  Organisation,
  SafQuestion,
  SafResponse,
} from '@/types/database';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Shape of a file_samples row joined to its evidence file name (for the PDF). */
interface SampleJoin {
  sample_type: string;
  verdict: 'unset' | 'compliant' | 'partial' | 'not_compliant' | 'not_applicable';
  area_code: string | null;
  findings: string | null;
  evidence: { file_name: string } | null;
}

// ---------------------------------------------------------------------------
// Audit workbench: checklist items
// ---------------------------------------------------------------------------
const itemStatusSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(['unset', 'present', 'missing', 'out_of_date', 'na']),
  note: z.string().max(2000).nullable().optional(),
});

export async function setAuditItemStatus(input: z.infer<typeof itemStatusSchema>): Promise<ActionResult> {
  const parsed = itemStatusSchema.safeParse(input);
  if (!parsed.success) return fail('Invalid item update.');
  await requireAdminSession();

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('audit_items')
    .update({ status: parsed.data.status, note: parsed.data.note ?? null })
    .eq('id', parsed.data.itemId)
    .select('audit_id, area_code')
    .single<{ audit_id: string; area_code: string }>();
  if (error || !item) return fail('Could not update the checklist item.');

  await recalculateAudit(item.audit_id);
  revalidatePath(`/admin/audits/${item.audit_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit workbench: area assessment
// ---------------------------------------------------------------------------
const areaSchema = z.object({
  areaId: z.string().uuid(),
  rag: z.enum(['unset', 'green', 'amber', 'red']),
  evidence_sighted: z.string().max(4000).nullable().optional(),
  findings: z.string().max(4000).nullable().optional(),
  action: z.string().max(4000).nullable().optional(),
  owner: z.string().max(200).nullable().optional(),
});

export async function setAreaAssessment(input: z.infer<typeof areaSchema>): Promise<ActionResult> {
  const parsed = areaSchema.safeParse(input);
  if (!parsed.success) return fail('Invalid area update.');
  await requireAdminSession();

  const supabase = await createClient();
  const { areaId, ...fields } = parsed.data;
  const { data: area, error } = await supabase
    .from('audit_areas')
    .update(fields)
    .eq('id', areaId)
    .select('audit_id')
    .single<{ audit_id: string }>();
  if (error || !area) return fail('Could not update the area assessment.');

  revalidatePath(`/admin/audits/${area.audit_id}`);
  return { ok: true };
}

/** Applies the checklist rule (LEGAL missing ⇒ red, etc.) to every area of an audit. */
export async function applySuggestedRags(auditId: string): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();

  const [{ data: items }, { data: areas }] = await Promise.all([
    supabase.from('audit_items').select('area_code, requirement, status').eq('audit_id', auditId),
    supabase.from('audit_areas').select('id, area_code').eq('audit_id', auditId),
  ]);
  if (!items || !areas) return fail('Audit not found.');

  for (const area of areas as Pick<AuditArea, 'id' | 'area_code'>[]) {
    const areaItems = (items as Pick<AuditItem, 'area_code' | 'requirement' | 'status'>[]).filter(
      (i) => i.area_code === area.area_code,
    );
    const rag = suggestAreaRag(areaItems);
    await supabase.from('audit_areas').update({ rag }).eq('id', area.id);
  }

  revalidatePath(`/admin/audits/${auditId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit workbench: SAF interview
// ---------------------------------------------------------------------------
const safSchema = z.object({
  responseId: z.string().uuid(),
  answer: z.enum(['unset', 'yes', 'partial', 'no', 'na']),
  note: z.string().max(2000).nullable().optional(),
});

export async function setSafAnswer(input: z.infer<typeof safSchema>): Promise<ActionResult> {
  const parsed = safSchema.safeParse(input);
  if (!parsed.success) return fail('Invalid answer.');
  await requireAdminSession();

  const supabase = await createClient();
  const { data: resp, error } = await supabase
    .from('saf_responses')
    .update({ answer: parsed.data.answer, note: parsed.data.note ?? null })
    .eq('id', parsed.data.responseId)
    .select('audit_id')
    .single<{ audit_id: string }>();
  if (error || !resp) return fail('Could not save the answer.');

  await recalculateAudit(resp.audit_id);
  revalidatePath(`/admin/audits/${resp.audit_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit workbench: findings
// ---------------------------------------------------------------------------
const findingSchema = z.object({
  id: z.string().uuid().optional(),
  auditId: z.string().uuid(),
  area_code: z.string().max(2).nullable().optional(),
  severity: z.enum(['green', 'amber', 'red']),
  title: z.string().min(3).max(300),
  detail: z.string().max(4000).nullable().optional(),
  recommendation: z.string().max(4000).nullable().optional(),
  priority: z.enum(['fix_first', 'days_7', 'days_14', 'days_30']),
});

export async function upsertFinding(input: z.infer<typeof findingSchema>): Promise<ActionResult> {
  const parsed = findingSchema.safeParse(input);
  if (!parsed.success) return fail('Please give the finding a title and severity.');
  await requireAdminSession();

  const supabase = await createClient();
  const { data: audit } = await supabase
    .from('audits')
    .select('org_id')
    .eq('id', parsed.data.auditId)
    .single<{ org_id: string }>();
  if (!audit) return fail('Audit not found.');

  const row = {
    audit_id: parsed.data.auditId,
    org_id: audit.org_id,
    area_code: parsed.data.area_code || null,
    severity: parsed.data.severity,
    title: parsed.data.title,
    detail: parsed.data.detail ?? null,
    recommendation: parsed.data.recommendation ?? null,
    priority: parsed.data.priority,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from('audit_findings').update(row).eq('id', parsed.data.id);
    if (error) return fail('Could not update the finding.');
  } else {
    const { error } = await supabase.from('audit_findings').insert(row);
    if (error) return fail('Could not create the finding.');
  }

  revalidatePath(`/admin/audits/${parsed.data.auditId}`);
  return { ok: true };
}

export async function deleteFinding(findingId: string, auditId: string): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase.from('audit_findings').delete().eq('id', findingId);
  if (error) return fail('Could not delete the finding.');
  revalidatePath(`/admin/audits/${auditId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit workbench: file sampling (Step 5 — read individual records in depth)
// ---------------------------------------------------------------------------
const sampleSchema = z.object({
  auditId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  sampleType: z.string().max(40).optional(),
  verdict: z.enum(['unset', 'compliant', 'partial', 'not_compliant', 'not_applicable']),
  findings: z.string().max(4000).optional(),
});

/**
 * Record (or update) the auditor's sampling review of one client file. Upserts
 * on (audit, evidence) so re-reviewing a file overwrites the prior verdict
 * rather than duplicating. Resolves org + area from the evidence row so the UI
 * only sends the verdict and notes.
 */
export async function saveFileSample(
  input: z.infer<typeof sampleSchema>,
): Promise<ActionResult> {
  const ctx = await requireAdminSession();
  const parsed = sampleSchema.safeParse(input);
  if (!parsed.success) return fail('Invalid sample.');

  const supabase = await createClient();
  const { data: evidence } = await supabase
    .from('evidence_files')
    .select('id, org_id, area_code')
    .eq('id', parsed.data.evidenceId)
    .single<{ id: string; org_id: string; area_code: string | null }>();
  if (!evidence) return fail('Evidence file not found.');

  // Verify the evidence belongs to the audit's org (defence in depth over RLS).
  const { data: audit } = await supabase
    .from('audits')
    .select('org_id')
    .eq('id', parsed.data.auditId)
    .single<{ org_id: string }>();
  if (!audit) return fail('Audit not found.');
  if (audit.org_id !== evidence.org_id) return fail('That file is not part of this audit.');

  const row = {
    audit_id: parsed.data.auditId,
    org_id: evidence.org_id,
    evidence_id: evidence.id,
    area_code: evidence.area_code,
    sample_type: parsed.data.sampleType || 'other',
    verdict: parsed.data.verdict,
    findings: parsed.data.findings?.trim() ? parsed.data.findings.trim() : null,
    reviewed_by: ctx.userId,
  };

  const { error } = await supabase
    .from('file_samples')
    .upsert(row, { onConflict: 'audit_id,evidence_id' });
  if (error) return fail('Could not save the sample review.');

  revalidatePath(`/admin/audits/${parsed.data.auditId}`);
  return { ok: true };
}

/** Remove a file from the sample (auditor decides not to sample it after all). */
export async function deleteFileSample(sampleId: string, auditId: string): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase.from('file_samples').delete().eq('id', sampleId);
  if (error) return fail('Could not remove the sample.');
  revalidatePath(`/admin/audits/${auditId}`);
  return { ok: true };
}

export async function resolveFinding(findingId: string, auditId: string): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from('audit_findings')
    .update({ status: 'resolved' })
    .eq('id', findingId);
  if (error) return fail('Could not resolve the finding.');
  revalidatePath(`/admin/audits/${auditId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit lifecycle
// ---------------------------------------------------------------------------
export async function setAuditStatus(
  auditId: string,
  status: Audit['status'],
  summary?: string,
): Promise<ActionResult> {
  await requireAdminSession();
  if (status === 'delivered') {
    const readiness = await checkAuditReadyToDeliver(auditId);
    if (!readiness.ready) return fail(readiness.reason ?? 'This audit is not ready to deliver yet.');
  }
  const supabase = await createClient();
  const update: Record<string, unknown> = { status };
  if (summary !== undefined) update.summary = summary;
  if (status === 'delivered') update.delivered_at = new Date().toISOString();
  const { error } = await supabase.from('audits').update(update).eq('id', auditId);
  if (error) return fail('Could not update audit status.');
  revalidatePath('/admin/audits');
  revalidatePath(`/admin/audits/${auditId}`);
  return { ok: true };
}

export async function setAuditSummary(auditId: string, summary: string): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from('audits')
    .update({ summary: summary.slice(0, 6000) })
    .eq('id', auditId);
  if (error) return fail('Could not save the summary.');
  revalidatePath(`/admin/audits/${auditId}`);
  return { ok: true };
}

/** Founder-created audit (offline payment or re-audit for a subscriber). */
export async function createAuditManually(
  orgId: string,
  kind: 'one_off' | 're_audit',
): Promise<ActionResult> {
  await requireAdminSession();
  const admin = createAdminClient();

  const { data: audit, error } = await admin
    .from('audits')
    .insert({
      org_id: orgId,
      kind,
      status: 'evidence',
      due_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    })
    .select('id')
    .single<{ id: string }>();
  if (error || !audit) return fail('Could not create the audit.');

  const { error: snapErr } = await admin.rpc('build_audit_snapshot', { p_audit_id: audit.id });
  if (snapErr) return fail(`Audit created but snapshot failed: ${snapErr.message}`);

  revalidatePath('/admin/audits');
  return { ok: true, id: audit.id };
}

async function recalculateAudit(auditId: string): Promise<number | null> {
  const supabase = await createClient();
  const [{ data: items }, { data: responses }, { data: questions }] = await Promise.all([
    supabase.from('audit_items').select('requirement, status').eq('audit_id', auditId),
    supabase.from('saf_responses').select('question_id, answer').eq('audit_id', auditId),
    supabase.from('saf_questions').select('id, priority'),
  ]);
  if (!items || !responses || !questions) return null;

  const score = computeReadinessScore(
    items as Pick<AuditItem, 'requirement' | 'status'>[],
    responses as Pick<SafResponse, 'question_id' | 'answer'>[],
    questions as Pick<SafQuestion, 'id' | 'priority'>[],
  );
  await supabase.from('audits').update({ score }).eq('id', auditId);
  return score;
}

/**
 * Guards the two irreversible-feeling moments — generating/publishing a report
 * and marking an audit delivered — against going out with an unreviewed
 * checklist. A 0/100 report with nothing assessed is a genuine "0 legal/CQC
 * documents reviewed" state, not a stub: catch it before it reaches a client.
 */
async function checkAuditReadyToDeliver(auditId: string): Promise<{ ready: boolean; reason?: string }> {
  const admin = createAdminClient();
  const { count: total } = await admin
    .from('audit_items')
    .select('id', { count: 'exact', head: true })
    .eq('audit_id', auditId);
  const { count: decided } = await admin
    .from('audit_items')
    .select('id', { count: 'exact', head: true })
    .eq('audit_id', auditId)
    .neq('status', 'unset');
  const { count: ragged } = await admin
    .from('audit_areas')
    .select('id', { count: 'exact', head: true })
    .eq('audit_id', auditId)
    .neq('rag', 'unset');

  const t = total ?? 0;
  const d = decided ?? 0;
  if (t === 0) return { ready: false, reason: 'This audit has no checklist items yet.' };
  if (d === 0) {
    return {
      ready: false,
      reason: 'No checklist items have been reviewed yet — run the engine and review the checklist before delivering.',
    };
  }
  if ((ragged ?? 0) === 0) {
    return {
      ready: false,
      reason: 'No compliance areas have a RAG rating yet — apply suggested RAGs or set them manually before delivering.',
    };
  }
  return { ready: true };
}

// ---------------------------------------------------------------------------
// Evidence review
// ---------------------------------------------------------------------------
const evidenceReviewSchema = z.object({
  evidenceId: z.string().uuid(),
  review_status: z.enum(['pending', 'reviewed', 'flagged']),
  reviewer_note: z.string().max(2000).nullable().optional(),
});

export async function reviewEvidence(input: z.infer<typeof evidenceReviewSchema>): Promise<ActionResult> {
  const parsed = evidenceReviewSchema.safeParse(input);
  if (!parsed.success) return fail('Invalid review.');
  await requireAdminSession();

  const supabase = await createClient();
  const { error } = await supabase
    .from('evidence_files')
    .update({
      review_status: parsed.data.review_status,
      reviewer_note: parsed.data.reviewer_note ?? null,
    })
    .eq('id', parsed.data.evidenceId);
  if (error) return fail('Could not update the evidence review.');

  revalidatePath('/admin/evidence');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Issue library documents to a client (founder-issued model)
// ---------------------------------------------------------------------------
const issueSchema = z.object({
  orgId: z.string().uuid(),
  assetIds: z.array(z.string().uuid()).min(1).max(139),
  note: z.string().max(1000).optional(),
  auditId: z.string().uuid().nullable().optional(),
});

export async function issueDocuments(input: z.infer<typeof issueSchema>): Promise<ActionResult> {
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return fail('Select at least one document.');
  const ctx = await requireAdminSession();
  const admin = createAdminClient();

  const [{ data: org }, { data: assets }] = await Promise.all([
    admin.from('organisations').select('*').eq('id', parsed.data.orgId).single<Organisation>(),
    admin.from('library_assets').select('*').in('id', parsed.data.assetIds),
  ]);
  if (!org) return fail('Organisation not found.');
  if (!assets?.length) return fail('No matching library documents.');

  // Plan gate: Professional/Partner clients receive documents personalised
  // from their org record; Essentials (and pay-as-you-go) receive the
  // original templates with [PLACEHOLDER]s to complete themselves.
  const [{ data: activeSub }, { data: ownerProfile }] = await Promise.all([
    admin
      .from('subscriptions')
      .select('plan, status')
      .eq('org_id', org.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ plan: PlanId; status: string }>(),
    admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', org.owner_id)
      .single<{ email: string; full_name: string | null }>(),
  ]);
  const personalise = entitlementsFor(activeSub?.plan ?? null).personalisedDocuments;
  const patchValues = personalise
    ? buildOrgPatchValues(org, ownerProfile?.full_name ?? null)
    : null;

  if (parsed.data.auditId) {
    const { data: audit } = await admin
      .from('audits')
      .select('id, status')
      .eq('id', parsed.data.auditId)
      .eq('org_id', org.id)
      .single<{ id: string; status: Audit['status'] }>();
    if (!audit) return fail('Audit not found.');
    if (!['delivered', 'closed'].includes(audit.status)) {
      return fail('You can only issue documents from a delivered audit.');
    }
  }

  let issued = 0;
  const failures: string[] = [];

  for (const asset of assets as LibraryAsset[]) {
    if (!asset.storage_path) {
      failures.push(`${asset.ref}: no file uploaded to the library yet`);
      continue;
    }
    const { data: file, error: dlError } = await admin.storage
      .from('library')
      .download(asset.storage_path);
    if (dlError || !file) {
      failures.push(`${asset.ref}: could not read the library file`);
      continue;
    }

    let payload: Buffer = Buffer.from(await file.arrayBuffer());
    let personalised = false;
    if (patchValues) {
      const filled = await personalizeDocx(payload, patchValues);
      if (filled) {
        payload = filled;
        personalised = true;
      }
      // On failure the original template is issued — personalisation never blocks.
    }

    const fileName = `${asset.ref}-${asset.current_version}.docx`;
    const destPath = `${org.id}/${parsed.data.auditId ?? 'general'}/${fileName}`;
    const { error: upError } = await admin.storage
      .from('deliverables')
      .upload(destPath, payload, {
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    if (upError) {
      failures.push(`${asset.ref}: upload failed`);
      continue;
    }

    // Supersede any previous issue of the same asset for this org.
    await admin
      .from('client_documents')
      .update({ status: 'superseded' })
      .eq('org_id', org.id)
      .eq('asset_id', asset.id)
      .eq('status', 'issued');

    const { error: insError } = await admin.from('client_documents').insert({
      org_id: org.id,
      asset_id: asset.id,
      audit_id: parsed.data.auditId ?? null,
      title: asset.title,
      storage_path: destPath,
      file_name: fileName,
      version: `${asset.current_version}.0`,
      note: personalised
        ? [parsed.data.note, `Personalised for ${org.name}.`].filter(Boolean).join(' ')
        : parsed.data.note ?? null,
      issued_by: ctx.userId,
    });
    if (insError) {
      failures.push(`${asset.ref}: record failed`);
      continue;
    }
    issued++;
  }

  if (issued > 0) {
    if (ownerProfile?.email) {
      const tpl = documentsIssuedEmail(org.name, issued);
      void sendEmail({ to: ownerProfile.email, subject: tpl.subject, html: tpl.html });
    }
    await admin.from('activity_log').insert({
      org_id: org.id,
      actor_id: ctx.userId,
      action: 'documents.issued',
      entity: 'client_documents',
      meta: { count: issued },
    });
  }

  revalidatePath('/admin/library');
  revalidatePath('/admin/customers');
  if (parsed.data.auditId) {
    revalidatePath(`/admin/audits/${parsed.data.auditId}`);
  }
  if (failures.length) {
    return { ok: issued > 0, error: `${issued} issued; problems: ${failures.join('; ')}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Report generation & publishing
// ---------------------------------------------------------------------------
export async function generateReport(auditId: string): Promise<ActionResult> {
  await requireAdminSession();
  const admin = createAdminClient();

  const [
    { data: audit },
    { data: areas },
    { data: libraryAreas },
    { data: findings },
    { data: items },
    { data: safResponses },
    { data: safQuestions },
  ] = await Promise.all([
    admin.from('audits').select('*').eq('id', auditId).single<Audit>(),
    admin.from('audit_areas').select('*').eq('audit_id', auditId),
    admin.from('library_areas').select('*').order('sort'),
    admin.from('audit_findings').select('*').eq('audit_id', auditId).order('sort'),
    admin.from('audit_items').select('requirement, status').eq('audit_id', auditId),
    admin.from('saf_responses').select('question_id, answer').eq('audit_id', auditId),
    admin.from('saf_questions').select('id, domain, priority'),
  ]);
  if (!audit) return fail('Audit not found.');

  const { data: org } = await admin
    .from('organisations')
    .select('*')
    .eq('id', audit.org_id)
    .single<Organisation>();
  if (!org) return fail('Organisation not found.');

  // One computation feeds the stored score, the cap note, the halves line and
  // the five-key-questions section — so the PDF can never disagree with itself.
  const breakdown = computeScoreBreakdown(
    (items as Pick<AuditItem, 'requirement' | 'status'>[]) ?? [],
    (safResponses as Pick<SafResponse, 'question_id' | 'answer'>[]) ?? [],
    (safQuestions as Pick<SafQuestion, 'id' | 'priority'>[]) ?? [],
  );
  const score = breakdown.score;
  await admin.from('audits').update({ score }).eq('id', auditId);

  const domainScores = safDomainScores(
    (safResponses as Pick<SafResponse, 'question_id' | 'answer'>[]) ?? [],
    (safQuestions as Pick<SafQuestion, 'id' | 'domain' | 'priority'>[]) ?? [],
  );

  // Evidence-verification pass — powers the report's Scope/Methodology/Evidence
  // Reviewed sections and the policy-vs-record gap accounting. Non-fatal: if it
  // fails for any reason the report still generates without it.
  let verification = null;
  try {
    verification = await verifyOrgEvidence(audit.org_id);
  } catch (e) {
    console.error('[report] verification failed, continuing without it', e);
  }

  // File-sampling reviews, joined to their file names for the report's
  // file-sampling section (only reviewed samples reach the PDF).
  const { data: samples } = await admin
    .from('file_samples')
    .select('sample_type, verdict, area_code, findings, evidence:evidence_files(file_name)')
    .eq('audit_id', auditId);
  const fileSamples = ((samples as unknown as SampleJoin[]) ?? []).map((s) => ({
    fileName: s.evidence?.file_name ?? 'Sampled file',
    areaCode: s.area_code,
    sampleType: s.sample_type,
    verdict: s.verdict,
    findings: s.findings,
  }));

  const pdf = await renderAuditReportPdf({
    audit,
    organisation: org,
    areas: (areas as AuditArea[]) ?? [],
    libraryAreas: (libraryAreas as LibraryArea[]) ?? [],
    findings: (findings as AuditFinding[]) ?? [],
    score,
    domainScores,
    breakdown,
    verification,
    fileSamples,
  });

  const { data: prev } = await admin
    .from('reports')
    .select('version')
    .eq('audit_id', auditId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>();
  const version = (prev?.version ?? 0) + 1;

  const path = `${org.id}/${auditId}/readiness-report-v${version}.pdf`;
  const { error: upError } = await admin.storage
    .from('reports')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (upError) return fail(`Could not store the report: ${upError.message}`);

  const { error: insError } = await admin.from('reports').insert({
    audit_id: auditId,
    org_id: org.id,
    storage_path: path,
    score,
    version,
  });
  if (insError) return fail('Report stored but the record failed.');

  await admin
    .from('audits')
    .update({ status: 'report_draft' })
    .eq('id', auditId)
    .in('status', ['evidence', 'in_review']);

  revalidatePath(`/admin/audits/${auditId}`);
  return { ok: true };
}

export async function publishReport(reportId: string): Promise<ActionResult> {
  await requireAdminSession();
  const admin = createAdminClient();

  const { data: reportRow } = await admin
    .from('reports')
    .select('audit_id')
    .eq('id', reportId)
    .single<{ audit_id: string }>();
  if (!reportRow) return fail('Report not found.');

  const readiness = await checkAuditReadyToDeliver(reportRow.audit_id);
  if (!readiness.ready) {
    return fail(
      `Can't publish to the client yet — ${readiness.reason ?? 'the audit is not ready to deliver.'}`,
    );
  }

  const { data: report, error } = await admin
    .from('reports')
    .update({ published: true, issued_at: new Date().toISOString() })
    .eq('id', reportId)
    .select('audit_id, org_id, score')
    .single<{ audit_id: string; org_id: string; score: number }>();
  if (error || !report) return fail('Could not publish the report.');

  await admin
    .from('audits')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', report.audit_id);

  const { data: org } = await admin
    .from('organisations')
    .select('name, owner_id')
    .eq('id', report.org_id)
    .single<{ name: string; owner_id: string }>();
  if (org) {
    const { data: owner } = await admin
      .from('profiles')
      .select('email')
      .eq('id', org.owner_id)
      .single<{ email: string }>();
    if (owner?.email) {
      const tpl = reportPublishedEmail(org.name, report.score);
      void sendEmail({ to: owner.email, subject: tpl.subject, html: tpl.html });
    }
  }

  revalidatePath(`/admin/audits/${report.audit_id}`);
  revalidatePath('/admin/audits');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Requests, alerts, tasks
// ---------------------------------------------------------------------------
export async function updateRequestStatus(
  requestId: string,
  status: 'open' | 'in_review' | 'delivered' | 'closed',
): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: req, error } = await supabase
    .from('requests')
    .update({ status })
    .eq('id', requestId)
    .select('org_id, type')
    .single<{ org_id: string; type: string }>();
  if (error || !req) return fail('Could not update the request.');

  const admin = createAdminClient();
  const { data: org } = await admin
    .from('organisations')
    .select('name, owner_id')
    .eq('id', req.org_id)
    .single<{ name: string; owner_id: string }>();
  if (org) {
    const { data: owner } = await admin
      .from('profiles')
      .select('email')
      .eq('id', org.owner_id)
      .single<{ email: string }>();
    if (owner?.email) {
      const tpl = requestUpdateEmail(org.name, req.type, status.replace('_', ' '));
      void sendEmail({ to: owner.email, subject: tpl.subject, html: tpl.html });
    }
  }

  revalidatePath('/admin/requests');
  return { ok: true };
}

const alertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(5000),
  category: z.string().min(2).max(40),
  external_url: z.string().url().max(500).nullable().optional().or(z.literal('')),
  legislative: z.boolean().optional(),
  published: z.boolean(),
});

export async function upsertAlert(input: z.infer<typeof alertSchema>): Promise<ActionResult> {
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return fail('Please complete the alert title and body.');
  await requireAdminSession();

  const supabase = await createClient();

  if (parsed.data.id) {
    // Editing an existing alert (scraped OR manual): update the editable
    // fields, honour the published toggle, and preserve source_kind/published_at
    // so editing a scraped item doesn't rewrite its provenance.
    const { data: existing } = await supabase
      .from('alerts')
      .select('published_at')
      .eq('id', parsed.data.id)
      .single<{ published_at: string | null }>();
    const update: Record<string, unknown> = {
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      external_url: parsed.data.external_url || null,
      published: parsed.data.published,
    };
    if (parsed.data.legislative !== undefined) update.legislative = parsed.data.legislative;
    if (parsed.data.published) {
      update.approved_at = new Date().toISOString();
      update.published_at = existing?.published_at ?? new Date().toISOString();
    } else {
      // Un-publishing: pull it back to the review queue.
      update.approved_at = null;
    }
    const { error } = await supabase.from('alerts').update(update).eq('id', parsed.data.id);
    if (error) return fail('Could not update the alert.');
  } else {
    const now = new Date().toISOString();
    const { error } = await supabase.from('alerts').insert({
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      external_url: parsed.data.external_url || null,
      source_kind: 'manual',
      legislative: parsed.data.legislative ?? false,
      published: parsed.data.published,
      published_at: parsed.data.published ? now : null,
      approved_at: parsed.data.published ? now : null,
    });
    if (error) return fail('Could not create the alert.');
  }
  revalidatePath('/admin/alerts');
  revalidatePath('/dashboard/alerts');
  return { ok: true };
}

export async function publishAlert(alertId: string): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from('alerts')
    .select('id,published_at')
    .eq('id', alertId)
    .single<{ id: string; published_at: string | null }>();
  if (fetchError || !existing) return fail('Could not publish the alert.');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('alerts')
    .update({
      published: true,
      approved_at: now,
      published_at: existing.published_at ?? now,
    })
    .eq('id', alertId);
  if (error) return fail('Could not publish the alert.');

  revalidatePath('/admin/alerts');
  revalidatePath('/dashboard/alerts');
  return { ok: true };
}

export async function deleteAlert(alertId: string): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase.from('alerts').delete().eq('id', alertId);
  if (error) return fail('Could not delete the alert.');

  revalidatePath('/admin/alerts');
  revalidatePath('/dashboard/alerts');
  return { ok: true };
}

const pushAlertSchema = z.object({
  alertId: z.string().uuid(),
  scope: z.enum(['global', 'per_client']),
  title: z.string().min(3).max(300),
  description: z.string().max(2000).optional().or(z.literal('')),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a due date'),
});

/**
 * Push a legislation/regulatory alert to client calendars as a dated action.
 * The founder chooses each time:
 *   • global      → one calendar_events row (org_id null) every client sees.
 *   • per_client  → one row per client org, so each can act on it independently.
 * Idempotent: an existing event already pushed from this alert (matched by
 * alert_id + org) is updated, not duplicated.
 */
export async function pushAlertToCalendars(
  input: z.infer<typeof pushAlertSchema>,
): Promise<ActionResult & { pushed?: number }> {
  const parsed = pushAlertSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid push.');
  const ctx = await requireAdminSession();
  const admin = createAdminClient();

  const { data: alert } = await admin
    .from('alerts')
    .select('id, title, external_url')
    .eq('id', parsed.data.alertId)
    .single<{ id: string; title: string; external_url: string | null }>();
  if (!alert) return fail('Alert not found.');

  const description =
    (parsed.data.description || '').trim() ||
    `Regulatory update${alert.external_url ? ` — details: ${alert.external_url}` : ''}.`;

  // Which orgs to target.
  let orgIds: (string | null)[];
  if (parsed.data.scope === 'global') {
    orgIds = [null];
  } else {
    const { data: orgs } = await admin.from('organisations').select('id');
    orgIds = ((orgs as { id: string }[]) ?? []).map((o) => o.id);
    if (orgIds.length === 0) return fail('No client organisations to push to.');
  }

  let pushed = 0;
  for (const orgId of orgIds) {
    // De-dupe: has this alert already been pushed to this org?
    const existingQuery = admin
      .from('calendar_events')
      .select('id')
      .eq('alert_id', alert.id);
    const existing = orgId
      ? await existingQuery.eq('org_id', orgId).maybeSingle<{ id: string }>()
      : await existingQuery.is('org_id', null).maybeSingle<{ id: string }>();

    const row = {
      org_id: orgId,
      title: parsed.data.title,
      description,
      event_type: 'regulatory',
      due_date: parsed.data.due_date,
      source: 'alert',
      alert_id: alert.id,
      created_by: ctx.userId,
    };

    if (existing.data?.id) {
      await admin.from('calendar_events').update(row).eq('id', existing.data.id);
    } else {
      const { error } = await admin.from('calendar_events').insert(row);
      if (error) continue;
    }
    pushed += 1;
  }

  revalidatePath('/admin/alerts');
  revalidatePath('/dashboard/calendar');
  return { ok: true, pushed };
}

/** Manually run the regulatory feed sync now (admin "Fetch updates" button). */
export async function runAlertsSyncNow(): Promise<ActionResult & { staged?: number }> {
  await requireAdminSession();
  try {
    const { syncCqcAlerts } = await import('@/lib/alerts/cqc-scrape');
    const result = await syncCqcAlerts({ notifyAdmins: false });
    revalidatePath('/admin/alerts');
    return { ok: true, staged: result.staged };
  } catch (e) {
    console.error('[alerts] manual sync failed', e);
    return fail('Could not fetch updates — try again.');
  }
}

const taskSchema = z.object({
  title: z.string().min(3).max(300),
  detail: z.string().max(2000).optional().or(z.literal('')),
  kind: z.string().max(40).default('admin'),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().max(10).optional().or(z.literal('')),
  org_id: z.string().uuid().nullable().optional(),
});

export async function createTask(input: z.infer<typeof taskSchema>): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return fail('Please give the task a title.');
  await requireAdminSession();

  const supabase = await createClient();
  const { error } = await supabase.from('tasks').insert({
    title: parsed.data.title,
    detail: parsed.data.detail || null,
    kind: parsed.data.kind,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date || null,
    org_id: parsed.data.org_id ?? null,
  });
  if (error) return fail('Could not create the task.');
  revalidatePath('/admin/tasks');
  return { ok: true };
}

export async function toggleTask(taskId: string, completed: boolean): Promise<ActionResult> {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase.from('tasks').update({ completed }).eq('id', taskId);
  if (error) return fail('Could not update the task.');
  revalidatePath('/admin/tasks');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Calendar (admin creates client + global events)
// ---------------------------------------------------------------------------
const calendarSchema = z.object({
  org_id: z.string().uuid().nullable(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  event_type: z.string().max(30).default('review'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function quarterBounds(dateKeyValue: string): { start: string; end: string } {
  const date = new Date(`${dateKeyValue}T00:00:00`);
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  const start = new Date(date.getFullYear(), quarterStartMonth, 1);
  const end = new Date(date.getFullYear(), quarterStartMonth + 3, 0);
  return { start: dateKey(start), end: dateKey(end) };
}

export async function createCalendarEvent(input: z.infer<typeof calendarSchema>): Promise<ActionResult> {
  const parsed = calendarSchema.safeParse(input);
  if (!parsed.success) return fail('Please complete the event details.');
  const ctx = await requireAdminSession();

  const supabase = await createClient();
  if (parsed.data.event_type === 'site_visit') {
    if (!parsed.data.org_id) return fail('Choose a client before setting a site visit.');
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status, created_at')
      .eq('org_id', parsed.data.org_id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ plan: string; status: string; created_at: string }>();
    const allowed = siteVisitQuotaForPlan(subscription?.plan as PlanId | undefined);
    if (allowed <= 0) return fail('This plan does not include site visits.');

    const { start, end } = quarterBounds(parsed.data.due_date);
    const { count } = await supabase
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', parsed.data.org_id)
      .eq('event_type', 'site_visit')
      .gte('due_date', start)
      .lte('due_date', end);

    if ((count ?? 0) >= allowed) {
      return fail(`This client already has ${allowed} site visit${allowed === 1 ? '' : 's'} scheduled for that quarter.`);
    }
  }

  const { error } = await supabase.from('calendar_events').insert({
    org_id: parsed.data.org_id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    event_type: parsed.data.event_type,
    due_date: parsed.data.due_date,
    created_by: ctx.userId,
  });
  if (error) return fail('Could not create the event.');
  revalidatePath('/admin');
  revalidatePath('/dashboard/calendar');
  return { ok: true };
}
