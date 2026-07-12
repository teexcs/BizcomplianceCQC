/**
 * EVIDENCE-VERIFICATION LAYER — the difference between reading policies and
 * running an audit.
 *
 * A policy that *says* "staff receive annual safeguarding training" proves
 * nothing on its own. A proper independent audit demands the corroborating
 * record — the training matrix, the certificates, the MAR chart, the DBS
 * register. This module answers, deterministically and per requested item:
 *
 *     Is a record of the RIGHT KIND actually present in the vault?
 *
 * It classifies every current evidence file into record types from its file
 * name and (when readable) its extracted text — never inventing anything — and
 * then, for each item on the pre-audit Evidence Request List, returns one of:
 *
 *   • verified   — a corroborating record of the expected kind is present
 *   • policy_only — the topic's policy is present but the proving record is not
 *   • absent     — nothing for this item is in the vault
 *
 * The result drives area findings ("policy present, supporting record not
 * supplied") and the report's Evidence Reviewed / gaps sections. It is a pure
 * function of the file list so it can be unit-tested and reasoned about; the
 * DB-facing wrapper lives in the reader adapter.
 */
import {
  evidenceRequestList,
  type EvidenceItem,
  type EvidenceKind,
  type EvidenceRequestArea,
} from '@/lib/audit/evidence-request';

/** A vault file reduced to what verification needs. */
export interface VerifiableFile {
  id: string;
  fileName: string;
  /** Machine-readable extracted text, or '' if not yet readable. */
  text: string;
  /** Detected CQC area code ('01'..'18') if the classifier assigned one. */
  areaCode: string | null;
}

/**
 * The record archetypes a domiciliary audit looks for. `document` (a policy)
 * is handled by the reader's signal engine; here we recognise the *supporting
 * records* that prove policies are lived. Recognition is deterministic:
 * a strong filename hint, or a content hint on a readable file.
 */
interface RecordMatcher {
  kind: Exclude<EvidenceKind, 'document'>;
  /** Filename patterns — the primary, most reliable signal. */
  fileName: RegExp[];
  /** Content patterns — a secondary signal for readable files. */
  content?: RegExp[];
}

const RECORD_MATCHERS: RecordMatcher[] = [
  {
    kind: 'matrix',
    fileName: [/matri(x|ces)/i, /training\s*(log|record|tracker|grid)/i, /training[-_ ]?matrix/i],
    content: [/training\s*matrix/i, /\b(course|module)\b.*\b(due|completed|expiry|renewal)\b/i],
  },
  {
    kind: 'log',
    fileName: [
      /\blog\b/i, /\bregister\b/i, /\btracker\b/i,
      /incident/i, /accident/i, /complaint/i, /safeguarding.*(log|register|concern)/i,
      /notification.*(log|record)/i, /candour.*(log|record)/i,
    ],
    content: [/\bdate reported\b/i, /\bincident (no|number|ref)\b/i, /\bregister of\b/i],
  },
  {
    kind: 'matrix', // DBS/recruitment register also reads as a tracked matrix
    fileName: [/\bdbs\b/i, /disclosure.*barring/i, /recruitment.*(log|register|matrix|tracker)/i],
    content: [/\bdbs\b.*(certificate|number|issued|renewal)/i, /disclosure and barring/i],
  },
  {
    kind: 'sample',
    fileName: [
      /care\s*plan/i, /support\s*plan/i, /risk\s*assessment/i,
      /\bmar\b/i, /medication\s*administration/i,
      /capacity\s*assessment/i, /best.interest/i,
      /supervision/i, /appraisal/i, /recruitment\s*file/i, /staff\s*file/i,
    ],
    content: [/\bmar\b/i, /care plan for/i, /supervision (record|meeting|notes)/i],
  },
  {
    kind: 'record',
    fileName: [
      /audit/i, /qa\b/i, /quality\s*assurance/i, /feedback/i, /survey/i,
      /servic(e|ing)/i, /maintenance/i, /ppe/i, /certificate/i,
      /contact\s*(tree|list)/i, /on.call/i, /dspt/i, /toolkit/i,
    ],
    content: [/audit (tool|completed|findings)/i, /survey results/i, /next service due/i],
  },
];

/** Classify a file into every record kind it plausibly is (a file can be several). */
function detectKinds(file: VerifiableFile): Set<EvidenceKind> {
  const kinds = new Set<EvidenceKind>();
  const name = file.fileName;
  const readable = file.text.trim().length > 0;
  for (const m of RECORD_MATCHERS) {
    if (m.fileName.some((re) => re.test(name))) {
      kinds.add(m.kind);
      continue;
    }
    if (readable && m.content?.some((re) => re.test(file.text))) {
      kinds.add(m.kind);
    }
  }
  return kinds;
}

export type VerificationState = 'verified' | 'policy_only' | 'absent';

