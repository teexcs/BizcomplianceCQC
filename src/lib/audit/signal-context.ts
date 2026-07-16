/**
 * Signal context — service-type awareness for gaps.
 *
 * The engine's rulebook covers the full breadth of adult social care. Some
 * critical signals are genuinely NOT expected for a standard domiciliary
 * (care-at-home) provider unless the service does something specific — e.g.
 * physical restraint controls, or the Oliver McGowan LD/autism specifics apply
 * most sharply where those needs are supported. Flagging these as hard
 * "critical gaps" for every provider is misleading and undermines trust.
 *
 * This app-layer map marks such signals as SITUATIONAL: still surfaced, but as
 * "consider if this applies to your service" rather than a firm breach. It
 * never hides anything — it re-frames, so the report reads as considered rather
 * than alarmist. Matching is on the signal LABEL text (stable), so no coupling
 * to the vendored rule ids.
 */

/** Patterns that identify a signal as situational for standard domiciliary care. */
const SITUATIONAL_LABEL_PATTERNS: RegExp[] = [
  /restraint|restrictive practice|physical intervention/i, // Reg 13(4)(b) — only if restrictive practice used
  /oliver mcgowan/i, // statutory but scoped to LD/autism support
  /peg feed|catheter|stoma|insulin|delegated (healthcare|clinical)/i, // delegated clinical tasks
  /dnacpr|do not attempt|respect (form|process)|advance decision/i, // end-of-life specifics
  /loler|puwer|equipment servic/i, // only if the service provides equipment
  /closed culture/i, // more a care-home risk
  /sexual safety|sexualised behaviour/i, // situational
  /covert/i, // covert medication — only if used
  /controlled drug|misuse of drugs/i, // only if CDs handled
  /pressure (ulcer|sore|damage|area)|waterlow|tissue viability/i, // clinical, situational
  /dysphagia|iddsi/i, // only where eating/drinking support with swallowing risk
];

export function isSituationalSignal(label: string): boolean {
  return SITUATIONAL_LABEL_PATTERNS.some((re) => re.test(label));
}

/**
 * Split an area's not-found signals into firm gaps vs situational prompts.
 * `weight` is preserved; situational items are simply routed to `situational`.
 */
export function partitionGaps<T extends { label: string; weight: 'critical' | 'expected' }>(
  notFound: T[],
): { firm: T[]; situational: T[] } {
  const firm: T[] = [];
  const situational: T[] = [];
  for (const g of notFound) {
    if (isSituationalSignal(g.label)) situational.push(g);
    else firm.push(g);
  }
  return { firm, situational };
}
