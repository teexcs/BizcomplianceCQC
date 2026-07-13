/**
 * FINDINGS LIBRARY — standard, regulator-grade wording for the gaps the engine
 * detects, so every audit reads consistently and the action plan can be
 * auto-drafted rather than written from scratch each time.
 *
 * The engine already DETECTS gaps deterministically:
 *   • a legally-required / CQC-expected library item Missing, Out-of-date, or
 *     present-but-an-uncustomised-Template (audit_items + reader);
 *   • a policy present but its proving record not supplied (verification layer);
 *   • a sampled client record judged partial / not-compliant (file sampling).
 *
 * This module turns each detected gap into a finding whose Detail names the
 * regulation and standard (regulator voice) and whose Recommendation says
 * plainly what to add ("Here's what to add …"). Entries are keyed by CQC area
 * (the canonical 18) and gap type; a per-signal override map lets the most
 * serious signals carry their own precise wording.
 *
 * Pure and data-only, so it can be unit-tested, and shared by the auto-draft
 * pipeline (autopilot) and the manual picker in the Findings form.
 */
import { AREAS } from '@/lib/engine/reader/manifest.mjs';

const AREA_NAME = AREAS as Record<string, string>;

/** The kinds of gap the engine can hand the library. */
export type GapType =
  | 'missing' // library item not evidenced at all
  | 'out_of_date' // evidenced but past its review cycle
  | 'template' // present but an un-customised template
  | 'policy_only' // policy exists, proving record not supplied
  | 'sample_partial' // a sampled record only partly meets the standard
  | 'sample_not_compliant'; // a sampled record does not meet the standard

export type FindingSeverity = 'red' | 'amber' | 'green';
export type FindingPriorityKey = 'fix_first' | 'days_7' | 'days_14' | 'days_30';

export interface FindingTemplate {
  /** Short title. {subject} is the document / record name. */
  title: string;
  /** Regulator-voiced explanation. {subject}, {area}, {reg} interpolated. */
  detail: string;
  /** "Here's what to add" — concrete, actionable. Same interpolation. */
  recommendation: string;
  severity: FindingSeverity;
  priority: FindingPriorityKey;
}

/**
 * Per-area regulatory anchor: the regulation(s) most relevant to that area,
 * used to make generic wording specific ({reg}). Drawn from the engine's own
 * rulebook so the library and the analysis agree.
 */
const AREA_REG: Record<string, string> = {
  '01': 'the CQC (Registration) Regulations 2009 and Regulation 12 of the HSCA 2008 (Regulated Activities) Regulations 2014',
  '02': 'Regulation 13 (safeguarding service users from abuse and improper treatment)',
  '03': 'Regulation 11 (need for consent) and the Mental Capacity Act 2005',
  '04': 'Regulation 12 (safe care and treatment)',
  '05': 'Regulation 12 (safe care and treatment) and the Health and Safety at Work etc. Act 1974',
  '06': 'Regulation 12(2)(g) (proper and safe management of medicines)',
  '07': 'Regulation 9 (person-centred care)',
  '08': 'Regulation 16 (receiving and acting on complaints)',
  '09': 'Regulation 20 (duty of candour)',
  '10': 'Regulation 17 (good governance)',
  '11': 'Regulation 18 (staffing) and Regulation 19 (fit and proper persons employed)',
  '12': 'Regulation 19 (fit and proper persons employed) and Schedule 3',
  '13': 'Regulation 17 (good governance) and the UK GDPR / Data Protection Act 2018',
  '14': 'Regulation 12 (safe care and treatment) and the Health and Safety at Work etc. Act 1974',
  '15': 'Regulation 12 (safe care and treatment) — infection prevention and control',
  '16': 'Regulation 18 of the CQC (Registration) Regulations 2009 (notifications)',
  '17': 'Regulation 17 (good governance) — business continuity',
  '18': 'Regulation 10 (dignity and respect) and Regulation 9 (person-centred care)',
};

