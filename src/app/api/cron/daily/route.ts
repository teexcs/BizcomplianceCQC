import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runReviewCycles } from '@/lib/engine/review-cycles';
import { sweepPendingExtractions } from '@/lib/evidence/process';
import { snapshotAllLiveScores } from '@/lib/audit/live-score';
import { sendEmail, adminEmails } from '@/lib/email/send';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily housekeeping. Scheduled via vercel.json (06:00 UTC); Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically when the env var is set.
 *
 *   1. Document review cycles → client calendar events + founder tasks
 *   2. Overdue audits → founder tasks
 *   3. Founder digest email (only when something needs attention)
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const started = Date.now();
  const admin = createAdminClient();

  // Read any documents still awaiting extraction (new uploads whose async run
  // didn't finish, plus anything already in the vault before this shipped).
  const extractionsProcessed = await sweepPendingExtractions(40).catch(() => 0);

  const cycles = await runReviewCycles();

  // Age the live readiness score: documents that crossed their 12-month review
  // date since yesterday quietly pull the score down, with reasons recorded.
  const liveScoresChanged = await snapshotAllLiveScores(admin).catch(() => 0);

  // Digest counts in parallel — head-only queries, no row transfer.
  const [evidence, requests, audits, contact, alerts] = await Promise.all([
    admin
      .from('evidence_files')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'pending'),
    admin
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_review']),
    admin
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("delivered","closed")'),
    admin
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('handled', false),
    admin
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('published', false),
  ]);

  const digest = {
    evidencePending: evidence.count ?? 0,
    openRequests: requests.count ?? 0,
    activeAudits: audits.count ?? 0,
    unhandledContact: contact.count ?? 0,
    alertsWaitingApproval: alerts.count ?? 0,
    extractionsProcessed,
    liveScoresChanged,
    ...cycles,
  };

  const needsAttention =
    digest.evidencePending > 0 ||
    digest.openRequests > 0 ||
    digest.activeAudits > 0 ||
    digest.unhandledContact > 0 ||
    digest.alertsWaitingApproval > 0 ||
    cycles.reviewTasksCreated > 0 ||
    cycles.evidenceChaseTasksCreated > 0 ||
    cycles.overdueAuditTasks > 0 ||
    cycles.reAuditsCreated > 0;

  const admins = adminEmails();
  if (needsAttention && admins.length) {
    const rows = [
      ['Active audits', digest.activeAudits],
      ['Evidence awaiting review', digest.evidencePending],
      ['Open requests', digest.openRequests],
      ['Unhandled contact messages', digest.unhandledContact],
      ['Alerts waiting approval', digest.alertsWaitingApproval],
      ['Document reviews falling due', cycles.reviewTasksCreated],
      ['Evidence chases created', cycles.evidenceChaseTasksCreated],
      ['Audits past their deadline', cycles.overdueAuditTasks],
      ['Quarterly re-audits created', cycles.reAuditsCreated],
    ]
      .filter(([, v]) => (v as number) > 0)
      .map(
        ([label, v]) =>
          `<tr><td style="padding:6px 0;color:#333a47;font-size:14px;">${label}</td><td style="padding:6px 0;text-align:right;font-weight:bold;font-size:14px;">${v}</td></tr>`,
      )
      .join('');
    void sendEmail({
      to: admins,
      subject: 'BizCompliance daily briefing',
      html: `<p style="font-size:14px;color:#333a47;">Here is where the practice stands this morning:</p><table width="100%" style="border-collapse:collapse;">${rows}</table><p style="font-size:13px;margin-top:16px;"><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin">Open the command centre</a></p>`,
    });
  }

  await admin.from('engine_runs').insert({
    kind: 'cron.daily',
    stats: digest as unknown as Record<string, unknown>,
    duration_ms: Date.now() - started,
  });

  return NextResponse.json({ ok: true, ...digest });
}
