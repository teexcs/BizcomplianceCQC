import 'server-only';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import {
  computeScoreBreakdown,
  safDomainScores,
} from '@/lib/audit/scoring';
import { renderAuditReportPdf, renderFallbackAuditReportPdf } from '@/lib/report/generate';
import { verifyOrgEvidence, getEvidenceProof, getExecutionProof } from '@/lib/engine/reader/adapter';
import type {
  Audit,
  AuditArea,
  AuditFinding,
  AuditItem,
  LibraryArea,
  Organisation,
  SafQuestion,
  SafResponse,
} from '@/types/database';

export interface ReportGenerationResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: string): ReportGenerationResult {
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

export async function generateAuditReport(auditId: string): Promise<ReportGenerationResult> {
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
  // the five-key-questions section, so the PDF can never disagree with itself.
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

  let verification = null;
  try {
    verification = await verifyOrgEvidence(audit.org_id);
  } catch (e) {
    console.error('[report] verification failed, continuing without it', e);
  }

  let evidenceProof = null;
  let executionProof = null;
  try {
    [evidenceProof, executionProof] = await Promise.all([
      getEvidenceProof(audit.org_id),
      getExecutionProof(audit.org_id),
    ]);
  } catch (e) {
    console.error('[report] evidence proof failed, continuing without it', e);
  }

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

  const reportData = {
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
    evidenceProof,
    executionProof,
    signOff: audit.signed_off_at
      ? {
          name: audit.sign_off_name ?? 'BizCompliance CQC auditor',
          at: audit.signed_off_at,
          statement: audit.sign_off_statement,
        }
      : null,
  };

  let pdf: Buffer;
  try {
    pdf = await renderAuditReportPdf(reportData);
  } catch (e) {
    console.error('[report] PDF render failed', e);
    try {
      pdf = await renderFallbackAuditReportPdf(reportData);
    } catch (fallbackError) {
      console.error('[report] fallback PDF render failed', fallbackError);
      return fail('Could not generate the report PDF. Check the audit text fields and try again.');
    }
  }

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
