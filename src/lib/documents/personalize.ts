import 'server-only';
import { patchDocument, PatchType, TextRun, type IPatch } from 'docx';
import type { Organisation } from '@/types/database';

/**
 * Personalise a library .docx for one organisation — the Professional-plan
 * benefit. Fills the library's [PLACEHOLDER] convention from the org record:
 * anything we can't answer from data (e.g. [AMOUNT]) is left as a placeholder
 * for the provider, exactly as the Essentials template would be.
 *
 * Uses docx's patchDocument with [ ] delimiters, which correctly handles
 * placeholders split across Word formatting runs.
 */

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Values we can truthfully assert about the org; keys are the [BRACKET] inner text. */
export function buildOrgPatchValues(
  org: Organisation,
  registeredManager: string | null,
): Record<string, string> {
  const now = new Date();
  const review = new Date(now);
  review.setFullYear(review.getFullYear() + 1);

  const address = [org.address_line1, org.address_line2, org.city, org.postcode]
    .filter(Boolean)
    .join(', ');

  const values: Record<string, string> = {
    'PROVIDER NAME': org.name,
    'SERVICE NAME': org.name,
    'COMPANY NAME': org.name,
    'ORGANISATION NAME': org.name,
    DATE: fmtDate(now),
    'ISSUE DATE': fmtDate(now),
    'EFFECTIVE DATE': fmtDate(now),
    'REVIEW DATE': fmtDate(review),
    'NEXT REVIEW DATE': fmtDate(review),
    YEAR: String(now.getFullYear()),
  };
  if (address) {
    values.ADDRESS = address;
    values['REGISTERED ADDRESS'] = address;
    values['REGISTERED OFFICE'] = address;
  }
  if (org.phone) {
    values.PHONE = org.phone;
    values.TELEPHONE = org.phone;
    values['PHONE NUMBER'] = org.phone;
  }
  if (org.cqc_provider_id) values['CQC PROVIDER ID'] = org.cqc_provider_id;
  if (org.cqc_location_id) values['CQC LOCATION ID'] = org.cqc_location_id;
  if (registeredManager) {
    values['REGISTERED MANAGER'] = registeredManager;
    values['MANAGER NAME'] = registeredManager;
    values['REGISTERED MANAGER NAME'] = registeredManager;
  }
  return values;
}

/**
 * Returns the personalised .docx, or null on any failure — callers fall back
 * to issuing the original template so personalisation can never block an issue.
 */
export async function personalizeDocx(
  original: Buffer,
  values: Record<string, string>,
): Promise<Buffer | null> {
  try {
    const patches: Record<string, IPatch> = {};
    for (const [key, value] of Object.entries(values)) {
      patches[key] = {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(value)],
      };
    }
    const out = await patchDocument({
      outputType: 'nodebuffer',
      data: original,
      patches,
      placeholderDelimiters: { start: '[', end: ']' },
      keepOriginalStyles: true,
    });
    return Buffer.from(out);
  } catch (e) {
    console.error('[personalize] docx patch failed — issuing original template', e);
    return null;
  }
}
