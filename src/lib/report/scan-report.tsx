import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { createAdminClient } from '@/lib/supabase/server';
import { getScan, type ScanRecord } from '@/lib/scanner/run';
import { CATEGORY_LABELS, type CheckCategory, type CheckResult } from '@/lib/scanner/checks';

/**
 * The paid £8.99 Website Compliance Report.
 *
 * A client-facing, branded document: cover page, executive summary, prioritised
 * findings with "why it matters" context, an action plan, and next steps.
 * The language is always "assessment/review" — the mechanics of how the data
 * was gathered are never mentioned.
 */

const COLORS = {
  ink: '#111722',
  navy: '#15203a',
  navyDeep: '#0d1526',
  blue: '#3d63b8',
  blueSoft: '#8fb1ff',
  muted: '#5c6472',
  faint: '#9aa1ad',
  line: '#e4e6ea',
  wash: '#f4f6fa',
  green: '#1a7f4e',
  greenWash: '#e9f5ef',
  orange: '#c2410c',
  orangeWash: '#fdf1e8',
  red: '#b63b31',
  redWash: '#fbeeec',
  white: '#ffffff',
};

function band(score: number): { label: string; color: string; wash: string } {
  if (score >= 9) return { label: 'Compliant', color: COLORS.green, wash: COLORS.greenWash };
  if (score >= 6)
    return { label: 'Needs improvement', color: COLORS.orange, wash: COLORS.orangeWash };
  return { label: 'Critical', color: COLORS.red, wash: COLORS.redWash };
}

function scoreColor(score: number): string {
  return band(score).color;
}

/** Regulatory / commercial context per checkpoint — the "so what". */
const WHY_IT_MATTERS: Record<string, string> = {
  'privacy-policy':
    'A privacy notice is a legal requirement under UK GDPR for any organisation processing personal data. As a care provider you handle special-category health data, so the absence of one is a visible red flag to families, commissioners and the ICO alike.',
  terms:
    'Terms set out the basis on which you contract with the public. Without them, fee disputes and service misunderstandings have no written anchor, and your site looks less established than competitors.',
  complaints:
    'CQC Regulation 16 requires an accessible complaints system. Families and commissioners actively look for a published route to raise concerns — its absence undermines confidence and is easy for an inspector to notice.',
  accessibility:
    'Care audiences include people with visual, cognitive and motor impairments. An accessibility statement signals you take the Accessible Information Standard seriously — and its absence can put you at risk under the Equality Act 2010.',
  'cookie-consent':
    'Consent is required before setting non-essential cookies (PECR). Running analytics or marketing tags without a consent mechanism is one of the most commonly enforced website breaches in the UK.',
  'cookie-policy':
    'Visitors must be able to see what cookies you use and why. A missing cookie policy makes any consent you do collect uninformed — and therefore invalid.',
  'data-protection':
    'Care providers processing health data are legally required to be registered with the ICO. Displaying your data-protection commitments (and ICO registration) is a strong, expected trust signal.',
  'contact-details':
    'Families choosing care want a phone number and a monitored inbox before anything else. Missing contact details cost enquiries directly and reduce trust in every other page.',
  'physical-address':
    'A registered office address is a Companies Act requirement for limited companies, and its absence makes a care service look transient — the opposite of what a family wants to see.',
  'company-registration':
    'Companies Act 2006 s.82 requires limited companies to display their registered name, number and office. Non-compliance is an offence, and savvy commissioners check for it.',
  'cqc-registration':
    'Stating your CQC registration (with provider/location ID and a link to your profile) is the fastest way to prove legitimacy to families and professionals referring into your service.',
  'cqc-rating':
    'Displaying your most recent CQC rating on your website is a legal duty under Regulation 20A, with fixed financial penalties for non-compliance. This is the single most commonly missed legal requirement on care websites.',
  safeguarding:
    'A published safeguarding commitment — with a named lead and a route to raise concerns — reassures families and matches what commissioners and inspectors expect to see from a well-led service.',
  'registered-manager':
    'Naming your registered manager signals an accountable, well-led service and aligns your public presence with your Statement of Purpose.',
  https:
    'Unencrypted sites are flagged "Not secure" by every major browser, harming trust before a visitor reads a word. Any form submitted over HTTP exposes personal data in transit.',
  'https-redirect':
    'If the insecure http:// version of your site still loads, visitors and search engines can land on it. A permanent redirect closes this gap in seconds.',
  hsts:
    'HSTS tells browsers to only ever connect securely, protecting visitors on hostile networks. It is a low-effort, high-signal security hardening step.',
  'security-headers':
    'Security headers protect visitors against clickjacking and content-type attacks. Their absence signals weak technical governance to anyone who checks.',
  'mixed-content':
    'Insecure resources on a secure page cause browser warnings and can be blocked outright, breaking images or scripts and undermining the padlock your visitors rely on.',
};