/** Generic, regulator-voiced templates by gap type (the fallback for any area). */
const GENERIC: Record<GapType, FindingTemplate> = {
  missing: {
    title: '{subject} not evidenced',
    detail:
      'No current {subject} was provided for review under {area}. This is required by {reg}; without it, compliance cannot be demonstrated at inspection.',
    recommendation:
      'Here’s what to add: put a current, dated {subject} in place that meets {reg}, and file it under {area}. A compliant template can be issued from the BizCompliance library and tailored to your service.',
    severity: 'red',
    priority: 'fix_first',
  },
  out_of_date: {
    title: '{subject} is outside its review cycle',
    detail:
      'A {subject} was located under {area} but is past its stated review date. An expired document offers limited assurance under {reg} and would be questioned at inspection.',
    recommendation:
      'Here’s what to add: review and re-issue the {subject}, record the new review date in the document control block, and set a 12-month review reminder.',
    severity: 'amber',
    priority: 'days_7',
  },
  template: {
    title: '{subject} present but not customised',
    detail:
      'A {subject} exists under {area} but retains template placeholder text, so it does not describe your service and would not be accepted as evidence under {reg}.',
    recommendation:
      'Here’s what to add: replace every placeholder in the {subject} with your service’s details, have it approved and dated, then re-file it under {area}.',
    severity: 'red',
    priority: 'fix_first',
  },
  policy_only: {
    title: '{subject} — policy in place but not evidenced in practice',
    detail:
      'A policy covering {subject} exists, but the supporting record that shows it is applied in practice was not supplied. Under {reg}, a policy alone does not demonstrate compliance — the operational evidence is expected.',
    recommendation:
      'Here’s what to add: supply the corroborating record for {subject} (for example the completed log, matrix, or record referenced by the policy) so the arrangement can be verified.',
    severity: 'amber',
    priority: 'days_14',
  },
  sample_partial: {
    title: '{subject} — partially meets the standard',
    detail:
      'On sampling, {subject} only partly met the expected standard under {reg}. The arrangements are in place but incomplete or inconsistently applied.',
    recommendation:
      'Here’s what to add: address the specific gaps noted for {subject}, and audit a wider sample to confirm the issue is not systemic.',
    severity: 'amber',
    priority: 'days_14',
  },
  sample_not_compliant: {
    title: '{subject} — does not meet the standard',
    detail:
      'On sampling, {subject} did not meet the expected standard under {reg}. This is a direct compliance gap in the records that evidence day-to-day care.',
    recommendation:
      'Here’s what to add: correct {subject} without delay, review comparable records for the same fault, and record the remedial action taken.',
    severity: 'red',
    priority: 'fix_first',
  },
};

/**
 * Per-area overrides for the most consequential gaps — the ~critical signals
 * where generic wording isn't specific enough. Keyed area → gap type. Any key
 * not present falls back to GENERIC. Every area has at least a `missing`
 * override so the most common finding is precise across all 18 areas.
 */
