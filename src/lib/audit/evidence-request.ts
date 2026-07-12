/**
 * Pre-audit Evidence Request List — Step 1 of a proper independent CQC
 * readiness audit. A credible audit doesn't just read policies; it asks the
 * provider for the RECORDS that prove those policies are lived in practice.
 *
 * This is the single source of truth for:
 *   - the client-facing "what to send us before your audit" checklist, and
 *   - (next) the evidence-verification layer, which pairs a policy claim with
 *     the corroborating record listed here ("policy says annual safeguarding
 *     training → training matrix + certificates").
 *
 * Keyed to the canonical 18 areas (AREAS in the reader manifest). `record`
 * items are the artefacts a provider is asked to supply; `verifies` names the
 * policy promise each record is meant to evidence, so a gap ("policy present,
 * no supporting record") can be surfaced.
 */
import { AREAS } from '@/lib/engine/reader/manifest.mjs';

export type EvidenceKind = 'document' | 'record' | 'log' | 'matrix' | 'sample';

export interface EvidenceItem {
  /** Stable id, e.g. "02-training-matrix". */
  id: string;
  /** What the provider is asked to send. */
  label: string;
  kind: EvidenceKind;
  /** Legally required / rating-limiting if absent. Drives priority + RED. */
  critical: boolean;
  /** The policy promise this record is meant to prove (for verification). */
  verifies: string;
}

export interface EvidenceRequestArea {
  code: string;
  /** Canonical area name from AREAS. */
  area: string;
  items: EvidenceItem[];
}

const AREA_NAME = AREAS as Record<string, string>;

/**
 * The request list. Deliberately mirrors the gold-standard pre-audit ask
 * (Statement of Purpose, recruitment files, training matrix, DBS, supervision,
 * appraisals, care plans, risk assessments, MAR charts, complaints/incident/
 * safeguarding logs, QA audits, service-user feedback, business continuity,
 * IPC, equipment/maintenance) mapped onto the 18 areas.
 */
