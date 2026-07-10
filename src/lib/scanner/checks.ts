import 'server-only';
import type { CrawlResult } from './crawl';

/**
 * The 19 website compliance checks. Deterministic and explainable: every
 * result says what was looked for, what was found, and (in the paid report)
 * exactly how to fix it.
 */

export type CheckSeverity = 'urgent' | 'important';
export type CheckCategory = 'legal' | 'privacy' | 'transparency' | 'care' | 'security';

export interface CheckResult {
  id: string;
  label: string;
  category: CheckCategory;
  severity: CheckSeverity; // severity if failed
  passed: boolean;
  /** Free tier: one line on what was found / missing. */
  summary: string;
  /** Paid tier: the practical fix. */
  fix: string;
  /** Page where evidence was found, when it passed. */
  foundOn?: string;
}

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  legal: 'Legal pages',
  privacy: 'Privacy & cookies',
  transparency: 'Transparency & trust',
  care: 'CQC & care duties',
  security: 'Security',
};

const WEIGHTS: Record<CheckSeverity, number> = { urgent: 3, important: 1.5 };

interface PageHit {
  page: { url: string; path: string; html: string };
  index: number;
}

function findPage(crawl: CrawlResult, patterns: (string | RegExp)[]): PageHit | null {
  for (let i = 0; i < crawl.pages.length; i++) {
    const page = crawl.pages[i];
    const haystack = `${page.path.toLowerCase()} ${page.html}`;
    for (const p of patterns) {
      if (typeof p === 'string' ? haystack.includes(p) : p.test(haystack)) {
        return { page, index: i };
      }
    }
  }
  return null;
}

function findInContent(crawl: CrawlResult, patterns: (string | RegExp)[]): PageHit | null {
  for (let i = 0; i < crawl.pages.length; i++) {
    const page = crawl.pages[i];
    for (const p of patterns) {
      if (typeof p === 'string' ? page.html.includes(p) : p.test(page.html)) {
        return { page, index: i };
      }
    }
  }
  return null;
}

function pathLooksLike(crawl: CrawlResult, needles: string[]): PageHit | null {
  for (let i = 0; i < crawl.pages.length; i++) {
    const path = crawl.pages[i].path.toLowerCase();
    if (needles.some((n) => path.includes(n))) return { page: crawl.pages[i], index: i };
  }
  return null;
}

