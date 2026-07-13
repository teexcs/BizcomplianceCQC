/**
 * Self-test for the findings library: full coverage, clean interpolation, and
 * regulator-grade wording for every area × gap type.
 *   npx tsx scripts/findings-library-selftest.mts
 */
import { resolveFinding, findingsLibrary, type GapType } from '@/lib/audit/findings-library';
import { AREAS } from '@/lib/engine/reader/manifest.mjs';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const areaCodes = Object.keys(AREAS as Record<string, string>);
const gaps: GapType[] = [
  'missing',
  'out_of_date',
  'template',
  'policy_only',
  'sample_partial',
  'sample_not_compliant',
];

check('18 areas present', areaCodes.length === 18, `${areaCodes.length}`);

// Every area × gap resolves with no leftover placeholders and non-empty fields.
let leftover = 0;
for (const area of areaCodes) {
  for (const gap of gaps) {
    const r = resolveFinding(area, gap, 'Test Subject Policy');
    const blob = `${r.title} ${r.detail} ${r.recommendation}`;
    if (/\{subject\}|\{area\}|\{reg\}/.test(blob)) {
      leftover++;
      console.error(`  ✗ leftover placeholder in ${area}/${gap}`);
    }
    if (!r.title || !r.detail || !r.recommendation) {
      fail++;
      console.error(`  ✗ empty field in ${area}/${gap}`);
    }
    // "Here's what to add" convention in recommendations.
    if (!/here’s what to add|here's what to add/i.test(r.recommendation)) {
      fail++;
      console.error(`  ✗ recommendation missing "Here's what to add" in ${area}/${gap}`);
    }
  }
}
check('no leftover {placeholders} anywhere', leftover === 0, `${leftover} found`);

// Regulator voice: a missing critical area should cite a regulation.
const sg = resolveFinding('02', 'missing', 'Safeguarding Adults Policy');
check('safeguarding cites Regulation 13', /regulation\s*13/i.test(sg.detail), sg.detail);
check('safeguarding missing is RED / fix_first', sg.severity === 'red' && sg.priority === 'fix_first');

const meds = resolveFinding('06', 'policy_only', 'Medicines policy');
check('medicines policy_only mentions MAR', /mar/i.test(meds.recommendation), meds.recommendation);

// Subject interpolation actually lands.
const subj = resolveFinding('04', 'out_of_date', 'Risk Management Policy');
check('subject interpolated into detail', subj.detail.includes('Risk Management Policy'), subj.detail);

// Full flattened library is complete for the picker.
const lib = findingsLibrary();
check('library has 18×6 = 108 entries', lib.length === 108, `${lib.length}`);
check('every entry has a resolved preview title', lib.every((e) => e.preview.title.length > 0));

console.log('\nSample — 02 Safeguarding, missing:');
console.log(`  Title: ${sg.title}`);
console.log(`  Detail: ${sg.detail}`);
console.log(`  Recommendation: ${sg.recommendation}`);

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
