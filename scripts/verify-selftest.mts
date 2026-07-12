/**
 * Self-test for the evidence-verification layer. Not a unit-test framework —
 * a runnable proof that the layer behaves on realistic inputs. Run:
 *   npx tsx scripts/verify-selftest.mts
 */
import { verifyEvidence, type VerifiableFile } from '@/lib/audit/verification';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Area 02 = Safeguarding. Items: policy, training matrix (critical), concerns
// log (critical), sample record (non-critical).
// Scenario A — fully evidenced: policy + matrix + log + a completed record.
const scenarioA: VerifiableFile[] = [
  { id: 'f1', fileName: 'Safeguarding Adults Policy.docx', text: 'Regulation 13 safeguarding. Types of abuse. Local authority s.42 referral. Whistleblowing.', areaCode: '02' },
  { id: 'f2', fileName: 'Safeguarding Training Matrix 2026.xlsx', text: 'Course Due Completed Expiry', areaCode: '02' },
  { id: 'f3', fileName: 'Safeguarding Concerns Register.docx', text: 'Register of concerns. Date reported.', areaCode: '02' },
  { id: 'f4', fileName: 'Completed safeguarding referral sample.pdf', text: 'referral made to local authority', areaCode: '02' },
];

// Scenario B — policy only: just the policy, no matrix/log/sample.
const scenarioB: VerifiableFile[] = [
  { id: 'g1', fileName: 'Safeguarding Adults Policy.docx', text: 'Regulation 13 safeguarding. Whistleblowing.', areaCode: '02' },
];

// Scenario C — nothing for Safeguarding at all.
const scenarioC: VerifiableFile[] = [
  { id: 'h1', fileName: 'Medicines Management Policy.docx', text: 'Safe management of medicines.', areaCode: '06' },
];

console.log('Scenario A — Safeguarding fully evidenced:');
{
  const r = verifyEvidence(scenarioA);
  const sg = r.areas.find((a) => a.code === '02')!;
  const matrix = sg.items.find((i) => i.item.kind === 'matrix')!;
  const log = sg.items.find((i) => i.item.kind === 'log')!;
  const policy = sg.items.find((i) => i.item.kind === 'document')!;
  check('policy verified', policy.state === 'verified', policy.state);
  check('training matrix verified (critical)', matrix.state === 'verified', matrix.state);
  check('concerns log verified (critical)', log.state === 'verified', log.state);
  check('no critical gaps in Safeguarding', sg.criticalGaps === 0, `gaps=${sg.criticalGaps}`);
}

console.log('Scenario B — Safeguarding policy only:');
{
  const r = verifyEvidence(scenarioB);
  const sg = r.areas.find((a) => a.code === '02')!;
  const matrix = sg.items.find((i) => i.item.kind === 'matrix')!;
  const policy = sg.items.find((i) => i.item.kind === 'document')!;
  check('policy verified', policy.state === 'verified', policy.state);
  check('training matrix = policy_only (the whole point)', matrix.state === 'policy_only', matrix.state);
  check('Safeguarding has critical gaps > 0', sg.criticalGaps > 0, `gaps=${sg.criticalGaps}`);
}

console.log('Scenario C — nothing for Safeguarding:');
{
  const r = verifyEvidence(scenarioC);
  const sg = r.areas.find((a) => a.code === '02')!;
  const policy = sg.items.find((i) => i.item.kind === 'document')!;
  const matrix = sg.items.find((i) => i.item.kind === 'matrix')!;
  check('policy absent', policy.state === 'absent', policy.state);
  check('training matrix absent (not policy_only)', matrix.state === 'absent', matrix.state);
  // Medicines policy WAS supplied — its policy item should be verified.
  const meds = r.areas.find((a) => a.code === '06')!;
  const medsPolicy = meds.items.find((i) => i.item.kind === 'document')!;
  check('Medicines policy verified from its file', medsPolicy.state === 'verified', medsPolicy.state);
}

console.log('Totals shape:');
{
  const r = verifyEvidence(scenarioA);
  check('18 areas returned', r.areas.length === 18, `${r.areas.length}`);
  check('totals.items > 0', r.totals.items > 0);
  check('verified+policyOnly+absent = items', r.totals.verified + r.totals.policyOnly + r.totals.absent === r.totals.items);
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