const TIMEFRAME: Record<'urgent' | 'important', string> = {
  urgent: 'Within 7 days',
  important: 'Within 30 days',
};

/* ------------------------------------------------------------------------ */
/* Styles                                                                     */
/* ------------------------------------------------------------------------ */

const s = StyleSheet.create({
  // Cover
  cover: {
    backgroundColor: COLORS.navyDeep,
    padding: 56,
    color: COLORS.white,
    display: 'flex',
    flexDirection: 'column',
  },
  coverBrand: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: COLORS.white, letterSpacing: 0.5 },
  coverBrandAccent: { color: COLORS.blueSoft },
  coverTagline: { fontSize: 9, color: '#8b93a3', marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' },
  coverRule: { height: 3, width: 64, backgroundColor: COLORS.blue, marginTop: 28, marginBottom: 28 },
  coverTitle: { fontSize: 32, fontFamily: 'Helvetica-Bold', lineHeight: 1.15 },
  coverFor: { marginTop: 40 },
  coverForLabel: { fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: '#8b93a3', marginBottom: 6 },
  coverForValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.white },
  coverMetaRow: { flexDirection: 'row', gap: 36, marginTop: 26 },
  coverScoreBlock: {
    marginTop: 'auto',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  coverScore: { fontSize: 44, fontFamily: 'Helvetica-Bold' },
  coverConfidential: { fontSize: 8, color: '#6a7383', marginTop: 26, lineHeight: 1.5 },

  // Body pages
  page: { padding: 52, paddingBottom: 68, fontSize: 10, color: COLORS.ink, fontFamily: 'Helvetica' },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: COLORS.navy,
  },
  kicker: { fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.blue, marginBottom: 6 },
  h1: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: COLORS.navy, marginBottom: 14 },
  h2: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: COLORS.navy, marginTop: 18, marginBottom: 8 },
  para: { lineHeight: 1.6, color: '#333a47', marginBottom: 8 },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 6 },
  statBox: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, padding: 12 },
  statBig: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  statLabel: { fontSize: 7.5, color: COLORS.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 },

  bandPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 132, fontSize: 9.5 },
  barTrack: { flex: 1, height: 7, backgroundColor: '#eef0f3', borderRadius: 4 },
  barValue: { width: 48, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9.5 },

  finding: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  findingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  findingNo: { fontSize: 10, fontFamily: 'Helvetica-Bold', width: 22 },
  findingTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', flex: 1, paddingRight: 8 },
  findingTag: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6 },
  findingBody: { paddingVertical: 10, paddingHorizontal: 12 },
  fieldLabel: { fontSize: 7.5, letterSpacing: 1.2, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 3 },
  fieldText: { lineHeight: 1.55, color: '#333a47', marginBottom: 8, fontSize: 9.5 },
  timeframe: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.navy },

  passItem: { flexDirection: 'row', marginBottom: 5, alignItems: 'flex-start' },
  passBullet: { color: COLORS.green, fontFamily: 'Helvetica-Bold', width: 14, fontSize: 10 },
  passText: { flex: 1, lineHeight: 1.5, color: '#333a47', fontSize: 9.5 },

  planRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 7, alignItems: 'center' },
  planNo: { width: 26, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  planAction: { flex: 1, fontSize: 9.5, paddingRight: 8 },
  planSeverity: { width: 70, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  planWhen: { width: 78, fontSize: 8.5, textAlign: 'right', color: COLORS.muted },

  ctaBox: { backgroundColor: COLORS.navy, borderRadius: 10, padding: 20, marginTop: 16 },
  ctaTitle: { color: COLORS.white, fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  ctaText: { color: '#c9d2e4', fontSize: 9.5, lineHeight: 1.6, marginBottom: 8 },
  ctaContact: { color: COLORS.blueSoft, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },

  footer: {
    position: 'absolute',
    bottom: 26,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: COLORS.faint,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: 8,
  },
});

/* ------------------------------------------------------------------------ */
/* Document                                                                   */
/* ------------------------------------------------------------------------ */

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: dark ? COLORS.white : COLORS.navy }}>
      BizCompliance <Text style={{ color: dark ? COLORS.blueSoft : COLORS.blue }}>CQC</Text>
    </Text>
  );
}

