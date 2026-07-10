import 'server-only';

/**
 * SAF ↔ document crosswalk.
 *
 * Maps a SAF interview question to the library reference(s) that underpin it.
 * The engine uses this for a safe negative inference: if the underlying
 * document is missing from the checklist, the SAF question cannot be met, so
 * the engine suggests "No" with a reason. When the document is present the
 * engine stays silent — presence alone doesn't prove the operational practice,
 * so a human confirms those.
 *
 * Only high-confidence document→question links are listed. Questions about
 * observation, timings or thresholds with no single backing document are left
 * out on purpose.
 */
export const SAF_DOCUMENT_CROSSWALK: Record<number, string[]> = {
  1: ['SG-03'], // Whistleblowing policy signed by staff
  2: ['SC-07'], // Safety incidents reviewed in management meeting (incident log)
  5: ['SG-09'], // Level 2 safeguarding training / competency
  7: ['SC-03'], // Positive risk-taking assessments
  8: ['SC-03'], // Dynamic risk assessments
  9: ['HS-03'], // Fire safety checks (fire risk assessment)
  13: ['IP-03'], // Weekly IPC audits
  15: ['MM-10'], // MAR chart audits (medicines audit tool)
  16: ['MM-14'], // Controlled drugs reconciled (CD register)
  17: ['PC-03'], // Comprehensive needs assessments
  22: ['DP-01'], // GDPR-compliant sharing system (data protection policy)
  27: ['CM-03'], // Mental Capacity Assessments filed
  28: ['CM-04'], // Best Interests Decisions recorded
  40: ['PC-05'], // Care plan reviews with the person present
  45: ['CP-04'], // Complaint response logs (complaints register)
  52: ['CM-02'], // ADRTs (MCA & DoLS policy)
  53: ['RG-01'], // Statement of Purpose reviewed annually
  57: ['SG-03'], // External whistleblowing route
  61: ['GV-08'], // Mock inspection / records audit
  67: [], // environmental policy — no library doc, left manual
};

/**
 * Given the applied checklist (ref → status), returns SAF question ids that
 * should be suggested "No" because a backing document is missing, with a reason.
 */
export function inferSafNegatives(
  itemStatusByRef: Map<string, string>,
): { questionId: number; reason: string }[] {
  const out: { questionId: number; reason: string }[] = [];
  for (const [questionId, refs] of Object.entries(SAF_DOCUMENT_CROSSWALK)) {
    if (refs.length === 0) continue;
    const missing = refs.filter((ref) => {
      const status = itemStatusByRef.get(ref);
      return status === 'missing' || status === 'out_of_date';
    });
    if (missing.length > 0) {
      out.push({
        questionId: Number(questionId),
        reason: `Underlying document ${missing.join(', ')} is not evidenced, so this cannot currently be met.`,
      });
    }
  }
  return out;
}