const AREA_OVERRIDES: Record<string, Partial<Record<GapType, FindingTemplate>>> = {
  '01': {
    missing: {
      title: 'Statement of Purpose not evidenced',
      detail:
        'No current Statement of Purpose meeting Schedule 3 was provided. Providers must maintain one under the CQC (Registration) Regulations 2009; it must state the regulated activities, aims, service-user bands and registered manager.',
      recommendation:
        'Here’s what to add: adopt a Statement of Purpose covering all Schedule 3 content, keep it under review, and notify CQC of any change within 28 days.',
      severity: 'red',
      priority: 'fix_first',
    },
  },
  '02': {
    missing: {
      title: 'Safeguarding policy not evidenced',
      detail:
        'No current safeguarding adults policy was provided. Regulation 13 requires systems to protect people from abuse, including defined abuse types, the local-authority s.42 referral route, a named safeguarding lead, and a whistleblowing route.',
      recommendation:
        'Here’s what to add: adopt a dated safeguarding policy that defines abuse types, sets out the s.42 referral route to the local authority, names the safeguarding lead, and references PIDA whistleblowing and the duty to refer to the DBS.',
      severity: 'red',
      priority: 'fix_first',
    },
    policy_only: {
      title: 'Safeguarding training not evidenced',
      detail:
        'The safeguarding policy commits to staff training, but no training matrix or certificates were supplied to show staff have completed it. Under Regulation 13, the arrangement must be demonstrable, not just stated.',
      recommendation:
        'Here’s what to add: supply an up-to-date training matrix showing each staff member’s safeguarding training and renewal dates, with certificates on file.',
      severity: 'amber',
      priority: 'days_14',
    },
  },
  '03': {
    missing: {
      title: 'Consent & Mental Capacity policy not evidenced',
      detail:
        'No consent / mental capacity policy was provided. Regulation 11 and the Mental Capacity Act 2005 require a two-stage capacity assessment, a best-interests process, the presumption of capacity, the least-restrictive principle, and a DoLS/LPS route.',
      recommendation:
        'Here’s what to add: adopt an MCA-aligned policy covering capacity assessment, best-interests decisions, unwise decisions, least-restrictive practice, and deprivation-of-liberty referrals, with consent recorded.',
      severity: 'red',
      priority: 'fix_first',
    },
  },
  '04': {
    missing: {
      title: 'Risk management / risk assessment framework not evidenced',
      detail:
        'No risk management policy or risk-assessment framework was provided. Regulation 12 requires that risks to service users are assessed and mitigated, with incidents recorded and learned from.',
      recommendation:
        'Here’s what to add: put an individual risk-assessment process in place with control measures, an incident/accident log, and a documented review of lessons learned.',
      severity: 'red',
      priority: 'fix_first',
    },
  },
  '06': {
    missing: {
      title: 'Medicines Management policy not evidenced',
      detail:
        'No medicines management policy was provided. Regulation 12(2)(g) requires the proper and safe management of medicines, including MAR charts, PRN protocols, error reporting, controlled-drug and covert-administration safeguards, and staff competency.',
      recommendation:
        'Here’s what to add: adopt a medicines policy aligned to NICE NG67 covering MAR recording, PRN protocols, medication-error reporting, controlled drugs, covert administration, and staff competency assessment.',
      severity: 'red',
      priority: 'fix_first',
    },
    policy_only: {
      title: 'Medicines records not evidenced against policy',
      detail:
        'A medicines policy is in place, but MAR charts / medicines audits were not supplied to show it is applied. Under Regulation 12(2)(g) the records must be consistent with the policy and available for review.',
      recommendation:
        'Here’s what to add: supply recent MAR charts and the latest medicines audit so administration can be checked against the policy for consistency and gaps.',
      severity: 'amber',
      priority: 'days_14',
    },
  },
  '09': {
    missing: {
      title: 'Duty of Candour policy not evidenced',
      detail:
        'No duty of candour policy was provided. Regulation 20 requires providers to act in an open and transparent way and to notify and apologise to the relevant person after a notifiable safety incident.',
      recommendation:
        'Here’s what to add: adopt a duty of candour policy and record form that sets out the notification, apology and record-keeping steps triggered by a notifiable safety incident.',
      severity: 'red',
      priority: 'fix_first',
    },
  },
  '10': {
    missing: {
      title: 'Governance / quality-assurance framework not evidenced',
      detail:
        'No governance or quality-assurance framework was provided. Regulation 17 requires systems to assess, monitor and improve the quality and safety of the service and to maintain accurate records.',
      recommendation:
        'Here’s what to add: put a QA framework in place with a schedule of audits (safeguarding, medicines, care files), an action log, and evidence that feedback is sought and acted upon.',
      severity: 'red',
      priority: 'fix_first',
    },
  },
  '11': {
    policy_only: {
      title: 'Staff training / supervision not evidenced',
      detail:
        'Policies reference training, supervision and appraisal, but the training matrix and supervision records were not supplied. Regulation 18 requires suitably qualified, competent and supervised staff, demonstrably.',
      recommendation:
        'Here’s what to add: supply a complete training matrix (all staff, all mandatory topics, with renewal dates) and a sample of supervision and appraisal records.',
      severity: 'amber',
      priority: 'days_14',
    },
  },
  '12': {
    missing: {
      title: 'Safe recruitment evidence not provided',
      detail:
        'Recruitment records were not provided. Regulation 19 and Schedule 3 require pre-employment checks — enhanced DBS, references, identity, right to work and full employment history — for all staff.',
      recommendation:
        'Here’s what to add: supply a sample of recruitment files evidencing enhanced DBS, two references, ID and right-to-work checks, plus a DBS register with issue dates.',
      severity: 'red',
      priority: 'fix_first',
    },
    policy_only: {
      title: 'DBS / recruitment checks not evidenced',
      detail:
        'A safe-recruitment policy is in place, but the DBS register and recruitment files were not supplied to show checks were completed. Under Regulation 19 the checks must be evidenced, not just required by policy.',
      recommendation:
        'Here’s what to add: supply the DBS register (with issue/renewal dates) and a sample of completed recruitment files so the checks can be verified.',
      severity: 'amber',
      priority: 'days_7',
    },
  },
  '16': {
    missing: {
      title: 'CQC notifications process not evidenced',
      detail:
        'No notifications policy or log was provided. Regulation 18 of the CQC (Registration) Regulations 2009 requires statutory notifications of specified events (deaths, serious injuries, abuse, DoLS outcomes) to be made without delay.',
      recommendation:
        'Here’s what to add: adopt a notifications procedure listing the notifiable events and maintain a log of notifications submitted to CQC.',
      severity: 'red',
      priority: 'fix_first',
    },
  },
};

