import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  computeScoreBreakdown,
  safDomainScores,
  type SafDomainScore,
  type ScoreBreakdown,
} from '@/lib/audit/scoring';
import type {
  Alert,
  Audit,
  AuditArea,
  AuditFinding,
  AuditItem,
  CalendarEvent,
  ClientDocument,
  ComplianceRequest,
  EvidenceFile,
  LibraryArea,
  Report,
  SafQuestion,
  SafResponse,
  SocialProfile,
  Task,
} from '@/types/database';

/** Documents the founder has issued to this organisation. */
export async function getIssuedDocuments(orgId: string): Promise<ClientDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_documents')
    .select('*')
    .eq('org_id', orgId)
    .neq('status', 'withdrawn')
    .order('issued_at', { ascending: false });
  return (data as ClientDocument[]) ?? [];
}

export interface CalendarEventRange {
  from?: string;
  to?: string;
}

export async function getCalendarEvents(
  orgId: string,
  range?: CalendarEventRange,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  let query = supabase
    .from('calendar_events')
    .select('*')
    .or(`org_id.eq.${orgId},org_id.is.null`);

  if (range?.from) {
    query = query.gte('due_date', range.from);
  } else {
    query = query.gte('due_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  }

  if (range?.to) {
    query = query.lte('due_date', range.to);
  }

  const { data } = await query.order('due_date', { ascending: true }).limit(50);
  return (data as CalendarEvent[]) ?? [];
}

export async function getTasks(
  orgId: string,
  range?: CalendarEventRange,
): Promise<Task[]> {
  const supabase = await createClient();
  let query = supabase
    .from('tasks')
    .select('*')
    .or(`org_id.eq.${orgId},org_id.is.null`);

  if (range?.from) {
    query = query.gte('due_date', range.from);
  } else {
    query = query.gte('due_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  }

  if (range?.to) {
    query = query.lte('due_date', range.to);
  }

  const { data } = await query.order('due_date', { ascending: true }).limit(50);
  return (data as Task[]) ?? [];
}

export interface AlertWithRead extends Alert {
  isRead: boolean;
}

export async function getAlerts(userId: string): Promise<AlertWithRead[]> {
  const supabase = await createClient();
  const [{ data: alerts }, { data: reads }] = await Promise.all([
    supabase
      .from('alerts')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(50),
    supabase.from('alert_reads').select('alert_id').eq('user_id', userId),
  ]);
  const readSet = new Set((reads ?? []).map((r: { alert_id: string }) => r.alert_id));
  return ((alerts as Alert[]) ?? []).map((a) => ({ ...a, isRead: readSet.has(a.id) }));
}

export async function getRequests(orgId: string): Promise<ComplianceRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data as ComplianceRequest[]) ?? [];
}

export async function getEvidenceFiles(orgId: string): Promise<EvidenceFile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('evidence_files')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data as EvidenceFile[]) ?? [];
}

export async function getSocialProfiles(orgId: string): Promise<SocialProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('social_profiles')
    .select('*')
    .eq('org_id', orgId)
    .order('category', { ascending: true })
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  return (data as SocialProfile[]) ?? [];
}

export async function hasCompletedAuditPurchase(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('purchases')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('product', 'audit')
    .eq('status', 'paid');
  return (count ?? 0) > 0;
}

export interface ClientAuditSummary {
  audit: Audit;
  areas: AuditArea[];
  findings: AuditFinding[];
  report: Report | null;
}