export function runChecks(crawl: CrawlResult): CheckResult[] {
  const results: CheckResult[] = [];
  const allHtml = crawl.pages.map((p) => p.html).join('\n');
  const add = (r: Omit<CheckResult, 'foundOn'> & { foundOn?: string }) => results.push(r);

  // ---------------- Legal pages ----------------
  const privacy =
    pathLooksLike(crawl, ['privacy']) ??
    findInContent(crawl, [/privacy (policy|notice)/]);
  add({
    id: 'privacy-policy',
    label: 'Privacy policy',
    category: 'legal',
    severity: 'urgent',
    passed: Boolean(privacy),
    summary: privacy
      ? `Privacy policy found at ${privacy.page.path}`
      : 'No privacy policy page was found — this is a legal requirement under UK GDPR.',
    fix: 'Publish a privacy notice covering what personal data you collect, the lawful basis, retention periods, and the ICO complaint route. Link it from every page footer. As a care provider it must cover service-user and staff data, not just website visitors.',
    foundOn: privacy?.page.url,
  });

  const terms = pathLooksLike(crawl, ['terms', 'conditions']) ?? findInContent(crawl, [/terms (and|&|of) (conditions|use|service)/]);
  add({
    id: 'terms',
    label: 'Terms & conditions',
    category: 'legal',
    severity: 'important',
    passed: Boolean(terms),
    summary: terms
      ? `Terms page found at ${terms.page.path}`
      : 'No terms & conditions page was found.',
    fix: 'Publish terms covering your service scope, fees, cancellation and liability. For care services, align the wording with your service user guide and statement of purpose.',
    foundOn: terms?.page.url,
  });

  const complaints = pathLooksLike(crawl, ['complaint']) ?? findInContent(crawl, [/complaints (policy|procedure|process)/]);
  add({
    id: 'complaints',
    label: 'Complaints information',
    category: 'legal',
    severity: 'important',
    passed: Boolean(complaints),
    summary: complaints
      ? `Complaints information found at ${complaints.page.path}`
      : 'No accessible complaints information was found — CQC Regulation 16 expects an accessible complaints system.',
    fix: 'Publish your complaints procedure (or a summary with a link to the full policy): how to complain, response timescales, and escalation to the Local Government & Social Care Ombudsman.',
    foundOn: complaints?.page.url,
  });

  const accessibility = pathLooksLike(crawl, ['accessib']) ?? findInContent(crawl, ['accessibility statement']);
  add({
    id: 'accessibility',
    label: 'Accessibility statement',
    category: 'legal',
    severity: 'important',
    passed: Boolean(accessibility),
    summary: accessibility
      ? `Accessibility statement found at ${accessibility.page.path}`
      : 'No accessibility statement was found.',
    fix: 'Publish an accessibility statement describing how your site meets WCAG 2.1 AA and how users with access needs can contact you — expected for services covered by the Accessible Information Standard.',
    foundOn: accessibility?.page.url,
  });

  // ---------------- Privacy & cookies ----------------
  const trackers =
    /googletagmanager|google-analytics|gtag\(|fbq\(|facebook\.net|hotjar|clarity\.ms|tiktok/.test(allHtml);
  const cmp =
    /cookieyes|cookiebot|onetrust|usercentrics|termly|iubenda|osano|complianz|cookie-consent|cookieconsent|cookie_notice|cookie-banner|cookie banner|accept (all )?cookies|manage cookies/.test(allHtml);
  add({
    id: 'cookie-consent',
    label: 'Cookie consent banner',
    category: 'privacy',
    severity: trackers ? 'urgent' : 'important',
    passed: cmp,
    summary: cmp
      ? 'A cookie consent mechanism was detected.'
      : trackers
        ? 'Tracking scripts run on your site but no cookie consent mechanism was detected — consent is required before non-essential cookies (PECR).'
        : 'No cookie consent mechanism was detected.',
    fix: 'Install a consent management platform (e.g. CookieYes, Cookiebot) configured to block analytics/marketing scripts until the visitor consents, with an equal-prominence reject option.',
  });

  const cookiePolicy = pathLooksLike(crawl, ['cookie']) ?? findInContent(crawl, [/cookie (policy|notice)/]);
  add({
    id: 'cookie-policy',
    label: 'Cookie policy',
    category: 'privacy',
    severity: 'important',
    passed: Boolean(cookiePolicy),
    summary: cookiePolicy
      ? `Cookie policy found at ${cookiePolicy.page.path}`
      : 'No cookie policy page was found.',
    fix: 'Publish a cookie policy listing each cookie, its purpose, duration and provider, linked from your consent banner and footer.',
    foundOn: cookiePolicy?.page.url,
  });

  const gdpr = findInContent(crawl, ['gdpr', 'data protection act', 'uk gdpr', /information commissioner|ico\b/]);
  add({
    id: 'data-protection',
    label: 'Data protection commitment',
    category: 'privacy',
    severity: 'important',
    passed: Boolean(gdpr),
    summary: gdpr
      ? 'Data protection / UK GDPR commitments are referenced.'
      : 'No mention of UK GDPR, the Data Protection Act or the ICO was found anywhere on the site.',
    fix: 'State your UK GDPR compliance and ICO registration number (care providers processing health data must be registered) in your privacy notice and footer.',
  });

  // ---------------- Transparency & trust ----------------
  const contact = findInContent(crawl, [
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/,
    /(\+44|0)[\s()-]?\d{2,4}[\s()-]?\d{3}[\s()-]?\d{3,4}/,
  ]);
  add({
    id: 'contact-details',
    label: 'Contact details',
    category: 'transparency',
    severity: 'important',
    passed: Boolean(contact),
    summary: contact
      ? 'A contact email or phone number is published.'
      : 'No email address or phone number was found — families and commissioners expect a direct route to you.',
    fix: 'Publish a monitored phone number and email address on every page (header or footer), plus a contact page with your office hours.',
  });

  const address = findInContent(crawl, [/[a-z]{1,2}\d{1,2}[a-z]?\s*\d[a-z]{2}\b/]); // UK postcode
  add({
    id: 'physical-address',
    label: 'Registered address',
    category: 'transparency',
    severity: 'important',
    passed: Boolean(address),
    summary: address
      ? 'A UK postal address is published.'
      : 'No UK postal address (postcode) was found on the pages scanned.',
    fix: 'Display your registered office address in the footer — a legal requirement for companies under the Companies Act 2006, and a trust signal for families.',
  });

  const companyNo = findInContent(crawl, [/(company|registration|registered)\s*(no|number)[.:\s]*\d{6,8}/, /registered in england/]);
  add({
    id: 'company-registration',
    label: 'Company registration details',
    category: 'transparency',
    severity: 'important',
    passed: Boolean(companyNo),
    summary: companyNo
      ? 'Company registration details are displayed.'
      : 'No company registration number was found — limited companies must display this.',
    fix: 'Add "Registered in England & Wales, Company No. XXXXXXXX" with your registered office to the site footer (Companies Act 2006 s.82).',
  });

  // ---------------- CQC & care duties ----------------
  const cqcMention = findInContent(crawl, ['cqc', 'care quality commission']);
  add({
    id: 'cqc-registration',
    label: 'CQC registration displayed',
    category: 'care',
    severity: 'important',
    passed: Boolean(cqcMention),
    summary: cqcMention
      ? 'CQC registration is referenced on the site.'
      : 'No mention of the Care Quality Commission was found — regulated services should state their registration.',
    fix: 'State that you are registered with the Care Quality Commission, include your provider/location ID, and link to your profile on cqc.org.uk.',
  });

  const rating = findInContent(crawl, [
    /cqc[^<]{0,80}(outstanding|good|requires improvement|inadequate)/,
    /(outstanding|good|requires improvement|inadequate)[^<]{0,80}cqc/,
    'cqc.org.uk/location',
    'ratings.cqc.org.uk',
    'cqc widget',
  ]);
  add({
    id: 'cqc-rating',
    label: 'CQC rating displayed',
    category: 'care',
    severity: 'urgent',
    passed: Boolean(rating),
    summary: rating
      ? 'Your CQC rating appears to be displayed.'
      : 'Your CQC rating was not found — rated providers are legally required to display their most recent rating on their website (Regulation 20A).',
    fix: 'Display your most recent CQC rating prominently (the official CQC widget is easiest), with a link to the full report. This is a legal duty under Reg 20A with fines for non-compliance.',
  });

  const safeguarding = findInContent(crawl, ['safeguarding']);
  add({
    id: 'safeguarding',
    label: 'Safeguarding commitment',
    category: 'care',
    severity: 'important',
    passed: Boolean(safeguarding),
    summary: safeguarding
      ? 'Safeguarding is referenced on the site.'
      : 'No safeguarding information was found — families and commissioners look for this.',
    fix: 'Publish a short safeguarding statement: your commitment, the named safeguarding lead, and how to raise a concern (including the local authority route).',
  });

  const manager = findInContent(crawl, ['registered manager']);
  add({
    id: 'registered-manager',
    label: 'Registered manager named',
    category: 'care',
    severity: 'important',
    passed: Boolean(manager),
    summary: manager
      ? 'A registered manager is referenced.'
      : 'No registered manager is named on the site.',
    fix: 'Name your registered manager on the about/contact page — it signals a properly-led service and matches your Statement of Purpose.',
  });

  // ---------------- Security ----------------
  add({
    id: 'https',
    label: 'HTTPS enabled',
    category: 'security',
    severity: 'urgent',
    passed: crawl.usedHttps,
    summary: crawl.usedHttps
      ? 'Your site is served over HTTPS.'
      : 'Your site is not served over HTTPS — data entered on it is unencrypted.',
    fix: 'Install a TLS certificate (free via Let’s Encrypt or your host) and serve the whole site over https://.',
  });

  add({
    id: 'https-redirect',
    label: 'HTTP redirects to HTTPS',
    category: 'security',
    severity: 'important',
    passed: crawl.httpRedirectsToHttps,
    summary: crawl.httpRedirectsToHttps
      ? 'Plain http:// requests are redirected to HTTPS.'
      : 'The http:// version of your site does not redirect to HTTPS.',
    fix: 'Add a permanent (301) redirect from http:// to https:// at your host or CDN so visitors can never land on the insecure version.',
  });

  const hsts = 'strict-transport-security' in crawl.headers;
  add({
    id: 'hsts',
    label: 'HSTS header',
    category: 'security',
    severity: 'important',
    passed: hsts,
    summary: hsts
      ? 'HTTP Strict Transport Security is enabled.'
      : 'No Strict-Transport-Security header was found.',
    fix: 'Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` so browsers always use HTTPS for your domain.',
  });

  const secHeaders = ['x-content-type-options', 'x-frame-options', 'content-security-policy', 'referrer-policy']
    .filter((h) => h in crawl.headers);
  add({
    id: 'security-headers',
    label: 'Security headers',
    category: 'security',
    severity: 'important',
    passed: secHeaders.length >= 2,
    summary:
      secHeaders.length >= 2
        ? `${secHeaders.length} of 4 recommended security headers are set.`
        : `Only ${secHeaders.length} of 4 recommended security headers are set (X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, Referrer-Policy).`,
    fix: 'Configure X-Content-Type-Options: nosniff, X-Frame-Options: DENY (or a CSP frame-ancestors rule) and a Referrer-Policy at your host or CDN.',
  });

  const mixed = crawl.usedHttps && /src\s*=\s*["']http:\/\//.test(crawl.pages.map((p) => p.rawHtml).join('\n'));
  add({
    id: 'mixed-content',
    label: 'No mixed content',
    category: 'security',
    severity: 'important',
    passed: !mixed,
    summary: mixed
      ? 'Some resources (images/scripts) load over insecure http:// on your HTTPS pages.'
      : 'No insecure http:// resources detected on your pages.',
    fix: 'Update hard-coded http:// asset URLs to https:// (or protocol-relative) so browsers don’t block or warn on your pages.',
  });

  return results;
}

export interface ScanScore {
  score: number; // 0.0 – 10.0
  urgent: number;
  important: number;
  passed: number;
  categoryScores: { category: CheckCategory; label: string; score: number; outOf: 10 }[];
}

export function scoreChecks(results: CheckResult[]): ScanScore {
  let weightTotal = 0;
  let weightPassed = 0;
  for (const r of results) {
    const w = WEIGHTS[r.severity];
    weightTotal += w;
    if (r.passed) weightPassed += w;
  }
  const score = weightTotal > 0 ? Math.round((weightPassed / weightTotal) * 100) / 10 : 0;

  const categories = Object.keys(CATEGORY_LABELS) as CheckCategory[];
  const categoryScores = categories.map((category) => {
    const rows = results.filter((r) => r.category === category);
    let t = 0;
    let p = 0;
    for (const r of rows) {
      const w = WEIGHTS[r.severity];
      t += w;
      if (r.passed) p += w;
    }
    return {
      category,
      label: CATEGORY_LABELS[category],
      score: t > 0 ? Math.round((p / t) * 100) / 10 : 0,
      outOf: 10 as const,
    };
  });

  return {
    score,
    urgent: results.filter((r) => !r.passed && r.severity === 'urgent').length,
    important: results.filter((r) => !r.passed && r.severity === 'important').length,
    passed: results.filter((r) => r.passed).length,
    categoryScores,
  };
}