export interface ResolvedFinding {
  title: string;
  detail: string;
  recommendation: string;
  severity: FindingSeverity;
  priority: FindingPriorityKey;
}

/** Fill {subject} / {area} / {reg} in a template string. */
function interpolate(text: string, subject: string, areaCode: string): string {
  const areaLabel = AREA_NAME[areaCode]
    ? `${areaCode} ${AREA_NAME[areaCode]}`
    : `area ${areaCode}`;
  const reg = AREA_REG[areaCode] ?? 'the applicable CQC regulations';
  return text
    .replaceAll('{subject}', subject)
    .replaceAll('{area}', areaLabel)
    .replaceAll('{reg}', reg);
}

/**
 * Resolve a detected gap into standard finding wording. `subject` is the
 * document or record name (e.g. "Safeguarding Adults Policy"); when omitted the
 * area name is used so the finding still reads correctly.
 */
export function resolveFinding(
  areaCode: string,
  gap: GapType,
  subject?: string,
): ResolvedFinding {
  const tpl = AREA_OVERRIDES[areaCode]?.[gap] ?? GENERIC[gap];
  const subj = subject?.trim() || AREA_NAME[areaCode] || 'this area';
  return {
    title: interpolate(tpl.title, subj, areaCode),
    detail: interpolate(tpl.detail, subj, areaCode),
    recommendation: interpolate(tpl.recommendation, subj, areaCode),
    severity: tpl.severity,
    priority: tpl.priority,
  };
}

const GAP_LABELS: Record<GapType, string> = {
  missing: 'Missing / not evidenced',
  out_of_date: 'Out of date',
  template: 'Present but not customised',
  policy_only: 'Policy only — not evidenced in practice',
  sample_partial: 'Sampled record — partial',
  sample_not_compliant: 'Sampled record — not compliant',
};

export interface LibraryEntry {
  areaCode: string;
  areaName: string;
  gap: GapType;
  gapLabel: string;
  preview: ResolvedFinding;
}

/**
 * The full library flattened for the manual picker — one entry per (area, gap
 * type), with a resolved preview using the area name as the subject. Ordered by
 * area then a fixed gap order.
 */
const GAP_ORDER: GapType[] = [
  'missing',
  'out_of_date',
  'template',
  'policy_only',
  'sample_partial',
  'sample_not_compliant',
];

export function findingsLibrary(): LibraryEntry[] {
  const entries: LibraryEntry[] = [];
  for (const areaCode of Object.keys(AREA_NAME).sort()) {
    for (const gap of GAP_ORDER) {
      entries.push({
        areaCode,
        areaName: AREA_NAME[areaCode],
        gap,
        gapLabel: GAP_LABELS[gap],
        preview: resolveFinding(areaCode, gap),
      });
    }
  }
  return entries;
}