/** Latest audit with its per-area RAG, findings and published report (if any). */
export async function getLatestAudit(orgId: string): Promise<ClientAuditSummary | null> {
  const supabase = await createClient();
  const { data: audit } = await supabase
    .from('audits')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<Audit>();
  if (!audit) return null;

  const [{ data: areas }, { data: findings }, { data: report }] = await Promise.all([
    supabase.from('audit_areas').select('*').eq('audit_id', audit.id),
    supabase
      .from('audit_findings')
      .select('*')
      .eq('audit_id', audit.id)
      .order('sort', { ascending: true }),
    supabase
      .from('reports')
      .select('*')
      .eq('audit_id', audit.id)
      .eq('published', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle<Report>(),
  ]);

  return {
    audit,
    areas: (areas as AuditArea[]) ?? [],
    findings: (findings as AuditFinding[]) ?? [],
    report: report ?? null,
  };
}

export async function getActiveAuditId(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audits')
    .select('id')
    .eq('org_id', orgId)
    .in('status', ['intake', 'evidence', 'in_review', 'report_draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

export async function getLibraryAreas(): Promise<LibraryArea[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('library_areas').select('*').order('sort');
  return (data as LibraryArea[]) ?? [];
}

export interface ScoreTrendPoint {
  auditId: string;
  score: number;
  deliveredAt: string;
  kind: string;
}

/**
 * Readiness over time. Prefers the live snapshot series (which moves as
 * documents age and are renewed); falls back to delivered-audit milestones
 * until enough snapshots exist to draw a line.
 */
export async function getScoreTrend(orgId: string): Promise<ScoreTrendPoint[]> {
  const supabase = await createClient();
  const { data: snapshots } = await supabase
    .from('readiness_snapshots')
    .select('id, score, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(60);

  const snaps = (snapshots as { id: string; score: number; created_at: string }[]) ?? [];
  if (snaps.length >= 2) {
    return snaps.map((s) => ({
      auditId: s.id,
      score: s.score,
      deliveredAt: s.created_at,
      kind: 'live',
    }));
  }

  const { data } = await supabase
    .from('audits')
    .select('id, score, delivered_at, kind')
    .eq('org_id', orgId)
    .in('status', ['delivered', 'closed'])
    .not('score', 'is', null)
    .order('delivered_at', { ascending: true });
  return ((data as { id: string; score: number; delivered_at: string; kind: string }[]) ?? []).map(
    (a) => ({ auditId: a.id, score: a.score, deliveredAt: a.delivered_at, kind: a.kind }),
  );
}

export interface ScoreChangeReason {
  ref: string;
  delta: number;
  label: string;
}

export interface ScoreChange {
  current: number;
  previous: number | null;
  delta: number;
  at: string;
  reasons: ScoreChangeReason[];
}

/**
 * The most recent live-score movement and the credit-score-style reasons for
 * it. Null until at least one snapshot exists; `reasons` is empty on the very
 * first (baseline) snapshot.
 */
export async function getLatestScoreChange(orgId: string): Promise<ScoreChange | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('readiness_snapshots')
    .select('score, reasons, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(2);

  const rows =
    (data as { score: number; reasons: ScoreChangeReason[] | null; created_at: string }[]) ?? [];
  if (rows.length === 0) return null;

  const latest = rows[0];
  const previous = rows[1] ?? null;
  return {
    current: latest.score,
    previous: previous?.score ?? null,
    delta: latest.score - (previous?.score ?? latest.score),
    at: latest.created_at,
    reasons: latest.reasons ?? [],
  };
}

export interface Benchmark {
  percentile: number; // 0..100, this org vs all delivered audits
  cohortSize: number;
  cohortAverage: number;
}

/**
 * Where this score sits against every delivered audit across the platform.
 * Uses the `audit_benchmark` security-definer RPC so the client sees aggregate
 * stats only — never another org's rows.
 */
export async function getBenchmark(score: number): Promise<Benchmark | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('audit_benchmark', { p_score: score });
  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { cohort_size: number; cohort_avg: number; pct_below: number }
    | undefined;
  if (!row || row.cohort_size < 2) return null;
  return {
    percentile: row.pct_below,
    cohortSize: Number(row.cohort_size),
    cohortAverage: row.cohort_avg,
  };
}

export async function getPublishedReports(orgId: string): Promise<Report[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reports')
    .select('*')
    .eq('org_id', orgId)
    .eq('published', true)
    .order('created_at', { ascending: false });
  return (data as Report[]) ?? [];
}

export interface AuditCompleteness {
  decided: number;
  total: number;
  pct: number;
}

/**
 * How much of the 139-point checklist has an actual decision on it. Lets the
 * dashboard show the score as complete (or honestly flag that it isn't yet)
 * rather than presenting a partial score as if it were final.
 */
export async function getAuditCompleteness(auditId: string): Promise<AuditCompleteness> {
  const supabase = await createClient();
  const [{ count: total }, { count: decided }] = await Promise.all([
    supabase.from('audit_items').select('id', { count: 'exact', head: true }).eq('audit_id', auditId),
    supabase
      .from('audit_items')
      .select('id', { count: 'exact', head: true })
      .eq('audit_id', auditId)
      .neq('status', 'unset'),
  ]);
  const t = total ?? 0;
  const d = decided ?? 0;
  return { decided: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 };
}

export type DomainScore = SafDomainScore;

/** Five key questions scored from the audit's SAF interview (client-visible via RLS). */
export async function getSafDomainScores(auditId: string): Promise<DomainScore[]> {
  const supabase = await createClient();
  const [{ data: responses }, { data: questions }] = await Promise.all([
    supabase.from('saf_responses').select('question_id, answer').eq('audit_id', auditId),
    supabase.from('saf_questions').select('id, domain, priority'),
  ]);
  return safDomainScores(
    (responses as Pick<SafResponse, 'question_id' | 'answer'>[]) ?? [],
    (questions as Pick<SafQuestion, 'id' | 'domain' | 'priority'>[]) ?? [],
  );
}

/**
 * The full "how your score was calculated" breakdown for the client dashboard
 * — both halves, the harsh weighting, and any cap that limited the number.
 */
export async function getScoreBreakdown(auditId: string): Promise<ScoreBreakdown | null> {
  const supabase = await createClient();
  const [{ data: items }, { data: responses }, { data: questions }] = await Promise.all([
    supabase.from('audit_items').select('requirement, status').eq('audit_id', auditId),
    supabase.from('saf_responses').select('question_id, answer').eq('audit_id', auditId),
    supabase.from('saf_questions').select('id, priority'),
  ]);
  if (!items || items.length === 0) return null;
  return computeScoreBreakdown(
    items as Pick<AuditItem, 'requirement' | 'status'>[],
    (responses as Pick<SafResponse, 'question_id' | 'answer'>[]) ?? [],
    (questions as Pick<SafQuestion, 'id' | 'priority'>[]) ?? [],
  );
}
