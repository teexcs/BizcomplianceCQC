/**
 * Proof the report PDF renders with the new Scope/Methodology/Evidence
 * Reviewed/Strengths/disclaimer sections + a real verification result.
 *   npx tsx scripts/report-render-test.mts
 */
import { renderAuditReportPdf, type ReportData } from '@/lib/report/generate';
import { verifyEvidence, type VerifiableFile } from '@/lib/audit/verification';
import { writeFileSync } from 'node:fs';

const files: VerifiableFile[] = [
  { id: 'f1', fileName: 'Safeguarding Adults Policy.docx', text: 'Regulation 13. Types of abuse. s.42 referral. Whistleblowing.', areaCode: '02' },
  { id: 'f2', fileName: 'Training Matrix 2026.xlsx', text: 'Course Due Completed Expiry', areaCode: '11' },
  { id: 'f3', fileName: 'Medicines Management Policy.docx', text: 'Safe management of medicines. MAR. PRN.', areaCode: '06' },
  // Note: no MAR sample supplied for Medicines → should be policy_only.
];
const verification = verifyEvidence(files);

const now = new Date().toISOString();
const data: ReportData = {
  audit: {
    id: 'a1', org_id: 'o1', status: 'report_draft', score: 82, summary:
      'A strong documentation base with targeted gaps in evidenced practice.',
    created_at: now, updated_at: now,
  } as unknown as ReportData['audit'],
  organisation: { id: 'o1', name: 'Test Domiciliary Care Ltd' } as unknown as ReportData['organisation'],
  areas: [
    { id: 'ar1', audit_id: 'a1', area_code: '02', rag: 'green' },
    { id: 'ar2', audit_id: 'a1', area_code: '06', rag: 'amber' },
    { id: 'ar3', audit_id: 'a1', area_code: '11', rag: 'green' },
  ] as unknown as ReportData['areas'],
  libraryAreas: [
    { code: '02', name: 'Safeguarding Adults' },
    { code: '06', name: 'Medicines Management' },
    { code: '11', name: 'Staffing, Training & Supervision' },
  ] as unknown as ReportData['libraryAreas'],
  findings: [
    { id: 'fd1', status: 'open', title: 'MAR sample not supplied', severity: 'amber', priority: 'days_14', area_code: '06', detail: 'Policy present; administration records not provided.', recommendation: 'Supply recent MAR charts.' },
  ] as unknown as ReportData['findings'],
  score: 82,
  domainScores: [
    { domain: 'safe', label: 'Safe', score: 8.1, answered: 10, total: 12, priorityFails: 0 },
    { domain: 'effective', label: 'Effective', score: 6.4, answered: 8, total: 10, priorityFails: 1 },
    { domain: 'caring', label: 'Caring', score: null, answered: 0, total: 8, priorityFails: 0 },
    { domain: 'responsive', label: 'Responsive', score: 7.9, answered: 6, total: 8, priorityFails: 0 },
    { domain: 'well_led', label: 'Well-led', score: 5.2, answered: 9, total: 14, priorityFails: 2 },
  ],
  breakdown: {
    score: 82, legalWarning: null,
    doc: { scored: 0.85, answered: 40, total: 46, legalMissing: 0, missing: 4, outOfDate: 2 },
    saf: { scored: 0.72, answered: 33, total: 68, priorityFails: 3 },
    docShare: 0.6, safShare: 0.4,
  },
  verification,
};

const pdf = await renderAuditReportPdf(data);
const out = '/tmp/claude-501/-Users-tee-Downloads-bizcompliance-cqc/report-render-test.pdf';
writeFileSync(out, pdf);
console.log(`✅ PDF rendered: ${pdf.length} bytes -> ${out}`);
console.log(`   verification: ${verification.totals.verified} verified, ${verification.totals.policyOnly} policy-only, ${verification.totals.absent} absent, ${verification.totals.criticalGaps} essential gaps`);
if (pdf.length < 3000) { console.error('❌ PDF suspiciously small'); process.exit(1); }
