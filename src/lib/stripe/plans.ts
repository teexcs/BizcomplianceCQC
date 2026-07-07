export type PlanId = 'audit' | 'essentials' | 'professional' | 'partner';

export interface Plan {
  id: PlanId;
  name: string;
  priceGbp: number;
  cadence: 'one-off' | 'monthly';
  stripePriceIdEnv: string;
  description: string;
  features: string[];
  popular?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  audit: {
    id: 'audit',
    name: 'CQC Readiness Audit',
    priceGbp: 349,
    cadence: 'one-off',
    stripePriceIdEnv: 'STRIPE_PRICE_AUDIT_ONEOFF',
    description:
      'A personalised manual review of your CQC readiness — evidence, risks and improvement priorities across all 18 compliance areas.',
    features: [
      'Full review across the 18 CQC compliance areas (139 evidence points)',
      'Assessment against Safe, Effective, Caring, Responsive and Well-led',
      'Red / amber / green risk-rated findings per area',
      'Personalised CQC readiness score',
      'Priority action plan (fix-first, 7-day, 14-day)',
      'Professional PDF audit report',
      'Compliance documents issued for your critical gaps',
      '7 days of clarification after delivery',
    ],
  },
  essentials: {
    id: 'essentials',
    name: 'Essentials',
    priceGbp: 49,
    cadence: 'monthly',
    stripePriceIdEnv: 'STRIPE_PRICE_ESSENTIALS_MONTHLY',
    description:
      'Ongoing compliance cover for small domiciliary and supported-living providers.',
    features: [
      'Issued policies and documents kept current for 12-month review cycles',
      'Compliance calendar with statutory deadline reminders',
      'CQC regulatory alerts digest',
      'Document vault with version history',
      'Up to 2 document requests per month',
      'Email support — 48-hour response',
    ],
    popular: true,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    priceGbp: 99,
    cadence: 'monthly',
    stripePriceIdEnv: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
    description:
      'For registered managers who want continuous inspection readiness, not just paperwork.',
    features: [
      'Everything in Essentials',
      'Quarterly re-audit with updated readiness score',
      'Evidence vault reviews with feedback from your auditor',
      'Priority document requests (up to 6 per month)',
      'Mock SAF interview preparation sheet',
      'Quarterly 30-minute compliance call',
      'Email support — 24-hour response',
    ],
  },
  partner: {
    id: 'partner',
    name: 'Partner',
    priceGbp: 249,
    cadence: 'monthly',
    stripePriceIdEnv: 'STRIPE_PRICE_PARTNER_MONTHLY',
    description:
      'For care consultants and franchise operators supporting multiple CQC-registered services.',
    features: [
      'Up to five service workspaces',
      'White-label audit reports',
      'Bulk evidence review tooling',
      'All document packs included',
      'Quarterly partner strategy call',
      'Priority support',
    ],
  },
};

export function getStripePriceId(planId: PlanId): string {
  const plan = PLANS[planId];
  const priceId = process.env[plan.stripePriceIdEnv];
  if (!priceId) {
    throw new Error(
      `Missing Stripe price ID for plan "${planId}" — set ${plan.stripePriceIdEnv} in env`,
    );
  }
  return priceId;
}
