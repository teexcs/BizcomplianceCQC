import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type {
  Audit,
  AuditArea,
  AuditFinding,
  LibraryArea,
  Organisation,
  RagStatus,
} from '@/types/database';
import {
  FINDING_PRIORITY_LABELS,
  type SafDomainScore,
  type ScoreBreakdown,
} from '@/lib/audit/scoring';
import type { VerificationResult } from '@/lib/audit/verification';

const COLORS = {
  ink: '#111722',
  navy: '#111a2c',
  gold: '#b8934a',
  muted: '#5c6472',
  line: '#e3ddcf',
  green: '#1a7f4e',
  amber: '#a96c00',
  red: '#b63b31',
  cream: '#f7f3ea',
};

const RAG_LABEL: Record<RagStatus, string> = {
  green: 'GREEN',
  amber: 'AMBER',
  red: 'RED',
  unset: '—',
};

const RAG_COLOR: Record<RagStatus, string> = {
  green: COLORS.green,
  amber: COLORS.amber,
  red: COLORS.red,
  unset: COLORS.muted,
};

const SAMPLE_VERDICT_LABEL: Record<ReportFileSample['verdict'], string> = {
  unset: '—',
  compliant: 'Compliant',
  partial: 'Partial',
  not_compliant: 'Not compliant',
  not_applicable: 'N/A',
};

const SAMPLE_COLOR: Record<ReportFileSample['verdict'], string> = {
  unset: COLORS.muted,
  compliant: COLORS.green,
  partial: COLORS.amber,
  not_compliant: COLORS.red,
  not_applicable: COLORS.muted,
};

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: COLORS.ink, fontFamily: 'Helvetica' },
  headerBar: {
    backgroundColor: COLORS.navy,
    margin: -48,
    marginBottom: 24,
    padding: 48,
    paddingTop: 40,
    paddingBottom: 32,
  },
  brand: { color: COLORS.gold, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  brandSub: { color: '#8b93a3', fontSize: 9, marginTop: 2 },
  title: { color: '#ffffff', fontSize: 22, fontFamily: 'Helvetica-Bold', marginTop: 18 },
  subtitle: { color: '#c9cfda', fontSize: 11, marginTop: 6 },
  scoreRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  scoreBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 6,
    padding: 14,
    backgroundColor: COLORS.cream,
  },
  scoreNum: { fontSize: 26, fontFamily: 'Helvetica-Bold' },
  scoreLabel: { fontSize: 8, color: COLORS.muted, marginTop: 4, textTransform: 'uppercase' },
  h2: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 18,
    marginBottom: 8,
    color: COLORS.navy,
  },
  para: { lineHeight: 1.55, color: '#333a47', marginBottom: 8 },
  areaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingVertical: 6,
    alignItems: 'center',
  },
  areaName: { flex: 1, paddingRight: 8 },
  rag: { width: 52, fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'right' },
  findingCard: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  findingHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  findingTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, flex: 1, paddingRight: 8 },
  findingPriority: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.navy },
  findingDetail: { color: '#333a47', lineHeight: 1.5, marginBottom: 3 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.muted,
  },
});