export interface ItemVerification {
  item: EvidenceItem;
  state: VerificationState;
  /** Files that corroborate this item (ids), for the Evidence Reviewed list. */
  matchedFileIds: string[];
  /** Human-readable reason, always traceable to a real file or its absence. */
  reason: string;
}

export interface AreaVerification {
  code: string;
  area: string;
  items: ItemVerification[];
  verified: number;
  policyOnly: number;
  absent: number;
  /** Critical items that are policy_only or absent — these drive RED. */
  criticalGaps: number;
}

export interface VerificationResult {
  areas: AreaVerification[];
  totals: {
    items: number;
    verified: number;
    policyOnly: number;
    absent: number;
    criticalGaps: number;
  };
}

/**
 * Does the vault contain a policy for this area? A `document` (policy) item is
 * "verified" if any file classified to the area looks like a policy, i.e. it is
 * readable and not obviously a record/log/form. We treat an area-classified,
 * readable file that matches NO record kind as the area's policy document —
 * this is exactly the class the reader's signal engine scores in depth.
 */
function areaHasPolicy(areaFiles: Array<{ file: VerifiableFile; kinds: Set<EvidenceKind> }>): boolean {
  return areaFiles.some(
    ({ file, kinds }) => file.text.trim().length > 0 && kinds.size === 0,
  );
}

/**
 * Verify a set of requested evidence items against the vault. Pure: same files
 * in → same result out. Files are matched to an item by (a) the item's expected
 * record kind being detected on a file, AND (b) the file being classified to the
 * same area — so a training matrix under Safeguarding doesn't satisfy Medicines.
 */
export function verifyEvidence(files: VerifiableFile[]): VerificationResult {
  const list: EvidenceRequestArea[] = evidenceRequestList();

  // Pre-compute each file's detected kinds once.
  const enriched = files.map((file) => ({ file, kinds: detectKinds(file) }));

  const areas: AreaVerification[] = list.map((reqArea) => {
    const areaFiles = enriched.filter((e) => e.file.areaCode === reqArea.code);
    const hasPolicy = areaHasPolicy(areaFiles);

    const items: ItemVerification[] = reqArea.items.map((item) => {
      if (item.kind === 'document') {
        // Policy items: verified if the area has a readable policy document.
        if (hasPolicy) {
          const policyFile = areaFiles.find(
            (e) => e.file.text.trim().length > 0 && e.kinds.size === 0,
          );
          return {
            item,
            state: 'verified',
            matchedFileIds: policyFile ? [policyFile.file.id] : [],
            reason: `Policy document present in the vault for ${reqArea.area}.`,
          };
        }
        return {
          item,
          state: areaFiles.length > 0 ? 'policy_only' : 'absent',
          matchedFileIds: [],
          reason:
            areaFiles.length > 0
              ? `Files exist for ${reqArea.area} but no readable policy document was identified — supply the current policy.`
              : `No ${reqArea.area} policy has been supplied.`,
        };
      }

      // Record items: need a file OF THE EXPECTED KIND in this area.
      const matches = areaFiles.filter((e) => e.kinds.has(item.kind as EvidenceKind));
      if (matches.length > 0) {
        return {
          item,
          state: 'verified',
          matchedFileIds: matches.map((m) => m.file.id),
          reason: `Corroborating ${item.kind} present: ${matches
            .map((m) => `"${m.file.fileName}"`)
            .slice(0, 3)
            .join(', ')}${matches.length > 3 ? ` (+${matches.length - 3} more)` : ''}.`,
        };
      }

      // No matching record. Distinguish "policy but no proof" from "nothing".
      const state: VerificationState = hasPolicy ? 'policy_only' : 'absent';
      return {
        item,
        state,
        matchedFileIds: [],
        reason:
          state === 'policy_only'
            ? `Policy addresses this, but the supporting ${item.kind} ("${item.label}") was not supplied — it cannot be verified in practice.`
            : `Not supplied: ${item.label}.`,
      };
    });

    const verified = items.filter((i) => i.state === 'verified').length;
    const policyOnly = items.filter((i) => i.state === 'policy_only').length;
    const absent = items.filter((i) => i.state === 'absent').length;
    const criticalGaps = items.filter(
      (i) => i.item.critical && i.state !== 'verified',
    ).length;

    return { code: reqArea.code, area: reqArea.area, items, verified, policyOnly, absent, criticalGaps };
  });

  const totals = areas.reduce(
    (acc, a) => ({
      items: acc.items + a.items.length,
      verified: acc.verified + a.verified,
      policyOnly: acc.policyOnly + a.policyOnly,
      absent: acc.absent + a.absent,
      criticalGaps: acc.criticalGaps + a.criticalGaps,
    }),
    { items: 0, verified: 0, policyOnly: 0, absent: 0, criticalGaps: 0 },
  );

  return { areas, totals };
}
