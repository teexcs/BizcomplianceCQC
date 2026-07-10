import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { tierForPlan, ENTITLEMENTS } from '@/lib/plans/entitlements';
import type { PlanId } from '@/lib/stripe/plans';

export interface CycleStats {
  reviewEventsCreated: number;
  reviewTasksCreated: number;
  evidenceChaseTasksCreated: number;
  overdueAuditTasks: number;
  reAuditsCreated: number;
}

const RE_AUDIT_INTERVAL_DAYS = 90;

/**
 * "Not just audits": keeps the compliance calendar alive.
 *
 * - Every issued document has a 12-month review date; when one falls due
 *   within 45 days, the client gets a calendar event and the founder gets a
 *   task — created once, idempotently.
 * - Active audits past their due date raise a founder task.
 */
export async function runReviewCycles(): Promise<CycleStats> {
  const admin = createAdminClient();
  const stats: CycleStats = {
    reviewEventsCreated: 0,
    reviewTasksCreated: 0,
    evidenceChaseTasksCreated: 0,
    overdueAuditTasks: 0,
    reAuditsCreated: 0,
  };

  const horizon = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);

  // --- Document review cycles -------------------------------------------
  const { data: dueDocs } = await admin
    .from('client_documents')
    .select('id, org_id, title, review_due_at')
    .eq('status', 'issued')
    .lte('review_due_at', horizon);

  const docs =
    (dueDocs as { id: string; org_id: string; title: string; review_due_at: string }[]) ?? [];

  if (docs.length) {
    // One query for existing system events/tasks, deduped in memory.
    const [{ data: events }, { data: tasks }] = await Promise.all([
      admin.from('calendar_events').select('org_id, title, due_date').eq('source', 'system'),
      admin.from('tasks').select('title, due_date').eq('kind', 'review'),
    ]);
    const eventKeys = new Set(
      ((events as { org_id: string | null; title: string; due_date: string }[]) ?? []).map(
        (e) => `${e.org_id}|${e.title}|${e.due_date}`,
      ),
    );
    const taskKeys = new Set(
      ((tasks as { title: string; due_date: string | null }[]) ?? []).map(
        (t) => `${t.title}|${t.due_date}`,
      ),
    );

    const newEvents = [];
    const newTasks = [];
    for (const doc of docs) {
      const title = `Document review due: ${doc.title}`;
      if (!eventKeys.has(`${doc.org_id}|${title}|${doc.review_due_at}`)) {
        newEvents.push({
          org_id: doc.org_id,
          title,
          description:
            'This document reaches the end of its 12-month review cycle. Review it, update the document control block, and request a re-issue if anything has changed.',
          event_type: 'review',
          due_date: doc.review_due_at,
          source: 'system',
        });
      }
      if (!taskKeys.has(`${title}|${doc.review_due_at}`)) {
        newTasks.push({
          title,
          org_id: doc.org_id,
          kind: 'review',
          priority: 'medium',
          due_date: doc.review_due_at,
        });
      }
    }
    if (newEvents.length) {
      await admin.from('calendar_events').insert(newEvents);
      stats.reviewEventsCreated = newEvents.length;
    }
    if (newTasks.length) {
      await admin.from('tasks').insert(newTasks);
      stats.reviewTasksCreated = newTasks.length;
    }
  }

  // --- Onboarding evidence chase tasks -----------------------------------
  // We only auto-chase evidence while a client is still in onboarding / pre-
  // completion. Once they have a completed audit, evidence follow-up becomes a
  // manual founder task so ongoing uploads are not nagged automatically.
  const { data: audits } = await admin
    .from('audits')
    .select('org_id, status, created_at')
    .order('created_at', { ascending: false });

  const latestAuditByOrg = new Map<string, { status: string }>();
  for (const audit of (audits as { org_id: string; status: string; created_at: string }[]) ?? []) {
    if (!latestAuditByOrg.has(audit.org_id)) {
      latestAuditByOrg.set(audit.org_id, { status: audit.status });
    }
  }

  const chaseCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: staleEvidence } = await admin
    .from('evidence_files')
    .select('id, org_id, file_name, created_at, lifecycle_state')
    .eq('review_status', 'pending')
    .eq('lifecycle_state', 'current')
    .lt('created_at', chaseCutoff);

  const staleRows =
    (staleEvidence as { id: string; org_id: string; file_name: string; created_at: string; lifecycle_state: string }[]) ?? [];
  const isOnboardingOrg = (orgId: string): boolean => {
    const latest = latestAuditByOrg.get(orgId);
    return !latest || !['delivered', 'closed'].includes(latest.status);
  };

  if (staleRows.length) {
    const { data: chaseTasks } = await admin
      .from('tasks')
      .select('detail')
      .eq('kind', 'evidence-chase');
    const seen = new Set(
      ((chaseTasks as { detail: string | null }[]) ?? []).map((task) => task.detail ?? ''),
    );

    const newTasks = staleRows
      .filter((file) => isOnboardingOrg(file.org_id))
      .filter((file) => !seen.has(`evidence:${file.id}`))
      .map((file) => ({
        title: `Chase onboarding evidence — ${file.file_name}`,
        detail: `evidence:${file.id}`,
        org_id: file.org_id,
        kind: 'evidence-chase',
        priority: 'medium',
        due_date: new Date(file.created_at).toISOString().slice(0, 10),
      }));

    if (newTasks.length) {
      await admin.from('tasks').insert(newTasks);
      stats.evidenceChaseTasksCreated = newTasks.length;
    }
  }

  // --- Overdue audits -----------------------------------------------------
  const { data: overdue } = await admin
    .from('audits')
    .select('id, org_id, due_at, organisation:organisations(name)')
    .not('status', 'in', '("delivered","closed")')
    .lt('due_at', new Date().toISOString());

  const overdueRows =
    (overdue as unknown as {
      id: string;
      org_id: string;
      due_at: string;
      organisation: { name: string } | null;
    }[]) ?? [];

  if (overdueRows.length) {
    const { data: auditTasks } = await admin
      .from('tasks')
      .select('audit_id')
      .eq('kind', 'audit-overdue');
    const flagged = new Set(
      ((auditTasks as { audit_id: string | null }[]) ?? []).map((t) => t.audit_id),
    );
    const newTasks = overdueRows
      .filter((a) => !flagged.has(a.id))
      .map((a) => ({
        title: `Audit overdue — ${a.organisation?.name ?? 'client'}`,
        org_id: a.org_id,
        audit_id: a.id,
        kind: 'audit-overdue',
        priority: 'high',
        due_date: new Date().toISOString().slice(0, 10),
      }));
    if (newTasks.length) {
      await admin.from('tasks').insert(newTasks);
      stats.overdueAuditTasks = newTasks.length;
    }
  }

  // --- Quarterly re-audits (Professional & Partner entitlement) -----------
  const { data: subs } = await admin
    .from('subscriptions')
    .select('org_id, plan, status')
    .in('status', ['active', 'trialing', 'past_due']);

  const reAuditOrgs = ((subs as { org_id: string; plan: PlanId; status: string }[]) ?? []).filter(
    (s) => ENTITLEMENTS[tierForPlan(s.plan)].reAudit === 'quarterly',
  );

  if (reAuditOrgs.length) {
    const orgIds = reAuditOrgs.map((s) => s.org_id);
    // Most recent audit per eligible org.
    const { data: recent } = await admin
      .from('audits')
      .select('id, org_id, delivered_at, created_at, status')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false });

    const latestByOrg = new Map<string, { id: string; delivered_at: string | null; status: string; created_at: string }>();
    for (const a of (recent as {
      id: string;
      org_id: string;
      delivered_at: string | null;
      status: string;
      created_at: string;
    }[]) ?? []) {
      if (!latestByOrg.has(a.org_id)) latestByOrg.set(a.org_id, a);
    }

    const cutoff = Date.now() - RE_AUDIT_INTERVAL_DAYS * 86400000;
    const newReAudits = [];
    for (const orgId of orgIds) {
      const latest = latestByOrg.get(orgId);
      // Only when the last audit is delivered/closed and older than the interval,
      // and there isn't already an in-flight audit.
      if (!latest) continue;
      if (!['delivered', 'closed'].includes(latest.status)) continue;
      const anchor = new Date(latest.delivered_at ?? latest.created_at).getTime();
      if (anchor > cutoff) continue;
      newReAudits.push({ orgId, parentId: latest.id });
    }

    for (const { orgId, parentId } of newReAudits) {
      const { data: audit } = await admin
        .from('audits')
        .insert({
          org_id: orgId,
          kind: 're_audit',
          status: 'evidence',
          parent_audit_id: parentId,
          auto_created: true,
          due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .select('id')
        .single<{ id: string }>();
      if (audit) {
        await admin.rpc('build_audit_snapshot', { p_audit_id: audit.id });
        await admin.from('tasks').insert({
          title: 'Quarterly re-audit created — review evidence and run the engine',
          org_id: orgId,
          audit_id: audit.id,
          kind: 'audit',
          priority: 'medium',
          due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        });
        stats.reAuditsCreated++;
      }
    }
  }

  return stats;
}
