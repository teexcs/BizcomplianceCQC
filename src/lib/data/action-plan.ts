import 'server-only';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { AuditFinding, CalendarEvent, Alert } from '@/types/database';

/**
 * Action Plan ("This Week") — the manager layer.
 *
 * Aggregates what a client must DO from data that already exists — open audit
 * findings, upcoming calendar deadlines, and new CQC/regulatory changes — into
 * one prioritised, plain-English list, merged with the client's tick-done
 * progress and any evidence the auditor has requested. Nothing here recomputes
 * the engine; it surfaces and ranks existing signals.
 */

export type ActionCategory = 'finding' | 'document' | 'cqc_change' | 'calendar';
export type ActionUrgency = 'now' | 'soon' | 'upcoming' | 'info';

export interface ActionItem {
  /** Stable key across recomputes (used to persist done/evidence state). */
  key: string;
  category: ActionCategory;
  urgency: ActionUrgency;
  /** Sort weight — lower is more urgent. */
  weight: number;
  title: string;
  /** Plain-English "why it matters / what to do". */
  detail: string;
  /** Optional due date (ISO) for calendar-driven items. */
  dueDate: string | null;
  /** Optional external link (e.g. the CQC source). */
  link: string | null;
  areaCode: string | null;
  // Progress + auditor loop.
  done: boolean;
  doneAt: string | null;
  evidenceRequested: boolean;
  evidenceNote: string | null;
}

export interface ActionPlan {
  items: ActionItem[];
  open: ActionItem[];
  done: ActionItem[];
  counts: { now: number; soon: number; upcoming: number; info: number; done: number };
  /** The next thing on the horizon even when nothing is urgent. */
  nextUp: ActionItem | null;
}

const PRIORITY_URGENCY: Record<string, { urgency: ActionUrgency; weight: number; label: string }> = {
  fix_first: { urgency: 'now', weight: 0, label: 'Fix first' },
  days_7: { urgency: 'now', weight: 1, label: 'Within 7 days' },
  days_14: { urgency: 'soon', weight: 2, label: 'Within 14 days' },
  days_30: { urgency: 'upcoming', weight: 3, label: 'Within 30 days' },
};

function daysUntil(dateIso: string): number {
  const d = new Date(dateIso).getTime();
  return Math.round((d - Date.now()) / 86400000);
}

/** Build the org's live action plan, merged with persisted progress. */
export async function getActionPlan(orgId: string): Promise<ActionPlan> {
  const supabase = await createClient();

  const [{ data: findings }, { data: events }, { data: alerts }, { data: states }] =
    await Promise.all([
      supabase
        .from('audit_findings')
        .select('*')
        .eq('org_id', orgId)
        .eq('status', 'open')
        .order('sort'),
      supabase
        .from('calendar_events')
        .select('*')
        .or(`org_id.eq.${orgId},org_id.is.null`)
        .gte('due_date', new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10))
        .order('due_date'),
      supabase.from('alerts').select('*').eq('published', true).order('published_at', { ascending: false }).limit(6),
      supabase.from('action_states').select('*').eq('org_id', orgId),
    ]);

  return assemble(
    (findings as AuditFinding[]) ?? [],
    (events as CalendarEvent[]) ?? [],
    (alerts as Alert[]) ?? [],
    (states as never[]) ?? [],
  );
}

function mergeState(
  s: { done: boolean; done_at: string | null; evidence_requested: boolean; evidence_note: string | null } | undefined,
): Pick<ActionItem, 'done' | 'doneAt' | 'evidenceRequested' | 'evidenceNote'> {
  return {
    done: s?.done ?? false,
    doneAt: s?.done_at ?? null,
    evidenceRequested: s?.evidence_requested ?? false,
    evidenceNote: s?.evidence_note ?? null,
  };
}

/** Admin variant — same plan for a given org, using the service-role client. */
export async function getActionPlanAdmin(orgId: string): Promise<ActionPlan> {
  // Reuse the same query shape with the admin client so RLS never blocks the
  // auditor from seeing a client's plan.
  const admin = createAdminClient();
  const [{ data: findings }, { data: events }, { data: alerts }, { data: states }] =
    await Promise.all([
      admin.from('audit_findings').select('*').eq('org_id', orgId).eq('status', 'open').order('sort'),
      admin
        .from('calendar_events')
        .select('*')
        .or(`org_id.eq.${orgId},org_id.is.null`)
        .gte('due_date', new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10))
        .order('due_date'),
      admin.from('alerts').select('*').eq('published', true).order('published_at', { ascending: false }).limit(6),
      admin.from('action_states').select('*').eq('org_id', orgId),
    ]);
  return assemble(
    (findings as AuditFinding[]) ?? [],
    (events as CalendarEvent[]) ?? [],
    (alerts as Alert[]) ?? [],
    (states as never[]) ?? [],
  );
}

/** Shared assembly so client + admin build identical plans. */
function assemble(findings: AuditFinding[], events: CalendarEvent[], alerts: Alert[], states: Array<{ action_key: string; done: boolean; done_at: string | null; evidence_requested: boolean; evidence_note: string | null }>): ActionPlan {
  const stateByKey = new Map(states.map((s) => [s.action_key, s]));
  const items: ActionItem[] = [];
  for (const f of findings) {
    const p = PRIORITY_URGENCY[f.priority] ?? { urgency: 'upcoming' as ActionUrgency, weight: 4, label: '' };
    items.push({ key: `finding:${f.id}`, category: 'finding', urgency: p.urgency, weight: p.weight, title: f.title, detail: [f.detail, f.recommendation].filter(Boolean).join(' ') || 'Address this to close the gap.', dueDate: null, link: null, areaCode: f.area_code, ...mergeState(stateByKey.get(`finding:${f.id}`)) });
  }
  for (const e of events) {
    const dLeft = daysUntil(e.due_date);
    const urgency: ActionUrgency = dLeft <= 3 ? 'now' : dLeft <= 14 ? 'soon' : 'upcoming';
    items.push({ key: `calendar:${e.id}`, category: 'calendar', urgency, weight: 5 + Math.max(0, dLeft) / 100, title: e.title, detail: e.description ?? (dLeft < 0 ? 'This was due — action it now.' : dLeft === 0 ? 'Due today.' : `Due in ${dLeft} day${dLeft === 1 ? '' : 's'}.`), dueDate: e.due_date, link: null, areaCode: null, ...mergeState(stateByKey.get(`calendar:${e.id}`)) });
  }
  for (const a of alerts) {
    items.push({ key: `alert:${a.id}`, category: 'cqc_change', urgency: a.legislative ? 'soon' : 'info', weight: a.legislative ? 6 : 20, title: a.title, detail: `${a.body} Check whether this affects your policies or records.`, dueDate: null, link: a.external_url, areaCode: null, ...mergeState(stateByKey.get(`alert:${a.id}`)) });
  }
  items.sort((x, y) => x.weight - y.weight || (x.dueDate ?? '').localeCompare(y.dueDate ?? ''));
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  return {
    items,
    open,
    done,
    counts: { now: open.filter((i) => i.urgency === 'now').length, soon: open.filter((i) => i.urgency === 'soon').length, upcoming: open.filter((i) => i.urgency === 'upcoming').length, info: open.filter((i) => i.urgency === 'info').length, done: done.length },
    nextUp: open.find((i) => i.urgency !== 'info') ?? open[0] ?? null,
  };
}
