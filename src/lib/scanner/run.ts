import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { validateTarget, crawlSite } from './crawl';
import { runChecks, scoreChecks, type CheckResult, type ScanScore } from './checks';

export interface ScanRecord {
  id: string;
  url: string;
  domain: string;
  companyName: string | null;
  email: string | null;
  score: number;
  urgent: number;
  important: number;
  passed: number;
  results: CheckResult[];
  categoryScores: ScanScore['categoryScores'];
  pagesScanned: number;
  paid: boolean;
  createdAt: string;
}

/** Runs a real scan end to end and persists it. Throws friendly errors. */
export async function runWebsiteScan(input: {
  url: string;
  companyName?: string | null;
  clientIp?: string | null;
}): Promise<ScanRecord> {
  const target = await validateTarget(input.url);
  const admin = createAdminClient();

  // Reuse a very recent scan of the same domain (idempotent + cheap).
  const { data: recent } = await admin
    .from('website_scans')
    .select('*')
    .eq('domain', target.hostname)
    .eq('status', 'complete')
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return rowToRecord(recent);

  const started = Date.now();
  const crawl = await crawlSite(target);
  const results = runChecks(crawl);
  const score = scoreChecks(results);

  const { data: row, error } = await admin
    .from('website_scans')
    .insert({
      url: crawl.finalUrl,
      domain: target.hostname,
      company_name: input.companyName?.slice(0, 120) || null,
      score: score.score,
      urgent_count: score.urgent,
      important_count: score.important,
      passed_count: score.passed,
      results: { checks: results, categories: score.categoryScores },
      pages_scanned: crawl.pages.length,
      client_ip: input.clientIp ?? null,
    })
    .select('*')
    .single();
  if (error || !row) throw new Error('The scan completed but could not be saved — please try again.');

  await admin.from('engine_runs').insert({
    kind: 'scan.website',
    stats: {
      domain: target.hostname,
      pages: crawl.pages.length,
      score: score.score,
      urgent: score.urgent,
    },
    duration_ms: Date.now() - started,
  });

  return rowToRecord(row);
}

export async function getScan(id: string): Promise<ScanRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from('website_scans').select('*').eq('id', id).maybeSingle();
  return data ? rowToRecord(data) : null;
}

// Supabase row (snake_case, jsonb) → typed record.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: any): ScanRecord {
  const payload = row.results ?? {};
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    companyName: row.company_name,
    email: row.email,
    score: Number(row.score ?? 0),
    urgent: row.urgent_count,
    important: row.important_count,
    passed: row.passed_count,
    results: payload.checks ?? [],
    categoryScores: payload.categories ?? [],
    pagesScanned: row.pages_scanned,
    paid: row.paid,
    createdAt: row.created_at,
  };
}
