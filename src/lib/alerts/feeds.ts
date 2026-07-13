import 'server-only';

/**
 * Trustworthy regulatory / sector feeds for domiciliary care, beyond CQC's own
 * website. Each is an RSS or Atom feed so we parse structured items (title,
 * link, date, summary) rather than scraping HTML — more reliable and less
 * likely to break.
 *
 * Sources chosen for authority and relevance to adult domiciliary care:
 *  • GOV.UK — DHSC/CQC/legislation announcements (where new law lands first).
 *  • NICE — care/clinical standards (medicines, care planning, effective care).
 *  • Skills for Care & SCIE — workforce, training, social-care practice.
 *  • Care sector press — faster on breaking changes (lower authority).
 *  • Legislation.gov.uk — new/updated health & social care legislation.
 *
 * GOV.UK exposes an .atom feed on any filtered finder URL by appending .atom;
 * these are the official, stable feed endpoints.
 */
export interface FeedSource {
  kind: string;
  label: string;
  /** RSS/Atom feed URL. */
  url: string;
  /** True when items here often carry legal/legislative weight (calendar-worthy). */
  legislative?: boolean;
}

export const FEED_SOURCES: FeedSource[] = [
  // ---- GOV.UK official (highest authority) ----
  {
    kind: 'govuk_dhsc',
    label: 'GOV.UK — Dept of Health & Social Care',
    url: 'https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=department-of-health-and-social-care',
    legislative: true,
  },
  {
    kind: 'govuk_cqc',
    label: 'GOV.UK — Care Quality Commission',
    url: 'https://www.gov.uk/search/all.atom?organisations%5B%5D=care-quality-commission&order=updated-newest',
    legislative: true,
  },
  {
    kind: 'govuk_social_care_guidance',
    label: 'GOV.UK — Adult social care guidance',
    url: 'https://www.gov.uk/search/guidance-and-regulation.atom?topic=social-care&order=updated-newest',
    legislative: true,
  },
  // ---- Legislation ----
  {
    kind: 'legislation_uk',
    label: 'Legislation.gov.uk — new UK legislation',
    url: 'https://www.legislation.gov.uk/new/data.feed',
    legislative: true,
  },
  // ---- NICE ----
  {
    kind: 'nice_guidance',
    label: 'NICE — published guidance',
    url: 'https://www.nice.org.uk/guidance/rss',
  },
  // ---- Workforce / practice ----
  {
    kind: 'scie',
    label: 'SCIE — social care practice',
    url: 'https://www.scie.org.uk/rss/news',
  },
  {
    kind: 'skills_for_care',
    label: 'Skills for Care — news',
    url: 'https://www.skillsforcare.org.uk/rss/News.aspx',
  },
  // ---- Care sector press (lower authority, faster) ----
  {
    kind: 'community_care',
    label: 'Community Care',
    url: 'https://www.communitycare.co.uk/feed/',
  },
  {
    kind: 'homecare_insight',
    label: 'Homecare Insight',
    url: 'https://www.homecareinsight.co.uk/feed/',
  },
];

export interface FeedItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  sourceKind: string;
  sourceLabel: string;
  legislative: boolean;
}

const REQUEST_TIMEOUT_MS = 20000;
const USER_AGENT =
  'BizComplianceCQC/1.0 (+https://www.bizcompliance.co.uk) regulatory alerts sync';

/** Fetch and parse one RSS/Atom feed into normalised items. Never throws. */
export async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(source.url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, source);
  } catch (e) {
    console.warn(`[alerts] feed failed ${source.kind}`, e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Parse RSS (<item>) or Atom (<entry>) without an XML dependency. */
export function parseFeed(xml: string, source: FeedSource): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks) {
    const title = decode(tag(block, 'title'));
    const url = feedLink(block);
    if (!title || !url) continue;
    const summary = decode(
      tag(block, 'description') || tag(block, 'summary') || tag(block, 'content') || '',
    );
    const rawDate =
      tag(block, 'pubDate') ||
      tag(block, 'updated') ||
      tag(block, 'published') ||
      tag(block, 'dc:date') ||
      '';
    items.push({
      title: stripTags(title).trim(),
      url,
      summary: stripTags(summary).replace(/\s+/g, ' ').trim().slice(0, 700),
      publishedAt: parseDate(rawDate),
      sourceKind: source.kind,
      sourceLabel: source.label,
      legislative: Boolean(source.legislative),
    });
  }
  return items;
}

function tag(block: string, name: string): string {
  // CDATA-aware single-tag extraction.
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  const inner = m[1];
  const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  return cdata ? cdata[1] : inner;
}

function feedLink(block: string): string {
  // RSS: <link>url</link>. Atom: <link href="url" rel="alternate"/>.
  const rss = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
  if (rss && rss[1].trim() && !/^\s*</.test(rss[1])) return rss[1].trim();
  const atomAlt = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (atomAlt) return atomAlt[1];
  const atomAny = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  return atomAny ? atomAny[1] : '';
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ');
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseDate(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const t = Date.parse(cleaned);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
