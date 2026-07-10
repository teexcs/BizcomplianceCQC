import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncCqcAlerts } from '@/lib/alerts/cqc-scrape';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * CQC alerts sync. Scheduled frequently so new guidance, news and
 * publications can be staged in admin before publication.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const started = Date.now();
  const admin = createAdminClient();
  const result = await syncCqcAlerts().catch((error) => {
    console.error('[cron.cqc-alerts] sync failed', error);
    return { checked: 0, inserted: 0, staged: 0, sources: 0 };
  });

  await admin.from('engine_runs').insert({
    kind: 'cron.cqc_alerts',
    stats: result as unknown as Record<string, unknown>,
    duration_ms: Date.now() - started,
  });

  return NextResponse.json({ ok: true, ...result });
}
