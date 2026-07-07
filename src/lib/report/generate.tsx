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
import { FINDING_PRIORITY_LABELS } from '@/lib/audit/scoring';

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

export interface ReportData {
  audit: Audit;
  organisation: Organisation;
  areas: AuditArea[];
  libraryAreas: LibraryArea[];
  findings: AuditFinding[];
  score: number;
}

function ReportDoc({ data }: { data: ReportData }) {
  const { organisation, areas, libraryAreas, findings, score, audit } = data;
  const areaName = new Map(libraryAreas.map((a) => [a.code, a.name]));
  const counts = {
    green: areas.filter((a) => a.rag === 'green').length,
    amber: areas.filter((a) => a.rag === 'amber').length,
    red: areas.filter((a) => a.rag === 'red').length,
  };
  const openFindings = findings.filter((f) => f.status === 'open');
  const issued = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const footer = (
    <View style={styles.footer} fixed>
      <Text>BizCompliance — CQC Readiness Audit — {organisation.name}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );

  return (
    <Document
      title={`CQC Readiness Audit — ${organisation.name}`}
      author="BizCompliance"
      subject="CQC readiness audit report"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.brand}>BizCompliance</Text>
          <Text style={styles.brandSub}>CQC compliance, handled properly</Text>
          <Text style={styles.title}>CQC Readiness Audit</Text>
          <Text style={styles.subtitle}>
            {organisation.name} · {issued}
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

        {audit.summary ? (
          <View>
            <Text style={styles.h2}>Executive summary</Text>
            <Text style={styles.para}>{audit.summary}</Text>
          </View>
        ) : null}

        <Text style={styles.h2}>Compliance area assessment</Text>
        {[...areas]
          .sort((a, b) => a.area_code.localeCompare(b.area_code))
          .map((area) => (
            <View key={area.id} style={styles.areaRow} wrap={false}>
              <Text style={styles.areaName}>
                {area.area_code} {areaName.get(area.area_code) ?? area.area_code}
              </Text>
              <Text style={[styles.rag, { color: RAG_COLOR[area.rag] }]}>{RAG_LABEL[area.rag]}</Text>
            </View>
          ))}
        {footer}
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
                <Text style={[styles.findingTitle, { color: RAG_COLOR[f.severity] }]}>{f.title}</Text>
                <Text style={styles.findingPriority}>
                  {FINDING_PRIORITY_LABELS[f.priority] ?? f.priority}
                </Text>
              </View>
              {f.area_code ? (
                <Text style={{ fontSize: 8, color: COLORS.muted, marginBottom: 3 }}>
                  Area {f.area_code} — {areaName.get(f.area_code) ?? ''}
                </Text>
              ) : null}
              {f.detail ? <Text style={styles.findingDetail}>{f.detail}</Text> : null}
              {f.recommendation ? (
                <Text style={styles.findingDetail}>Recommendation: {f.recommendation}</Text>
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
                {area.area_code} {areaName.get(area.area_code) ?? ''} —{' '}
                <Text style={{ color: RAG_COLOR[area.rag] }}>{RAG_LABEL[area.rag]}</Text>
              </Text>
              {area.evidence_sighted ? (
                <Text style={styles.findingDetail}>Evidence sighted: {area.evidence_sighted}</Text>
              ) : null}
              {area.findings ? (
                <Text style={styles.findingDetail}>Findings: {area.findings}</Text>
              ) : null}
              {area.action ? (
                <Text style={styles.findingDetail}>
                  Action: {area.action}
                  {area.owner ? ` (Owner: ${area.owner})` : ''}
                </Text>
              ) : null}
            </View>
          ))}

        <Text style={[styles.para, { marginTop: 14, fontSize: 8, color: COLORS.muted }]}>
          This report is an editable documentation and readiness toolset. The registered provider and
          registered manager remain accountable for compliance with the law. Assessment framework:
          HSCA 2008 (Regulated Activities) Regulations 2014 and the CQC Single Assessment Framework.
        </Text>
        {footer}
      </Page>
    </Document>
  );
}

export async function renderAuditReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDoc data={data} />);
}
