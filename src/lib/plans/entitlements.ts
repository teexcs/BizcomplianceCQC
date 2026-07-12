import type { PlanId } from '@/lib/stripe/plans';

/**
 * Plan entitlements — the single source of truth for what each tier unlocks.
 *
 * Every feature gate in the app (dashboard nav, server-action quotas, engine
 * automation) reads from here. Change a number in this file and it propagates
 * to the pricing table, the dashboard, and enforcement — no other edits needed.
 *
 * `tier: 'none'` is the pay-as-you-go state: a provider who bought a one-off
 * audit but has no active monthly subscription. They keep their report and any
 * issued documents; ongoing features require a plan.
 */

export type PlanTier = 'none' | 'essentials' | 'professional' | 'partner';

export type ReAuditCadence = 'none' | 'quarterly';

export interface Entitlements {
  tier: PlanTier;
  label: string;
  /** Rank for "requires at least" comparisons. */
  rank: number;

  // --- Vault & records (all payers) ---
  documentVault: boolean;
  auditReport: boolean;

  // --- Ongoing compliance (subscription) ---
  complianceCalendar: boolean;
  regulatoryAlerts: boolean;
  documentReviewCycles: boolean;

  // --- Requests ---
  /** Founder-handled document/support requests allowed per calendar month. */
  docRequestsPerMonth: number;

  // --- Higher tiers ---
  evidenceReviewFeedback: boolean; // auditor annotates uploaded evidence
  safPrep: boolean; // mock SAF interview preparation sheet
  /** Library documents issued with [PLACEHOLDER]s auto-filled from the org record. */
  personalisedDocuments: boolean;
  reAudit: ReAuditCadence; // automated re-audit cadence
  complianceCall: 'none' | 'quarterly';
  siteVisitPerQuarter: number;

  // --- Partner / multi-site ---
  workspaces: number;
  whiteLabelReports: boolean;
  bulkTooling: boolean;
  partnerDirectory: boolean;

  // --- Support ---
  supportSla: string;
  prioritySupport: boolean;
}

const BASE: Omit<Entitlements, 'tier' | 'label' | 'rank'> = {
  documentVault: true,
  auditReport: true,
  complianceCalendar: false,
  regulatoryAlerts: false,
  documentReviewCycles: false,
  docRequestsPerMonth: 0,
  evidenceReviewFeedback: false,
  safPrep: false,
  personalisedDocuments: false,
  reAudit: 'none',
  complianceCall: 'none',
  siteVisitPerQuarter: 0,
  workspaces: 1,
  whiteLabelReports: false,
  bulkTooling: false,
  partnerDirectory: false,
  supportSla: 'Email support',
  prioritySupport: false,
};

export const ENTITLEMENTS: Record<PlanTier, Entitlements> = {
  none: {
    ...BASE,
    tier: 'none',
    label: 'Pay-as-you-go',
    rank: 0,
    supportSla: '7 days of clarification after each audit',
  },
  essentials: {
    ...BASE,
    tier: 'essentials',
    label: 'Essentials',
    rank: 1,
    complianceCalendar: true,
    regulatoryAlerts: true,
    documentReviewCycles: true,
    docRequestsPerMonth: 2,
    siteVisitPerQuarter: 0,
    supportSla: 'Email support — 48-hour response',
  },
  professional: {
    ...BASE,
    tier: 'professional',
    label: 'Professional',
    rank: 2,
    complianceCalendar: true,
    regulatoryAlerts: true,
    documentReviewCycles: true,
    docRequestsPerMonth: 6,
    evidenceReviewFeedback: true,
    safPrep: true,
    personalisedDocuments: true,
    reAudit: 'quarterly',
    complianceCall: 'quarterly',
    siteVisitPerQuarter: 1,
    supportSla: 'Email support — 24-hour response',
  },
  partner: {
    ...BASE,
    tier: 'partner',
    label: 'Partner',
    rank: 3,
    complianceCalendar: true,
    regulatoryAlerts: true,
    documentReviewCycles: true,
    docRequestsPerMonth: 999, // effectively unlimited
    evidenceReviewFeedback: true,
    safPrep: true,
    personalisedDocuments: true,
    reAudit: 'quarterly',
    complianceCall: 'quarterly',
    siteVisitPerQuarter: 2,
    workspaces: 5,
    whiteLabelReports: true,
    bulkTooling: true,
    partnerDirectory: true,
    supportSla: 'Priority support',
    prioritySupport: true,
  },
};

