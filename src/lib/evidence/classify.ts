export const KEYWORD_MAP: Array<{ keywords: RegExp; areaCode: string }> = [
  { keywords: /(statement of purpose|purpose statement|registration statement)/i, areaCode: '01' },
  { keywords: /(safeguard|safeguarding|abuse|concern)/i, areaCode: '02' },
  { keywords: /(capacity|consent|mca|best interest|best interests)/i, areaCode: '03' },
  { keywords: /(risk assessment|risk management|care plan|person[- ]centred|risk register)/i, areaCode: '04' },
  { keywords: /(lone working|worker safety|driver safety|field worker)/i, areaCode: '05' },
  { keywords: /(medicines|medication|mar chart|mar|controlled drug|drug log)/i, areaCode: '06' },
  { keywords: /(complaint|feedback|service user feedback)/i, areaCode: '08' },
  { keywords: /(duty of candour|candour|apology)/i, areaCode: '09' },
  { keywords: /(governance|quality assurance|audit log|policy register|oversight)/i, areaCode: '10' },
  { keywords: /(training matrix|supervision|appraisal|staffing|rota|induction)/i, areaCode: '11' },
  { keywords: /(dbs|recruitment|references|fit and proper|right to work)/i, areaCode: '12' },
  { keywords: /(gdpr|data protection|privacy|confidentiality|subject access|dpa)/i, areaCode: '13' },
  { keywords: /(health and safety|fire risk|incident log|coshh|riddor|emergency plan)/i, areaCode: '14' },
  { keywords: /(infection|ipc|ppe|hand hygiene|cleaning schedule|decontamination)/i, areaCode: '15' },
  { keywords: /(notification|cqc notification|statutory notification|death notification)/i, areaCode: '16' },
  { keywords: /(business continuity|contingency|emergency planning|continuity plan)/i, areaCode: '17' },
  { keywords: /(dignity|equality|rights|privacy|respect|human rights)/i, areaCode: '18' },
];

export function inferEvidenceAreaCode(fileName: string, contentHint?: string | null): string | null {
  const haystack = `${fileName} ${contentHint ?? ''}`;
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.test(haystack)) return entry.areaCode;
  }
  return null;
}

/**
 * How strongly a document's text reads like the expected compliance area.
 * Counts distinct keyword-group hits for that area against how many groups it
 * has, so a safeguarding policy scores high on area 02 and near-zero elsewhere.
 * Returns 0..1. Used by content verification to confirm document identity.
 */
export function areaIdentityScore(text: string, areaCode: string): number {
  const entries = KEYWORD_MAP.filter((e) => e.areaCode === areaCode);
  if (entries.length === 0 || !text) return 0;
  const hits = entries.filter((e) => e.keywords.test(text)).length;
  return hits / entries.length;
}
