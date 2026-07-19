/**
 * Local-only regression test for the deterministic evidence reader.
 *
 * Run with:
 *   node scripts/evidence-engine-selftest.mjs
 */
import { classify } from '../src/lib/engine/reader/lib/classify.mjs';
import { analyzeDocument } from '../src/lib/engine/reader/lib/analyze.mjs';

function makeDoc(fileName, text) {
  return {
    path: fileName,
    relPath: fileName,
    fileName,
    ext: fileName.split('.').pop()?.toLowerCase() ?? '',
    readable: text.trim().length > 0,
    lines: text.replace(/\r\n?/g, '\n').split('\n'),
    charCount: text.length,
    warning: null,
  };
}

function inspect(fileName, text) {
  const doc = makeDoc(fileName, text);
  const classification = classify(doc);
  const analysis = analyzeDocument(doc, classification);
  const found = analysis.signals.filter((s) => s.found);
  const critical = analysis.signals.filter((s) => s.weight === 'critical');
  const criticalFound = critical.filter((s) => s.found);
  return {
    area: classification.area,
    found: found.length,
    criticalFound: criticalFound.length,
    criticalTotal: critical.length,
    labels: found.map((s) => s.label),
  };
}

let pass = 0;
let fail = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  OK ${name}`);
  } else {
    fail++;
    console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

{
  const r = inspect(
    'Document1.docx',
    'This policy sets out our approach to safeguarding adults. Regulation 13 requires us to protect people from abuse. Types of abuse include physical, financial and neglect. Concerns are referred to the local authority under section 42. A whistleblowing route is available.',
  );
  check('neutral safeguarding content routes to area 02', r.area === '02', JSON.stringify(r));
  check('safeguarding has strong critical coverage', r.criticalFound >= 4, JSON.stringify(r));
}

{
  const r = inspect(
    'scan0002.pdf',
    'Medicines management procedure. Medicine administration records must be completed for every administration. PRN protocols apply. Controlled drugs are stored securely. Staff medicines competency is assessed. Medication errors are reported.',
  );
  check('medicine administration record wording routes to area 06', r.area === '06', JSON.stringify(r));
  check('medicines evidence includes MAR signal', r.labels.some((x) => /MAR charts/i.test(x)), r.labels.join(', '));
}

{
  const r = inspect(
    'staff onboarding evidence.docx',
    'Before employment starts the provider completes Regulation 19 fit and proper person checks. The file includes passport identity evidence, a right to work share code, full employment history with gaps explained, two written references checked by the manager, and an enhanced criminal record disclosure including barred list information.',
  );
  check('recruitment wording variations route to area 12', r.area === '12', JSON.stringify(r));
  check('recruitment catches DBS without DBS acronym', r.labels.some((x) => /DBS/i.test(x)), r.labels.join(', '));
}

{
  const r = inspect(
    'notes.docx',
    'The manager discussed quality, training, records and general safety at the team meeting.',
  );
  check('weak mixed terms stay unclassified', r.area === null, JSON.stringify(r));
}

{
  const r = inspect(
    'Children safeguarding wrong service.docx',
    'Child Protection Policy. This policy follows Keeping Children Safe in Education, LADO, Section 47, Ofsted and Working Together to Safeguard Children.',
  );
  check('children safeguarding framework is not credited as adult safeguarding', r.area === null, JSON.stringify(r));
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