/** Maps a Stripe plan id (or none) to its entitlement tier. */
export function tierForPlan(planId: PlanId | null | undefined): PlanTier {
  switch (planId) {
    case 'essentials':
      return 'essentials';
    case 'professional':
      return 'professional';
    case 'partner':
      return 'partner';
    // 'audit' is a one-off product, not a subscription tier.
    default:
      return 'none';
  }
}

export function entitlementsFor(planId: PlanId | null | undefined): Entitlements {
  return ENTITLEMENTS[tierForPlan(planId)];
}

export function siteVisitQuotaForPlan(planId: PlanId | null | undefined): number {
  return entitlementsFor(planId).siteVisitPerQuarter;
}

/** True if `tier` meets or exceeds `required`. */
export function tierAtLeast(tier: PlanTier, required: PlanTier): boolean {
  return ENTITLEMENTS[tier].rank >= ENTITLEMENTS[required].rank;
}

/** Human-readable request quota (handles the "unlimited" sentinel). */
export function formatQuota(n: number): string {
  return n >= 999 ? 'Unlimited' : String(n);
}

export function siteVisitQuotaLabel(n: number): string {
  if (n <= 0) return 'No site visits';
  return `${n} site visit${n === 1 ? '' : 's'} per quarter`;
}

/**
 * Structured, presentation-agnostic feature matrix used by the pricing page
 * comparison table and the dashboard "Your plan" panel. Grouped by section.
 */
export interface FeatureRow {
  label: string;
  /** Renders per tier: true/false = check/dash, string = literal value. */
  value: (e: Entitlements) => boolean | string;
}

export interface FeatureGroup {
  group: string;
  rows: FeatureRow[];
}

export const FEATURE_MATRIX: FeatureGroup[] = [
  {
    group: 'Compliance workspace',
    rows: [
      { label: 'Secure document vault', value: (e) => e.documentVault },
      { label: 'CQC readiness report access', value: (e) => e.auditReport },
      { label: 'Compliance calendar & deadlines', value: (e) => e.complianceCalendar },
      { label: '12-month document review cycles', value: (e) => e.documentReviewCycles },
      { label: 'CQC regulatory alerts', value: (e) => e.regulatoryAlerts },
    ],
  },
  {
    group: 'Ongoing support',
    rows: [
      {
        label: 'Document requests / month',
        value: (e) => (e.docRequestsPerMonth > 0 ? formatQuota(e.docRequestsPerMonth) : false),
      },
      { label: 'Auditor evidence-review feedback', value: (e) => e.evidenceReviewFeedback },
      { label: 'Mock SAF interview prep sheet', value: (e) => e.safPrep },
      {
        label: 'Issued documents personalised to your service',
        value: (e) => (e.personalisedDocuments ? 'Personalised' : 'Template'),
      },
      {
        label: 'Automated re-audit',
        value: (e) => (e.reAudit === 'quarterly' ? 'Quarterly' : false),
      },
      {
        label: 'Compliance call',
        value: (e) => (e.complianceCall === 'quarterly' ? 'Quarterly' : false),
      },
      {
        label: 'Site visit',
        value: (e) => (e.siteVisitPerQuarter > 0 ? siteVisitQuotaLabel(e.siteVisitPerQuarter) : false),
      },
    ],
  },
  {
    group: 'Scale & brand',
    rows: [
      { label: 'Service workspaces', value: (e) => formatQuota(e.workspaces) },
      { label: 'White-label reports', value: (e) => e.whiteLabelReports },
      { label: 'Bulk evidence tooling', value: (e) => e.bulkTooling },
      { label: 'Partner directory listing', value: (e) => e.partnerDirectory },
    ],
  },
  {
    group: 'Support',
    rows: [{ label: 'Support', value: (e) => e.supportSla }],
  },
];