function cleanText(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function cleanRag(value: unknown): RagStatus {
  return value === 'green' || value === 'amber' || value === 'red' || value === 'unset'
    ? value
    : 'unset';
}

function ReportFooter({ organisationName }: { organisationName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>BizCompliance - CQC Readiness Audit - {organisationName}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export interface ReportData {
  audit: Audit;
  organisation: Organisation;
  areas: AuditArea[];
  libraryAreas: LibraryArea[];
  findings: AuditFinding[];
  score: number;
  /** The five key questions (SAF) scored per domain; null scores = not assessed. */
  domainScores?: SafDomainScore[];
  /** Full harsh-marking breakdown — drives the cap note and halves line. */
  breakdown?: ScoreBreakdown | null;
  /** Evidence-verification pass — powers Evidence Reviewed + policy-only gaps. */
  verification?: VerificationResult | null;
  /** Files sampled in depth by the auditor, with verdict + findings. */
  fileSamples?: ReportFileSample[];
}

export interface ReportFileSample {
  fileName: string;
  areaCode: string | null;
  sampleType: string;
  verdict: 'unset' | 'compliant' | 'partial' | 'not_compliant' | 'not_applicable';
  findings: string | null;
}

function ReportDoc({ data }: { data: ReportData }) {
  const { organisation, areas, libraryAreas, findings, score, audit, domainScores, breakdown, verification, fileSamples } =
    data;
  const samples = (fileSamples ?? []).filter((s) => s.verdict !== 'unset');
  const areaName = new Map(libraryAreas.map((a) => [cleanText(a.code), cleanText(a.name, a.code)]));
  const counts = {
    green: areas.filter((a) => a.rag === 'green').length,
    amber: areas.filter((a) => a.rag === 'amber').length,
    red: areas.filter((a) => a.rag === 'red').length,
  };
  const openFindings = findings.filter((f) => f.status === 'open');

  // Strengths — areas that are fully compliant and, where verification ran,
  // fully backed by records. Named, so the report is balanced, not just gaps.
  const strengths: string[] = (() => {
    const out: string[] = [];
    const greenAreas = [...areas]
      .filter((a) => a.rag === 'green')
      .sort((a, b) => a.area_code.localeCompare(b.area_code));
    for (const a of greenAreas.slice(0, 6)) {
      out.push(`${cleanText(a.area_code)} ${areaName.get(a.area_code) ?? cleanText(a.area_code)} - compliant, no gaps identified.`);
    }
    if (verification) {
      const fully = verification.areas.filter(
        (a) => a.items.length > 0 && a.verified === a.items.length,
      );
      if (fully.length > 0) {
        out.push(
          `${fully.length} area${fully.length === 1 ? '' : 's'} fully evidenced — every expected record was supplied and verified.`,
        );
      }
    }
    if (out.length === 0 && score >= 60) {
      out.push('A substantial documentation base is in place to build on.');
    }
    return out;
  })();

  const issued = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const organisationName = cleanText(organisation.name);

  return (
    <Document
      title={`CQC Readiness Audit - ${organisationName}`}
      author="BizCompliance"
      subject="CQC readiness audit report"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.brand}>BizCompliance</Text>
          <Text style={styles.brandSub}>CQC compliance, handled properly</Text>
          <Text style={styles.title}>CQC Readiness Audit</Text>
          <Text style={styles.subtitle}>
            {organisationName} - {issued}
          </Text>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreNum}>{score}/100</Text>
            <Text style={styles.scoreLabel}>Readiness score</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, { color: COLORS.green }]}>{counts.green}</Text>
            <Text style={styles.scoreLabel}>Compliant areas</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, { color: COLORS.amber }]}>{counts.amber}</Text>
            <Text style={styles.scoreLabel}>Needs improvement</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, { color: COLORS.red }]}>{counts.red}</Text>
            <Text style={styles.scoreLabel}>Critical gaps</Text>
          </View>
        </View>

        {breakdown?.legalWarning ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: COLORS.red,
              borderRadius: 6,
              padding: 10,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: COLORS.red, marginBottom: 2 }}>
              Legally-required gaps
            </Text>
            <Text style={{ fontSize: 9, color: '#333a47', lineHeight: 1.5 }}>
              {breakdown.legalWarning}
            </Text>
          </View>
        ) : null}

        {breakdown ? (
          <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 14 }}>
            Score composition: documents &amp; evidence {Math.round(breakdown.doc.scored * 100)}/100
            ({Math.round(breakdown.docShare * 100)}% weight) · SAF inspection interview{' '}
            {breakdown.saf.answered > 0 ? `${Math.round(breakdown.saf.scored * 100)}/100` : 'not assessed'}{' '}
            ({Math.round(breakdown.safShare * 100)}% weight). Legally-required items weigh ×3;
            out-of-date documents earn 25% credit; priority interview questions weigh ×3.
          </Text>
        ) : null}

        {audit.summary ? (
          <View>
            <Text style={styles.h2}>Executive summary</Text>
            <Text style={styles.para}>{cleanText(audit.summary)}</Text>
          </View>
        ) : null}

        {domainScores && domainScores.length > 0 ? (
          <View>
            <Text style={styles.h2}>The five key questions (CQC Single Assessment Framework)</Text>
            {domainScores.map((d) => (
              <View key={d.domain} style={styles.areaRow} wrap={false}>
                <Text style={styles.areaName}>{cleanText(d.label, d.domain)}</Text>
                <View
                  style={{
                    width: 160,
                    height: 6,
                    backgroundColor: '#e9e4d8',
                    borderRadius: 3,
                    marginRight: 10,
                  }}
                >
                  <View
                    style={{
                      width: d.score != null ? `${Math.min(100, d.score * 10)}%` : '0%',
                      height: 6,
                      borderRadius: 3,
                      backgroundColor:
                        d.score == null
                          ? '#e9e4d8'
                          : d.score >= 7.5
                            ? COLORS.green
                            : d.score >= 5
                              ? COLORS.amber
                              : COLORS.red,
                    }}
                  />
                </View>
                <Text style={[styles.rag, { color: COLORS.ink, width: 80 }]}>
                  {d.score != null ? `${d.score.toFixed(1)}/10` : 'Not assessed'}
                  {d.priorityFails > 0 ? `  (${d.priorityFails}★ fail${d.priorityFails === 1 ? '' : 's'})` : ''}
                </Text>
              </View>
            ))}
            <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 4, marginBottom: 6 }}>
              Scored from the {breakdown?.saf.total ?? 68}-question SAF interview. ★ marks
              priority questions — the rapid-triage questions an inspection turns on.
            </Text>
          </View>
        ) : null}

        <Text style={styles.h2}>Compliance area assessment</Text>
        {[...areas]
          .sort((a, b) => a.area_code.localeCompare(b.area_code))
          .map((area) => (
            <View key={area.id} style={styles.areaRow} wrap={false}>
              <Text style={styles.areaName}>
                {cleanText(area.area_code)} {areaName.get(area.area_code) ?? cleanText(area.area_code)}
              </Text>
              <Text style={[styles.rag, { color: RAG_COLOR[cleanRag(area.rag)] }]}>
                {RAG_LABEL[cleanRag(area.rag)]}
              </Text>
            </View>
          ))}
        <ReportFooter organisationName={organisationName} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Scope of review</Text>
        <Text style={styles.para}>
          This is an independent documentation and inspection-readiness review of {organisationName}
          {' '}against the Health and Social Care Act 2008 (Regulated Activities) Regulations 2014,
          the Fundamental Standards, and the CQC Single Assessment Framework. It covers the 18
          compliance areas relevant to a domiciliary care service: registration, safeguarding,
          consent and mental capacity, safe care and risk, lone working, medicines, care planning,
          complaints, duty of candour, governance, staffing and training, safe recruitment, data
          protection, health and safety, infection prevention, statutory notifications, business
          continuity, and dignity and rights.
        </Text>

        <Text style={styles.h2}>Methodology</Text>
        <Text style={styles.para}>
          Every document supplied was read line by line against a rulebook of the regulatory
          signals an inspector looks for. Each finding is traceable to the exact text that proves,
          or fails to prove, the point — the review does not infer compliance that is not written
          down. Beyond reading policies, the review verifies whether each policy is backed by the
          supporting record that shows it is lived in practice (for example, a training matrix
          behind a training policy, or MAR charts behind a medicines policy). Where the policy is
          present but the corroborating record was not supplied, the item is reported as
          &quot;policy only, not yet verified&quot; rather than as compliant.
        </Text>

        {verification ? (
          <View>
            <Text style={styles.h2}>Evidence reviewed &amp; verification</Text>
            <Text style={styles.para}>
              Of {verification.totals.items} expected evidence items across the 18 areas,{' '}
              {verification.totals.verified} were verified by a supporting record,{' '}
              {verification.totals.policyOnly} were policy-only (the policy exists but the proving
              record was not supplied), and {verification.totals.absent} were not supplied.{' '}
              {verification.totals.criticalGaps > 0
                ? `${verification.totals.criticalGaps} essential item${verification.totals.criticalGaps === 1 ? '' : 's'} remain${verification.totals.criticalGaps === 1 ? 's' : ''} unverified and ${verification.totals.criticalGaps === 1 ? 'is' : 'are'} reflected in the ratings and action plan.`
                : 'All essential items were verified.'}
            </Text>
            {verification.areas
              .filter((a) => a.items.length > 0)
              .map((a) => (
                <View key={a.code} style={styles.areaRow} wrap={false}>
                  <Text style={styles.areaName}>
                    {cleanText(a.code)} {cleanText(a.area)}
                  </Text>
                  <Text style={{ fontSize: 9, color: COLORS.muted, width: 150, textAlign: 'right' }}>
                    {a.verified}/{a.items.length} verified
                    {a.criticalGaps > 0 ? ` · ${a.criticalGaps} essential gap${a.criticalGaps === 1 ? '' : 's'}` : ''}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}

        {samples.length > 0 ? (
          <View>
            <Text style={styles.h2}>File sampling</Text>
            <Text style={styles.para}>
              {samples.length} individual record{samples.length === 1 ? ' was' : 's were'} examined in
              depth for completeness, consistency and regulatory alignment. Verdicts and findings:
            </Text>
            {samples.map((s, i) => (
              <View key={i} style={{ marginBottom: 8 }} wrap={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5 }}>
                      {cleanText(s.fileName, 'Sampled file')}
                    </Text>
                    {s.areaCode ? (
                      <Text style={{ fontSize: 8, color: COLORS.muted }}>
                        Area {cleanText(s.areaCode)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: SAMPLE_COLOR[s.verdict] ?? COLORS.muted }}>
                    {SAMPLE_VERDICT_LABEL[s.verdict] ?? cleanText(s.verdict)}
                  </Text>
                </View>
                {s.findings ? (
                  <Text style={styles.findingDetail}>{cleanText(s.findings)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {strengths.length > 0 ? (
          <View>
            <Text style={styles.h2}>Strengths</Text>
            {strengths.map((s, i) => (
              <Text key={i} style={styles.findingDetail}>
                • {s}
              </Text>
            ))}
          </View>
        ) : null}
        <ReportFooter organisationName={organisationName} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Priority action plan</Text>
        <Text style={styles.para}>
          Actions are ordered by urgency. “Fix first” items relate to legally required documents or
          critical safety evidence and should be addressed before anything else.
        </Text>
        {openFindings.length === 0 ? (
          <Text style={styles.para}>No open findings — maintain current arrangements.</Text>
        ) : (
          openFindings.map((f) => (
            <View key={f.id} style={styles.findingCard} wrap={false}>
              <View style={styles.findingHead}>
                <Text style={[styles.findingTitle, { color: RAG_COLOR[cleanRag(f.severity)] }]}>
                  {cleanText(f.title, 'Untitled finding')}
                </Text>
                <Text style={styles.findingPriority}>
                  {FINDING_PRIORITY_LABELS[f.priority] ?? cleanText(f.priority)}
                </Text>
              </View>
              {f.area_code ? (
                <Text style={{ fontSize: 8, color: COLORS.muted, marginBottom: 3 }}>
                  Area {cleanText(f.area_code)} - {areaName.get(f.area_code) ?? ''}
                </Text>
              ) : null}
              {f.detail ? <Text style={styles.findingDetail}>{cleanText(f.detail)}</Text> : null}
              {f.recommendation ? (
                <Text style={styles.findingDetail}>Recommendation: {cleanText(f.recommendation)}</Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={styles.h2}>Area notes</Text>
        {[...areas]
          .sort((a, b) => a.area_code.localeCompare(b.area_code))
          .filter((a) => a.findings || a.action || a.evidence_sighted)
          .map((area) => (
            <View key={area.id} style={{ marginBottom: 10 }} wrap={false}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                {cleanText(area.area_code)} {areaName.get(area.area_code) ?? ''} - {RAG_LABEL[cleanRag(area.rag)]}
              </Text>
              {area.evidence_sighted ? (
                <Text style={styles.findingDetail}>Evidence sighted: {cleanText(area.evidence_sighted)}</Text>
              ) : null}
              {area.findings ? (
                <Text style={styles.findingDetail}>Findings: {cleanText(area.findings)}</Text>
              ) : null}
              {area.action ? (
                <Text style={styles.findingDetail}>
                  Action: {cleanText(area.action)}
                  {area.owner ? ` (Owner: ${cleanText(area.owner)})` : ''}
                </Text>
              ) : null}
            </View>
          ))}

        <Text style={styles.h2}>Basis, limitations & disclaimer</Text>
        <Text style={[styles.para, { fontSize: 8.5, color: COLORS.muted }]}>
          This is an independent documentation and inspection-readiness review, assessed against the
          Health and Social Care Act 2008 (Regulated Activities) Regulations 2014, the Fundamental
          Standards, and the CQC Single Assessment Framework. BizCompliance is not the Care Quality
          Commission and is not affiliated with it; this review is not an inspection and does not
          guarantee any inspection rating or outcome. Findings are based only on the documents and
          records supplied for review — items not supplied are reported as gaps and may not reflect
          arrangements that exist but were not provided. Verification confirms whether a supporting
          record was supplied; it is not a legal opinion on the adequacy of each procedure. The
          registered provider and registered manager remain fully accountable for compliance with
          the law and for the accuracy and completeness of the evidence submitted. This report is
          issued as an editable readiness toolset to support your own quality assurance.
        </Text>
        <ReportFooter organisationName={organisationName} />
      </Page>
    </Document>
  );
}

export async function renderAuditReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDoc data={data} />);
}

function FallbackReportDoc({ data }: { data: ReportData }) {
  const organisationName = cleanText(data.organisation.name, 'Client');
  const issued = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const areaName = new Map(
    data.libraryAreas.map((a) => [cleanText(a.code), cleanText(a.name, a.code)]),
  );
  const areas = [...data.areas].sort((a, b) =>
    cleanText(a.area_code).localeCompare(cleanText(b.area_code)),
  );
  const openFindings = data.findings.filter((f) => cleanText(f.status) === 'open');
  const samples = (data.fileSamples ?? []).filter((s) => cleanText(s.verdict) !== 'unset');

  return (
    <Document
      title={`CQC Readiness Audit - ${organisationName}`}
      author="BizCompliance"
      subject="CQC readiness audit report"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.brand}>BizCompliance</Text>
          <Text style={styles.brandSub}>CQC compliance, handled properly</Text>
          <Text style={styles.title}>CQC Readiness Audit</Text>
          <Text style={styles.subtitle}>
            {organisationName} - {issued}
          </Text>
        </View>

        <Text style={styles.h2}>Readiness position</Text>
        <Text style={styles.para}>Readiness score: {data.score}/100</Text>
        {data.audit.summary ? (
          <Text style={styles.para}>{cleanText(data.audit.summary)}</Text>
        ) : (
          <Text style={styles.para}>
            This report summarises the audit areas, findings and sampled evidence reviewed by
            BizCompliance.
          </Text>
        )}
        {data.breakdown?.legalWarning ? (
          <Text style={[styles.findingDetail, { color: COLORS.red }]}>
            {cleanText(data.breakdown.legalWarning)}
          </Text>
        ) : null}

        <Text style={styles.h2}>Compliance area assessment</Text>
        {areas.length > 0 ? (
          areas.map((area) => {
            const rag = cleanRag(area.rag);
            return (
              <View key={area.id} style={styles.areaRow} wrap={false}>
                <Text style={styles.areaName}>
                  {cleanText(area.area_code)} {areaName.get(cleanText(area.area_code)) ?? ''}
                </Text>
                <Text style={[styles.rag, { color: RAG_COLOR[rag] }]}>{RAG_LABEL[rag]}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.para}>No audit areas were available for this report.</Text>
        )}

        <Text style={styles.h2}>Priority findings</Text>
        {openFindings.length > 0 ? (
          openFindings.map((finding) => (
            <View key={finding.id} style={styles.findingCard} wrap={false}>
              <Text style={styles.findingTitle}>
                {cleanText(finding.title, 'Untitled finding')}
              </Text>
              {finding.area_code ? (
                <Text style={styles.findingDetail}>Area: {cleanText(finding.area_code)}</Text>
              ) : null}
              {finding.detail ? (
                <Text style={styles.findingDetail}>{cleanText(finding.detail)}</Text>
              ) : null}
              {finding.recommendation ? (
                <Text style={styles.findingDetail}>
                  Recommendation: {cleanText(finding.recommendation)}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.para}>No open findings were recorded.</Text>
        )}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>File sampling</Text>
        {samples.length > 0 ? (
          samples.map((sample, index) => (
            <View key={`${cleanText(sample.fileName, 'sample')}-${index}`} style={styles.findingCard} wrap={false}>
              <Text style={styles.findingTitle}>{cleanText(sample.fileName, 'Sampled file')}</Text>
              <Text style={styles.findingDetail}>
                Verdict: {SAMPLE_VERDICT_LABEL[cleanText(sample.verdict) as ReportFileSample['verdict']] ?? cleanText(sample.verdict)}
              </Text>
              {sample.areaCode ? (
                <Text style={styles.findingDetail}>Area: {cleanText(sample.areaCode)}</Text>
              ) : null}
              {sample.findings ? (
                <Text style={styles.findingDetail}>{cleanText(sample.findings)}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.para}>No reviewed file samples were recorded.</Text>
        )}

        <Text style={styles.h2}>Scope and limitations</Text>
        <Text style={[styles.para, { fontSize: 8.5, color: COLORS.muted }]}>
          This is an independent documentation and inspection-readiness review. BizCompliance is
          not the Care Quality Commission and is not affiliated with it. This review is not an
          inspection and does not guarantee any inspection rating or outcome. Findings are based
          only on the documents and records supplied for review.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderFallbackAuditReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<FallbackReportDoc data={data} />);
}