function BodyFooter({ scan, refNo }: { scan: ScanRecord; refNo: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        BizCompliance CQC · Website Compliance Report · Prepared for {scan.companyName || scan.domain}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Ref ${refNo} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function FindingCard({ check, index }: { check: CheckResult; index: number }) {
  const urgent = check.severity === 'urgent';
  const tone = urgent
    ? { color: COLORS.red, wash: COLORS.redWash }
    : { color: COLORS.orange, wash: COLORS.orangeWash };
  const why = WHY_IT_MATTERS[check.id];

  return (
    <View style={s.finding} wrap={false}>
      <View style={[s.findingHead, { backgroundColor: tone.wash }]}>
        <Text style={[s.findingNo, { color: tone.color }]}>{String(index).padStart(2, '0')}</Text>
        <Text style={[s.findingTitle, { color: COLORS.ink }]}>{check.label}</Text>
        <Text style={[s.findingTag, { color: tone.color }]}>
          {urgent ? 'URGENT' : 'IMPORTANT'} · {CATEGORY_LABELS[check.category as CheckCategory].toUpperCase()}
        </Text>
      </View>
      <View style={s.findingBody}>
        <Text style={s.fieldLabel}>What we found</Text>
        <Text style={s.fieldText}>{check.summary}</Text>
        {why ? (
          <>
            <Text style={s.fieldLabel}>Why it matters</Text>
            <Text style={s.fieldText}>{why}</Text>
          </>
        ) : null}
        <Text style={s.fieldLabel}>How to fix it</Text>
        <Text style={s.fieldText}>{check.fix}</Text>
        <Text style={s.timeframe}>Recommended timeframe: {TIMEFRAME[check.severity]}</Text>
      </View>
    </View>
  );
}

function ScanReportDoc({ scan }: { scan: ScanRecord }) {
  const failing = scan.results.filter((r) => !r.passed);
  const urgent = failing.filter((r) => r.severity === 'urgent');
  const important = failing.filter((r) => r.severity === 'important');
  const ordered = [...urgent, ...important];
  const passing = scan.results.filter((r) => r.passed);
  const categories = Object.keys(CATEGORY_LABELS) as CheckCategory[];
  const issued = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const refNo = `BC-${scan.id.slice(0, 8).toUpperCase()}`;
  const b = band(scan.score);
  const preparedFor = scan.companyName || scan.domain;

  return (
    <Document
      title={`Website Compliance Report — ${preparedFor}`}
      author="BizCompliance CQC"
      subject="Website compliance assessment"
    >
      {/* ============================ COVER ============================ */}
      <Page size="A4" style={s.cover}>
        <View>
          <Text style={s.coverBrand}>
            BizCompliance <Text style={s.coverBrandAccent}>CQC</Text>
          </Text>
          <Text style={s.coverTagline}>Compliance, evidenced</Text>
        </View>

        <View style={s.coverRule} />
        <Text style={s.coverTitle}>Website{'\n'}Compliance Report</Text>

        <View style={s.coverFor}>
          <Text style={s.coverForLabel}>Prepared exclusively for</Text>
          <Text style={s.coverForValue}>{preparedFor}</Text>
          {scan.companyName ? (
            <Text style={{ fontSize: 10, color: '#aeb6c4', marginTop: 4 }}>{scan.domain}</Text>
          ) : null}
        </View>

        <View style={s.coverMetaRow}>
          <View>
            <Text style={s.coverForLabel}>Date of assessment</Text>
            <Text style={{ fontSize: 10.5, color: COLORS.white }}>{issued}</Text>
          </View>
          <View>
            <Text style={s.coverForLabel}>Report reference</Text>
            <Text style={{ fontSize: 10.5, color: COLORS.white }}>{refNo}</Text>
          </View>
          <View>
            <Text style={s.coverForLabel}>Checkpoints assessed</Text>
            <Text style={{ fontSize: 10.5, color: COLORS.white }}>{scan.results.length}</Text>
          </View>
        </View>

        <View style={s.coverScoreBlock}>
          <Text style={[s.coverScore, { color: b.color === COLORS.red ? '#ff9d92' : b.color === COLORS.orange ? '#ffb987' : '#7fdcae' }]}>
            {scan.score.toFixed(1)}
            <Text style={{ fontSize: 16, color: '#8b93a3' }}> /10</Text>
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.white, marginBottom: 3 }}>
              Overall standing: {b.label}
            </Text>
            <Text style={{ fontSize: 9, color: '#aeb6c4', lineHeight: 1.5 }}>
              {scan.urgent} urgent and {scan.important} important issues identified, with{' '}
              {scan.passed} checkpoints already met. Full findings and remediation steps inside.
            </Text>
          </View>
        </View>

        <Text style={s.coverConfidential}>
          Private &amp; confidential. This report was prepared for the recipient named above and
          reflects the public-facing position of the website listed at the date of assessment.
        </Text>
      </Page>

      {/* ====================== EXECUTIVE SUMMARY ====================== */}
      <Page size="A4" style={s.page}>
        <View style={s.headerBar} fixed />
        <Text style={s.kicker}>Executive summary</Text>
        <Text style={s.h1}>Where {preparedFor} stands today</Text>

        <Text style={s.para}>
          This assessment reviewed your website against {scan.results.length} compliance
          checkpoints across five areas: legal pages, privacy &amp; cookies, transparency &amp;
          trust, CQC &amp; care-sector duties, and technical security. Every finding in this report
          is specific to your website — including, where relevant, the exact page where evidence
          was or was not found.
        </Text>

        <View style={s.statRow}>
          <View style={[s.statBox, { backgroundColor: b.wash, borderColor: b.color }]}>
            <Text style={[s.statBig, { color: b.color }]}>{scan.score.toFixed(1)}/10</Text>
            <Text style={s.statLabel}>Compliance score</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statBig, { color: COLORS.red }]}>{scan.urgent}</Text>
            <Text style={s.statLabel}>Urgent issues</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statBig, { color: COLORS.orange }]}>{scan.important}</Text>
            <Text style={s.statLabel}>Important issues</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statBig, { color: COLORS.green }]}>{scan.passed}</Text>
            <Text style={s.statLabel}>Checkpoints met</Text>
          </View>
        </View>

        <Text style={s.h2}>Score by area</Text>
        {scan.categoryScores.map((c) => (
          <View key={c.category} style={s.barRow}>
            <Text style={s.barLabel}>{c.label}</Text>
            <View style={s.barTrack}>
              <View
                style={{
                  width: `${Math.max(3, (c.score / 10) * 100)}%`,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: scoreColor(c.score),
                }}
              />
            </View>
            <Text style={s.barValue}>{c.score.toFixed(1)}/10</Text>
          </View>
        ))}

        <Text style={s.h2}>How to read this report</Text>
        <Text style={s.para}>
          <Text style={{ fontFamily: 'Helvetica-Bold', color: COLORS.red }}>Urgent</Text> findings
          relate to legal duties or security exposures and should be addressed first — we recommend
          within 7 days. <Text style={{ fontFamily: 'Helvetica-Bold', color: COLORS.orange }}>Important</Text>{' '}
          findings affect trust, enforceability or best practice and should be resolved within 30
          days. Each finding includes what we found, why it matters for a care provider, and the
          practical step to fix it. Scores of 9.0 and above are considered compliant; anything
          below means there is work to do.
        </Text>

        <Text style={s.h2}>Assessment scope</Text>
        <Text style={s.para}>
          The review covered {scan.pagesScanned} {scan.pagesScanned === 1 ? 'page' : 'pages'} of
          your public website, including the pages where visitors expect to find your legal,
          privacy, contact and CQC information, together with the technical configuration of the
          site itself.
        </Text>

        <BodyFooter scan={scan} refNo={refNo} />
      </Page>

      {/* ========================= FINDINGS ========================= */}
      <Page size="A4" style={s.page}>
        <View style={s.headerBar} fixed />
        <Text style={s.kicker}>Findings &amp; remediation</Text>
        <Text style={s.h1}>
          {ordered.length === 0
            ? 'No compliance issues identified'
            : `${ordered.length} ${ordered.length === 1 ? 'issue' : 'issues'} requiring action`}
        </Text>
        {ordered.length > 0 ? (
          <Text style={[s.para, { marginBottom: 12 }]}>
            Work through the findings in the order presented — urgent items first. Each one is
            self-contained: what we found, why it matters, and how to fix it.
          </Text>
        ) : (
          <Text style={s.para}>
            Every checkpoint we assess was met. Maintain your current arrangements and re-assess
            after any significant website change.
          </Text>
        )}
        {ordered.map((check, i) => (
          <FindingCard key={check.id} check={check} index={i + 1} />
        ))}
        <BodyFooter scan={scan} refNo={refNo} />
      </Page>

      {/* ==================== PASSED + ACTION PLAN ==================== */}
      <Page size="A4" style={s.page}>
        <View style={s.headerBar} fixed />
        <Text style={s.kicker}>Confirmed strengths</Text>
        <Text style={s.h1}>Where you already comply</Text>
        {passing.length === 0 ? (
          <Text style={s.para}>
            None of the assessed checkpoints were met at the date of assessment.
          </Text>
        ) : (
          categories.map((cat) => {
            const rows = passing.filter((r) => r.category === cat);
            if (!rows.length) return null;
            return (
              <View key={cat} style={{ marginBottom: 10 }}>
                <Text style={[s.fieldLabel, { marginBottom: 5 }]}>{CATEGORY_LABELS[cat]}</Text>
                {rows.map((r) => (
                  <View key={r.id} style={s.passItem}>
                    <Text style={s.passBullet}>✓</Text>
                    <Text style={s.passText}>
                      <Text style={{ fontFamily: 'Helvetica-Bold' }}>{r.label}</Text> — {r.summary}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        )}

        {ordered.length > 0 ? (
          <>
            <Text style={s.h2}>Your action plan at a glance</Text>
            <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 2, marginTop: 4 }}>
              {ordered.map((check, i) => (
                <View key={check.id} style={[s.planRow, i === ordered.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                  <Text style={s.planNo}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={s.planAction}>{check.label}</Text>
                  <Text style={[s.planSeverity, { color: check.severity === 'urgent' ? COLORS.red : COLORS.orange }]}>
                    {check.severity.toUpperCase()}
                  </Text>
                  <Text style={s.planWhen}>{TIMEFRAME[check.severity]}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        <BodyFooter scan={scan} refNo={refNo} />
      </Page>

      {/* ========================= NEXT STEPS ========================= */}
      <Page size="A4" style={s.page}>
        <View style={s.headerBar} fixed />
        <Text style={s.kicker}>Next steps</Text>
        <Text style={s.h1}>After the fixes: re-assess, then go deeper</Text>

        <Text style={s.para}>
          1. Work through the action plan in order — urgent items within 7 days, important items
          within 30.
        </Text>
        <Text style={s.para}>
          2. Once your changes are live, run a fresh assessment at bizcompliance.co.uk to confirm
          your improved score and keep the evidence on file.
        </Text>
        <Text style={s.para}>
          3. Remember that your website is the public tip of your compliance position. A CQC
          inspection assesses far more: 139 evidence points across all 18 compliance areas of the
          HSCA 2008 Regulated Activities Regulations, examined through the Single Assessment
          Framework.
        </Text>

        <View style={s.ctaBox}>
          <Brand dark />
          <Text style={[s.ctaTitle, { marginTop: 10 }]}>The CQC Readiness Audit — £595, delivered in 48 hours</Text>
          <Text style={s.ctaText}>
            A personalised, manual review of your whole service: every one of the 139 evidence
            points, red / amber / green ratings for all 18 areas, a personalised readiness score,
            a fix-first action plan — and the compliance documents you are missing, issued
            directly to your secure vault.
          </Text>
          <Text style={s.ctaContact}>bizcompliance.co.uk · hello@bizcompliance.co.uk</Text>
        </View>

        <Text style={[s.para, { marginTop: 22, fontSize: 8, color: COLORS.muted }]}>
          This report assesses publicly visible website compliance signals at the date of
          assessment and is provided for information purposes. It is not legal advice and does not
          assess the delivery of regulated care. Requirements referenced include UK GDPR, PECR,
          the Companies Act 2006 and Regulation 20A of the Health and Social Care Act 2008
          (Regulated Activities) Regulations 2014. The registered provider remains responsible for
          compliance with the law. © {new Date().getFullYear()} BizCompliance CQC Ltd.
        </Text>
        <BodyFooter scan={scan} refNo={refNo} />
      </Page>
    </Document>
  );
}

/** Renders the paid PDF, stores it in the reports bucket, records the path. */
export async function generateScanReport(scanId: string): Promise<string | null> {
  const scan = await getScan(scanId);
  if (!scan) return null;

  const pdf = await renderToBuffer(<ScanReportDoc scan={scan} />);
  const path = `scans/${scanId}/website-compliance-report.pdf`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from('reports')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (error) {
    console.error('[scan] report upload failed', error.message);
    return null;
  }
  await admin.from('website_scans').update({ report_storage_path: path }).eq('id', scanId);
  return path;
}
