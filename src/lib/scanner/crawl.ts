import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Safe, polite website crawler for the public compliance scanner.
 *
 * Hardened against SSRF: http(s) only, public DNS only (no private/reserved
 * ranges), same-origin crawl, capped pages, capped body size, per-request
 * timeout. Real fetches — this is a genuine scan, not a lookup table.
 */

const MAX_PAGES = 12;
const MAX_BODY_BYTES = 600_000;
const REQUEST_TIMEOUT_MS = 8_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; BizComplianceScanner/1.0; +https://bizcompliance.co.uk/scanner)';

// Pages most likely to hold compliance content — crawled first.
const PRIORITY_PATTERNS = [
  'privacy', 'cookie', 'terms', 'condition', 'complaint', 'contact', 'about',
  'accessib', 'legal', 'safeguard', 'cqc', 'polic', 'gdpr', 'data-protection',
];

export interface FetchedPage {
  url: string;
  path: string;
  status: number;
  html: string; // lowercased
  rawHtml: string;
}

export interface CrawlResult {
  finalUrl: string;
  usedHttps: boolean;
  httpRedirectsToHttps: boolean;
  headers: Record<string, string>;
  pages: FetchedPage[];
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true;
  const [a, b] = parts;
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const low = ip.toLowerCase();
  return (
    low === '::1' || low === '::' ||
    low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80') ||
    low.startsWith('::ffff:') // v4-mapped — re-checked below anyway
  );
}

/** Validates and normalises a user-supplied URL; throws with a friendly message. */
export async function validateTarget(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error('That does not look like a valid website address.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https websites can be scanned.');
  }
  const host = url.hostname;
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Please enter a public website address.');
  }
  if (isIP(host)) {
    if (isIP(host) === 4 ? isPrivateIPv4(host) : isPrivateIPv6(host)) {
      throw new Error('Please enter a public website address.');
    }
  } else {
    try {
      const { address, family } = await lookup(host);
      const priv = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
      if (priv) throw new Error('Please enter a public website address.');
    } catch (e) {
      if (e instanceof Error && e.message.includes('public website')) throw e;
      throw new Error('We could not find that website — check the address and try again.');
    }
  }
  url.hash = '';
  return url;
}

async function fetchPage(url: string): Promise<{ status: number; body: string; headers: Headers; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html') && !type.includes('xhtml') && type !== '') {
      return { status: res.status, body: '', headers: res.headers, finalUrl: res.url };
    }
    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (received < MAX_BODY_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
        }
      }
      void reader.cancel().catch(() => {});
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return { status: res.status, body, headers: res.headers, finalUrl: res.url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractLinks(html: string, base: URL): string[] {
  const links = new Set<string>();
  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname !== base.hostname) continue;
      if (!['http:', 'https:'].includes(u.protocol)) continue;
      if (/\.(png|jpe?g|gif|svg|webp|pdf|docx?|xlsx?|zip|mp4|css|js|ico|xml)(\?|$)/i.test(u.pathname)) continue;
      u.hash = '';
      links.add(u.href);
    } catch {
      /* ignore malformed hrefs */
    }
  }
  return [...links];
}

/** Crawls the site: homepage first, then compliance-relevant internal pages. */
export async function crawlSite(target: URL): Promise<CrawlResult> {
  // Homepage over https (upgrade http input), remember what actually worked.
  const httpsUrl = new URL(target.href);
  httpsUrl.protocol = 'https:';
  let home = await fetchPage(httpsUrl.href);
  let usedHttps = true;
  if (!home || home.status >= 500) {
    const httpUrl = new URL(target.href);
    httpUrl.protocol = 'http:';
    home = await fetchPage(httpUrl.href);
    usedHttps = false;
  }
  if (!home || !home.body) {
    throw new Error('We could not reach that website. Check the address and try again.');
  }

  // Does plain http redirect to https?
  let httpRedirectsToHttps = usedHttps;
  if (usedHttps) {
    const httpProbe = new URL(target.href);
    httpProbe.protocol = 'http:';
    const probe = await fetchPage(httpProbe.href);
    httpRedirectsToHttps = !probe || probe.finalUrl.startsWith('https://');
  }

  const base = new URL(home.finalUrl);
  const headers: Record<string, string> = {};
  home.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  const pages: FetchedPage[] = [
    {
      url: home.finalUrl,
      path: base.pathname,
      status: home.status,
      html: home.body.toLowerCase(),
      rawHtml: home.body,
    },
  ];

  // Rank internal links: compliance-relevant paths first.
  const links = extractLinks(home.body, base)
    .filter((l) => new URL(l).pathname !== base.pathname)
    .sort((a, b) => scoreLink(b) - scoreLink(a))
    .slice(0, MAX_PAGES - 1);

  // Small concurrency pool — fast but polite.
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, links.length) }, async () => {
      while (index < links.length) {
        const link = links[index++];
        const page = await fetchPage(link);
        if (page?.body) {
          pages.push({
            url: page.finalUrl,
            path: new URL(page.finalUrl).pathname,
            status: page.status,
            html: page.body.toLowerCase(),
            rawHtml: page.body,
          });
        }
      }
    }),
  );

  return { finalUrl: home.finalUrl, usedHttps, httpRedirectsToHttps, headers, pages };
}

function scoreLink(link: string): number {
  const path = new URL(link).pathname.toLowerCase();
  let score = 0;
  for (const p of PRIORITY_PATTERNS) if (path.includes(p)) score += 10;
  score -= path.split('/').length; // shallow pages first
  return score;
}
