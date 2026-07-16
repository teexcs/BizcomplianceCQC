/**
 * Coverage benchmark.
 *
 * Compares a provider's per-area critical-signal coverage to a reference
 * baseline, so the report can say "your safeguarding coverage is above / below
 * a typical domiciliary provider". The baseline starts as a defensible expected
 * standard and is intended to be replaced by real aggregated data as audits
 * accumulate — the shape is stable so that swap needs no downstream change.
 *
 * Pure and honest: it never invents a comparison; where no baseline exists for
 * an area it simply reports the provider's own coverage without a verdict.
 */
import { AREAS } from '@/lib/engine/reader/manifest.mjs';

const AREA_NAME = AREAS as Record<string, string>;

/**
 * Reference baseline: the share of an area's critical CQC signals a
 * well-prepared domiciliary provider would typically evidence. Deliberately
 * conservative so "above baseline" is a meaningful, earned statement. Tune per
 * area as real data is gathered; default applies where unset.
 */
const BASELINE_COVERAGE: Record<string, number> = {
  '01': 0.7, // Registration & SoP
  '02': 0.75, // Safeguarding
  '03': 0.7, // Consent & MCA
  '04': 0.7, // Safe care & risk
  '06': 0.7, // Medicines
  '09': 0.65, // Duty of candour
  '10': 0.65, // Governance
  '12': 0.75, // Safe recruitment
  '16': 0.6, // Notifications
};
const DEFAULT_BASELINE = 0.6;

export type BenchmarkVerdict = 'above' | 'in_line' | 'below';

export interface AreaBenchmark {
  areaCode: string;
  areaName: string;
  /** Provider's critical coverage 0–1. */
  coverage: number;
  criticalProven: number;
  criticalTotal: number;
  baseline: number;
  verdict: BenchmarkVerdict;
}

export interface CoverageBenchmark {
  areas: AreaBenchmark[];
  aboveCount: number;
  belowCount: number;
}

export interface AreaCoverageInput {
  areaCode: string;
  criticalProven: number;
  criticalTotal: number;
}

/** Build the benchmark from per-area critical coverage (e.g. from EvidenceProof). */
export function buildBenchmark(areas: AreaCoverageInput[]): CoverageBenchmark {
  const out: AreaBenchmark[] = [];
  for (const a of areas) {
    if (a.criticalTotal === 0) continue;
    const coverage = a.criticalProven / a.criticalTotal;
    const baseline = BASELINE_COVERAGE[a.areaCode] ?? DEFAULT_BASELINE;
    // A margin band so we don't over-claim on a knife-edge.
    let verdict: BenchmarkVerdict;
    if (coverage >= baseline + 0.1) verdict = 'above';
    else if (coverage <= baseline - 0.1) verdict = 'below';
    else verdict = 'in_line';
    out.push({
      areaCode: a.areaCode,
      areaName: AREA_NAME[a.areaCode] ?? `Area ${a.areaCode}`,
      coverage,
      criticalProven: a.criticalProven,
      criticalTotal: a.criticalTotal,
      baseline,
      verdict,
    });
  }
  out.sort((x, y) => x.areaCode.localeCompare(y.areaCode));
  return {
    areas: out,
    aboveCount: out.filter((a) => a.verdict === 'above').length,
    belowCount: out.filter((a) => a.verdict === 'below').length,
  };
}

export const VERDICT_LABEL: Record<BenchmarkVerdict, string> = {
  above: 'Above baseline',
  in_line: 'In line',
  below: 'Below baseline',
};
