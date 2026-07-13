import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import { adminEmails, sendEmail } from '@/lib/email/send';
import { FEED_SOURCES, fetchFeed, type FeedItem } from '@/lib/alerts/feeds';

type CqcSource = {
  kind: string;
  label: string;
  url: string;
};

type CqcCandidate = {
  title: string;
  url: string;
  sourceKind: string;
  sourceLabel: string;
  publishedAtHint: string | null;
  summaryHint: string;
};

type CqcArticle = {
  title: string;
  body: string;
  category: string;
  url: string;
  sourceKind: string;
  publishedAt: string | null;
};

type FetchResult = {
  html: string;
  contentType: string;
  url: string;
};

const CURRENT_YEAR = new Date().getUTCFullYear();
/**
 * Earliest year to ingest. Defaults to LAST year so a first run backdates a
 * full ~18 months (e.g. from January 2025 when run in 2026) — the founder asked
 * to backfill the last year of CQC changes. Override with CQC_ALERTS_SINCE_YEAR.
 */
const SINCE_YEAR = Number(process.env.CQC_ALERTS_SINCE_YEAR) || CURRENT_YEAR - 1;
const MAX_PAGES_PER_SOURCE = 20;
const MAX_CANDIDATES_PER_SOURCE = 150;
const REQUEST_TIMEOUT_MS = 20000;
const USER_AGENT =
  'BizComplianceCQC/1.0 (+https://www.bizcompliance.co.uk) CQC alerts sync';

const SOURCES: CqcSource[] = [
  {
    kind: 'cqc_news',
    label: 'CQC news',
    url: 'https://www.cqc.org.uk/search/news',
  },
  {
    kind: 'cqc_press_release',
    label: 'CQC press releases',
    url: 'https://www.cqc.org.uk/search/press-releases',
  },
  {
    kind: 'cqc_publication',
    label: 'CQC publications',
    url: 'https://www.cqc.org.uk/search/publications',
  },
  {
    kind: 'cqc_guidance_update',
    label: 'CQC guidance and updates',
    url: 'https://www.cqc.org.uk/search/content/7146',
  },
];

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export interface SyncCqcAlertsResult {
  checked: number;
  inserted: number;
  staged: number;
  sources: number;
}