const REQUESTS: Record<string, Omit<EvidenceItem, 'id'>[]> = {
  '01': [
    { label: 'Statement of Purpose (current, Schedule 3 content)', kind: 'document', critical: true, verifies: 'Registered activities, aims, service-user bands and RM are declared' },
    { label: 'Certificate of Registration', kind: 'document', critical: true, verifies: 'Provider is registered for the regulated activities delivered' },
    { label: 'Website / notice showing CQC rating (Reg 20A)', kind: 'record', critical: false, verifies: 'Duty to display current rating is met' },
  ],
  '02': [
    { label: 'Safeguarding Adults policy & procedure', kind: 'document', critical: true, verifies: 'Reg 13 duty, abuse types, s.42 referral route defined' },
    { label: 'Safeguarding training matrix + certificates', kind: 'matrix', critical: true, verifies: 'Staff receive safeguarding training as the policy states' },
    { label: 'Safeguarding concerns / referrals log (12 months)', kind: 'log', critical: true, verifies: 'Concerns are recorded and referred to the local authority' },
    { label: 'Sample: a completed safeguarding record', kind: 'sample', critical: false, verifies: 'Concerns are handled the way the procedure describes' },
  ],
  '03': [
    { label: 'Consent & Mental Capacity policy', kind: 'document', critical: true, verifies: 'Reg 11 consent, MCA two-stage test, best-interests process' },
    { label: 'Sample: capacity assessments & best-interests records', kind: 'sample', critical: true, verifies: 'Capacity is assessed and recorded per the MCA in practice' },
    { label: 'DoLS/LPS referral records where applicable', kind: 'record', critical: false, verifies: 'Deprivations of liberty are identified and referred' },
  ],
  '04': [
    { label: 'Risk management policy & risk assessment template', kind: 'document', critical: true, verifies: 'Reg 12 safe care via assessed, mitigated risk' },
    { label: 'Sample: individual service-user risk assessments', kind: 'sample', critical: true, verifies: 'Risks are assessed and controlled for each person' },
    { label: 'Incident & accident log with learning/trend review', kind: 'log', critical: true, verifies: 'Incidents are recorded and lessons acted on' },
  ],
  '05': [
    { label: 'Lone working policy', kind: 'document', critical: true, verifies: 'Staff safety in the community is risk-assessed' },
    { label: 'Lone working risk assessments / check-in records', kind: 'record', critical: false, verifies: 'Lone-working controls operate in practice' },
  ],
  '06': [
    { label: 'Medicines Management policy & procedure', kind: 'document', critical: true, verifies: 'Safe medicines handling, storage, administration' },
    { label: 'Sample: MAR charts (if medicines are supported)', kind: 'sample', critical: true, verifies: 'Medicines are administered and recorded correctly' },
    { label: 'Staff medicines competency assessments', kind: 'record', critical: true, verifies: 'Only competent staff administer medicines' },
    { label: 'Medicines audit (most recent)', kind: 'record', critical: false, verifies: 'Medicines practice is self-audited' },
  ],
  '07': [
    { label: 'Person-centred care planning policy', kind: 'document', critical: true, verifies: 'Care is planned around the individual' },
    { label: 'Sample: current care plans (2–3 service users)', kind: 'sample', critical: true, verifies: 'Care plans are personalised, current and consented' },
  ],
  '08': [
    { label: 'Complaints policy & procedure', kind: 'document', critical: true, verifies: 'Reg 16 complaints handling with timescales' },
    { label: 'Complaints log (12 months) with outcomes', kind: 'log', critical: false, verifies: 'Complaints are logged, investigated and learned from' },
  ],
  '09': [
    { label: 'Duty of Candour policy & procedure', kind: 'document', critical: true, verifies: 'Reg 20 candour after notifiable safety incidents' },
    { label: 'Duty of Candour record/log where triggered', kind: 'log', critical: false, verifies: 'Candour is applied and recorded when required' },
  ],
  '10': [
    { label: 'Governance / quality-assurance framework', kind: 'document', critical: true, verifies: 'Reg 17 good governance and record-keeping' },
    { label: 'Recent QA audits (safeguarding, medicines, care files)', kind: 'record', critical: true, verifies: 'The service audits its own quality on a schedule' },
    { label: 'Service-user / relative feedback (surveys, reviews)', kind: 'record', critical: false, verifies: 'Feedback is sought and acted upon' },
  ],
  '11': [
    { label: 'Training matrix (all staff, all mandatory topics)', kind: 'matrix', critical: true, verifies: 'Staff are trained and training is current' },
    { label: 'Supervision & appraisal records (sample)', kind: 'sample', critical: true, verifies: 'Staff are supervised and appraised as policy states' },
    { label: 'Staffing / rota evidence of safe deployment', kind: 'record', critical: false, verifies: 'Sufficient, suitable staff are deployed' },
  ],
  '12': [
    { label: 'Safe recruitment policy', kind: 'document', critical: true, verifies: 'Reg 19 fit and proper persons employed' },
    { label: 'Sample: recruitment files (references, ID, right to work)', kind: 'sample', critical: true, verifies: 'Pre-employment checks are complete per Schedule 3' },
    { label: 'DBS records / register (with dates)', kind: 'record', critical: true, verifies: 'Valid DBS checks are in place for staff' },
  ],
  '13': [
    { label: 'Data protection & confidentiality policy', kind: 'document', critical: true, verifies: 'UK GDPR / confidentiality duties are met' },
    { label: 'Data Security & Protection Toolkit status (if held)', kind: 'record', critical: false, verifies: 'Data-security assurance is evidenced' },
  ],
  '14': [
    { label: 'Health & Safety policy', kind: 'document', critical: true, verifies: 'H&S duties for office and community work' },
    { label: 'Equipment / maintenance & servicing records', kind: 'record', critical: false, verifies: 'Equipment is maintained and safe' },
  ],
  '15': [
    { label: 'Infection Prevention & Control policy', kind: 'document', critical: true, verifies: 'IPC duties and PPE arrangements' },
    { label: 'IPC audit / PPE records', kind: 'record', critical: false, verifies: 'IPC practice is monitored in the field' },
  ],
  '16': [
    { label: 'CQC notifications policy / procedure', kind: 'document', critical: true, verifies: 'Statutory notifications are made (Reg 18)' },
    { label: 'Notifications log (submitted to CQC)', kind: 'log', critical: false, verifies: 'Notifiable events were actually reported' },
  ],
  '17': [
    { label: 'Business Continuity & Emergency plan', kind: 'document', critical: true, verifies: 'Service continues safely through disruption' },
    { label: 'Contact tree / on-call arrangements', kind: 'record', critical: false, verifies: 'Continuity arrangements are usable in practice' },
  ],
  '18': [
    { label: 'Equality, dignity & service-user rights policy', kind: 'document', critical: true, verifies: 'Rights, dignity and equality are protected' },
    { label: 'Evidence of dignity/rights in care records', kind: 'sample', critical: false, verifies: 'Dignity and rights are honoured in delivery' },
  ],
};

/** The full pre-audit request list, one entry per area, in area order. */
export function evidenceRequestList(): EvidenceRequestArea[] {
  return Object.keys(REQUESTS)
    .sort()
    .map((code) => ({
      code,
      area: AREA_NAME[code] ?? `Area ${code}`,
      items: REQUESTS[code].map((item, i) => ({
        id: `${code}-${i + 1}`,
        ...item,
      })),
    }));
}

/** Flat list of every requested item, for counting / verification lookups. */
export function allEvidenceItems(): (EvidenceItem & { code: string; area: string })[] {
  return evidenceRequestList().flatMap((a) =>
    a.items.map((it) => ({ ...it, code: a.code, area: a.area })),
  );
}

export function evidenceRequestCounts() {
  const items = allEvidenceItems();
  return {
    total: items.length,
    critical: items.filter((i) => i.critical).length,
    samples: items.filter((i) => i.kind === 'sample').length,
  };
}
