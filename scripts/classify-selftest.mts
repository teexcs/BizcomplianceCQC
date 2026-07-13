/**
 * Proof that "let the system decide" routes documents by title AND content.
 * Tests the vendored reader classifier that classifyEvidenceArea() wraps
 * (avoids pulling server-only deps into the test).
 *   npx tsx scripts/classify-selftest.mts
 */
// @ts-expect-error — .mjs vendored module, typed loosely for the test
import { classify } from '@/lib/engine/reader/lib/classify.mjs';

function classifyArea(fileName: string, text: string): string | null {
  const doc = {
    path: fileName,
    relPath: fileName,
    fileName,
    ext: (fileName.split('.').pop() ?? '').toLowerCase(),
    readable: text.trim().length > 0,
    lines: text.replace(/\r\n?/g, '\n').split('\n'),
    charCount: text.length,
    warning: null,
  };
  return (classify(doc) as { area: string | null }).area ?? null;
}

let pass = 0;
let fail = 0;
function check(name: string, got: string | null, expect: string) {
  if (got === expect) {
    pass++;
    console.log(`  ✓ ${name} → ${got}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} → got ${got}, expected ${expect}`);
  }
}

check(
  'neutral name, safeguarding content',
  classifyArea(
    'Document1.docx',
    'This policy sets out our approach to safeguarding adults. Regulation 13 requires us to protect people from abuse. Types of abuse include physical, financial and neglect. Concerns are referred to the local authority under section 42. A whistleblowing route is available.',
  ),
  '02',
);

check(
  'neutral name, medicines content',
  classifyArea(
    'scan0002.pdf',
    'Medicines management procedure. MAR charts must be completed for every administration. PRN protocols apply. Controlled drugs are stored securely. Staff medicines competency is assessed. Medication errors are reported.',
  ),
  '06',
);

check('filename ref SG-01', classifyArea('SG-01 Safeguarding Adults Policy.docx', ''), '02');

check(
  'ambiguous name, strong safeguarding content',
  classifyArea(
    'policy final v2.docx',
    'Safeguarding adults from abuse and improper treatment. Regulation 13. Section 42 enquiries. Designated safeguarding lead. Whistleblowing. Types of abuse: physical, sexual, financial, neglect, domestic abuse.',
  ),
  '02',
);

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