export async function syncCqcAlerts(opts: { notifyAdmins?: boolean } = {}): Promise<SyncCqcAlertsResult> {
  const { notifyAdmins = true } = opts;
  const admin = createAdminClient();

  const { data: existingRows } = await admin.from('alerts').select('title,external_url');
  const existingKeys = new Set<string>();
  for (const row of (existingRows ?? []) as Array<{ title: string; external_url: string | null }>) {
    if (row.title) existingKeys.add(titleKey(row.title));
    if (row.external_url) existingKeys.add(urlKey(row.external_url));
  }

  const insertedAlerts: CqcArticle[] = [];
  let checked = 0;
  let inserted = 0;

  for (const source of SOURCES) {
    const candidates = await crawlSource(source).catch((error) => {
      console.warn(`[cqc-alerts] failed to crawl ${source.kind}`, error);
      return [] as CqcCandidate[];
    });
    for (const candidate of candidates) {
      checked += 1;

      const article = await resolveArticle(candidate).catch((error) => {
        console.warn(`[cqc-alerts] failed to resolve ${candidate.url}`, error);
        return {
          title: candidate.title,
          body: buildBody(candidate.title, candidate.summaryHint, candidate.sourceLabel),
          category: classify(candidate.title, candidate.summaryHint),
          url: candidate.url,
          sourceKind: candidate.sourceKind,
          publishedAt: candidate.publishedAtHint,
        } satisfies CqcArticle;
      });
      // Ingest anything from SINCE_YEAR onward (was: current year only, which
      // silently dropped everything else and blocked backdating).
      const articleYear = article.publishedAt ? new Date(article.publishedAt).getUTCFullYear() : CURRENT_YEAR;
      if (articleYear < SINCE_YEAR) continue;

      const title = cleanText(article.title);
      const titleId = titleKey(title);
      const urlId = urlKey(article.url);
      if (existingKeys.has(titleId) || existingKeys.has(urlId)) continue;

      const { error } = await admin.from('alerts').insert({
        title,
        body: article.body,
        category: article.category,
        external_url: article.url,
        source_kind: article.sourceKind,
        published: false,
        published_at: article.publishedAt ?? new Date().toISOString(),
        approved_at: null,
      });
      if (error) continue;

      existingKeys.add(titleId);
      existingKeys.add(urlId);
      inserted += 1;
      insertedAlerts.push(article);
    }
  }

  // ---- Trustworthy RSS/Atom feeds (GOV.UK, NICE, Skills for Care, SCIE,
  //      legislation, care press) — official structured sources beyond CQC. ----
  for (const source of FEED_SOURCES) {
    const feedItems = await fetchFeed(source);
    for (const item of feedItems) {
      checked += 1;
      const itemYear = item.publishedAt ? new Date(item.publishedAt).getUTCFullYear() : CURRENT_YEAR;
      if (itemYear < SINCE_YEAR) continue;

      // Keep the feed relevant to adult social / domiciliary care.
      if (!isCareRelevant(item)) continue;

      const title = cleanText(item.title);
      const titleId = titleKey(title);
      const urlId = urlKey(item.url);
      if (existingKeys.has(titleId) || existingKeys.has(urlId)) continue;

      const category = classify(title, item.summary);
      const { error } = await admin.from('alerts').insert({
        title,
        body: buildBody(title, item.summary, item.sourceLabel),
        category,
        external_url: item.url,
        source_kind: item.sourceKind,
        legislative: item.legislative,
        published: false,
        published_at: item.publishedAt ?? new Date().toISOString(),
        approved_at: null,
      });
      if (error) continue;

      existingKeys.add(titleId);
      existingKeys.add(urlId);
      inserted += 1;
      insertedAlerts.push({
        title,
        body: buildBody(title, item.summary, item.sourceLabel),
        category,
        url: item.url,
        sourceKind: item.sourceKind,
        publishedAt: item.publishedAt,
      });
    }
  }

  if (notifyAdmins && insertedAlerts.length > 0) {
    const admins = adminEmails();
    if (admins.length > 0) {
      const rows = insertedAlerts
        .slice(0, 12)
        .map(
          (item) =>
            `<li style="margin:0 0 10px;">${escapeHtml(item.title)}<br/><span style="color:#6a7386;font-size:12px;">${escapeHtml(
              sourceLabel(item.sourceKind),
            )}</span></li>`,
        )
        .join('');
      const extra = insertedAlerts.length > 12
        ? `<p style="margin:14px 0 0;font-size:13px;color:#6a7386;">Plus ${insertedAlerts.length - 12} more waiting in the queue.</p>`
        : '';

      void sendEmail({
        to: admins,
        subject: `CQC alerts waiting for approval (${insertedAlerts.length})`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#111722;">
            <p style="font-size:14px;line-height:1.6;margin:0 0 14px;">New CQC alerts were staged in admin and are waiting for approval before they go live on client dashboards.</p>
            <ul style="margin:0 0 16px;padding-left:20px;">${rows}</ul>
            ${extra}
            <p style="margin:18px 0 0;">
              <a href="${siteUrl()}/admin/alerts" style="color:#0f2744;font-weight:bold;">Review alerts in admin</a>
            </p>
          </div>
        `,
      });
    }
  }

  return {
    checked,
    inserted,
    staged: insertedAlerts.length,
    sources: SOURCES.length + FEED_SOURCES.length,
  };
}

async function crawlSource(source: CqcSource): Promise<CqcCandidate[]> {
  const candidates: CqcCandidate[] = [];
  const seen = new Set<string>();
  let pageUrl = source.url;

  for (let page = 0; page < MAX_PAGES_PER_SOURCE && candidates.length < MAX_CANDIDATES_PER_SOURCE; page += 1) {
    const response = await fetchHtml(pageUrl);
    const pageCandidates = extractCandidatesFromListing(response.html, response.url, source, seen);
    candidates.push(...pageCandidates);

    // Keep paging while the page still has anything in our window; stop once a
    // page is entirely older than SINCE_YEAR (listings are newest-first).
    const hasInWindow = pageCandidates.some((candidate) => {
      if (!candidate.publishedAtHint) return true;
      return new Date(candidate.publishedAtHint).getUTCFullYear() >= SINCE_YEAR;
    });
    const allTooOld =
      pageCandidates.length > 0 &&
      pageCandidates.every((candidate) => {
        if (!candidate.publishedAtHint) return false;
        return new Date(candidate.publishedAtHint).getUTCFullYear() < SINCE_YEAR;
      });

    const nextUrl = extractNextPageUrl(response.html, response.url);
    if (!nextUrl) break;
    if (allTooOld && !hasInWindow) break;
    pageUrl = nextUrl;
  }

  return candidates.slice(0, MAX_CANDIDATES_PER_SOURCE);
}

async function resolveArticle(candidate: CqcCandidate): Promise<CqcArticle> {
  const response = await fetchHtml(candidate.url);
  const contentType = response.contentType.toLowerCase();

  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return {
      title: candidate.title,
      body: buildBody(candidate.title, candidate.summaryHint, candidate.sourceLabel),
      category: classify(candidate.title, candidate.summaryHint),
      url: candidate.url,
      sourceKind: candidate.sourceKind,
      publishedAt: candidate.publishedAtHint,
    };
  }

  const title = cleanText(
    firstMatch(response.html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      firstMatch(response.html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
      candidate.title,
  );
  const publishedAt =
    parseDateLoose(
      firstMatch(response.html, /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ??
        firstMatch(response.html, /<meta[^>]+name=["']published_time["'][^>]+content=["']([^"']+)["']/i) ??
        firstMatch(response.html, /<time[^>]+datetime=["']([^"']+)["']/i) ??
        candidate.publishedAtHint ??
        '',
    ) ?? candidate.publishedAtHint;

  const summary =
    cleanText(
      firstMatch(response.html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
        firstParagraph(response.html) ??
        candidate.summaryHint ??
        '',
    ) || candidate.summaryHint;

  return {
    title,
    body: buildBody(title, summary, candidate.sourceLabel),
    category: classify(title, summary),
    url: candidate.url,
    sourceKind: candidate.sourceKind,
    publishedAt,
  };
}

function extractCandidatesFromListing(
  html: string,
  pageUrl: string,
  source: CqcSource,
  seen: Set<string>,
): CqcCandidate[] {
  const candidates: CqcCandidate[] = [];
  const blocks = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  const roots = blocks.length > 0 ? blocks : [html];

  for (const block of roots) {
    const link = findBestLink(block, pageUrl);
    if (!link) continue;

    const key = urlKey(link.url);
    if (seen.has(key)) continue;

    const title = cleanText(link.title);
    if (!isLikelyHeadline(title, link.url)) continue;

    const publishedAtHint = parseDateLoose(extractListingDate(block) ?? '');
    const summaryHint = extractSummaryHint(block, title);
    candidates.push({
      title,
      url: link.url,
      sourceKind: source.kind,
      sourceLabel: source.label,
      publishedAtHint,
      summaryHint,
    });
    seen.add(key);
  }

  if (candidates.length === 0) {
    for (const link of extractAnchors(html, pageUrl)) {
      const key = urlKey(link.url);
      if (seen.has(key)) continue;
      if (!isLikelyHeadline(link.title, link.url)) continue;
      candidates.push({
        title: cleanText(link.title),
        url: link.url,
        sourceKind: source.kind,
        sourceLabel: source.label,
        publishedAtHint: null,
        summaryHint: cleanText(link.title),
      });
      seen.add(key);
    }
  }

  return candidates;
}

function extractAnchors(html: string, pageUrl: string): Array<{ title: string; url: string }> {
  const anchors: Array<{ title: string; url: string }> = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const url = resolveUrl(pageUrl, match[1]);
    const title = cleanText(match[2]);
    if (!url || !title) continue;
    anchors.push({ title, url });
  }
  return anchors;
}

function findBestLink(
  block: string,
  pageUrl: string,
): { title: string; url: string } | null {
  const matches = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: resolveUrl(pageUrl, match[1]),
      title: cleanText(match[2]),
    }))
    .filter((entry) => entry.url && entry.title)
    .sort((a, b) => b.title.length - a.title.length);

  return matches.find((entry) => isLikelyHeadline(entry.title, entry.url)) ?? matches[0] ?? null;
}

function extractListingDate(block: string): string | null {
  const timeMatch = block.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i);
  if (timeMatch) return timeMatch[1];

  const dateMatch = block.match(/\b(?:datePublished|published|updated)\b[^>]*content=["']([^"']+)["']/i);
  if (dateMatch) return dateMatch[1];

  return null;
}

function extractSummaryHint(block: string, title: string): string {
  const text = cleanText(block);
  const withoutTitle = cleanText(text.replace(title, ' '));
  return trimToSentence(withoutTitle, 260);
}

function extractNextPageUrl(html: string, pageUrl: string): string | null {
  const relNext = html.match(/<a\b[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i);
  if (relNext?.[1]) return resolveUrl(pageUrl, relNext[1]);

  const ariaNext = html.match(/<a\b[^>]*aria-label=["'][^"']*next[^"']*["'][^>]*href=["']([^"']+)["']/i);
  if (ariaNext?.[1]) return resolveUrl(pageUrl, ariaNext[1]);

  const textNext = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: resolveUrl(pageUrl, match[1]),
      text: cleanText(match[2]),
    }))
    .find((entry) => /^next$/i.test(entry.text) || /^next page$/i.test(entry.text));

  return textNext?.url ?? null;
}

function isLikelyHeadline(title: string, url: string): boolean {
  if (title.length < 18 || title.length > 220) return false;
  if (!/[a-z]/i.test(title)) return false;
  if (title.split(/\s+/).length < 3) return false;
  if (/^(next|previous|back|home|search|menu|contact|cookie|privacy)$/i.test(title)) return false;

  const parsed = new URL(url);
  if (parsed.hostname !== 'www.cqc.org.uk') return false;
  if (parsed.pathname.startsWith('/search/')) return false;
  if (/\/(login|account|contact|about|cookies|privacy|terms|accessibility|site-map|search)\b/i.test(parsed.pathname)) {
    return false;
  }
  return /\/(news|publication|publications|guidance-regulation|press|updates?)\b/i.test(parsed.pathname);
}

/**
 * Keep only items relevant to adult social / domiciliary care. Broad feeds
 * (GOV.UK, legislation) cover everything, so we require a care-sector signal.
 * CQC-branded sources are always relevant.
 */
const CARE_TERMS =
  /(care quality commission|\bcqc\b|social care|domiciliary|home care|homecare|care at home|care provider|adult social|safeguard|mental capacity|deprivation of liberty|dols|registered manager|care worker|care home|regulated activit|health and social care act|fundamental standard|single assessment|medicines? management|infection prevention|duty of candour|liberty protection)/i;

function isCareRelevant(item: FeedItem): boolean {
  if (/^cqc/i.test(item.sourceKind) || /_cqc$/i.test(item.sourceKind)) return true;
  const hay = `${item.title} ${item.summary}`;
  return CARE_TERMS.test(hay);
}

function classify(title: string, body: string): string {
  const text = `${title} ${body}`.toLowerCase();
  if (/(safeguard|abuse|medicine|medication|infection|ipc|staffing|recruitment|falls|dementia|risk)/i.test(text)) {
    return 'safe';
  }
  if (/(assessment|clinical|treatment|therapy|nutrition|hydration|consent|capacity|outcome|record keeping)/i.test(text)) {
    return 'effective';
  }
  if (/(dignity|compassion|person centred|person-centred|respect|communication|empathy)/i.test(text)) {
    return 'caring';
  }
  if (/(response|responsive|timely|access|appointments|complaints|waiting|feedback|local services)/i.test(text)) {
    return 'responsive';
  }
  return 'well-led';
}

function buildBody(title: string, summary: string, sourceLabel: string): string {
  const intro = summary || `${sourceLabel} update from CQC.`;
  const outro = 'Check whether this changes your policies, records or audit evidence.';
  return trimToSentence(`${intro} ${outro}`, 700) || `${title}. ${outro}`;
}

async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return {
      html: await response.text(),
      contentType: response.headers.get('content-type') ?? '',
      url: response.url || url,
    };
  } finally {
    clearTimeout(timer);
  }
}

function resolveUrl(baseUrl: string, href: string): string {
  try {
    return canonicalUrl(new URL(href, baseUrl).toString());
  } catch {
    return '';
  }
}

function canonicalUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.hash = '';
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString();
}

function urlKey(url: string): string {
  return canonicalUrl(url).toLowerCase();
}

function titleKey(title: string): string {
  return cleanText(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sourceLabel(kind: string): string {
  const source = SOURCES.find((entry) => entry.kind === kind);
  return source?.label ?? kind;
}

function trimToSentence(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSentenceEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (lastSentenceEnd > maxLength * 0.6) {
    return slice.slice(0, lastSentenceEnd + 1);
  }
  return `${slice.slice(0, maxLength - 1).trimEnd()}…`;
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

function firstParagraph(html: string): string | null {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
  const paragraph = main.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null;
  return paragraph ? cleanText(paragraph) : null;
}

function parseDateLoose(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const [, day, monthName, year] = match;
    const month = MONTHS[monthName.toLowerCase()];
    if (month !== undefined) {
      const parsed = new Date(Date.UTC(Number(year), month, Number(day)));
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }

  const fallback = Date.parse(cleaned);
  if (!Number.isNaN(fallback)) return new Date(fallback).toISOString();

  return null;
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x27;/gi, "'");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
