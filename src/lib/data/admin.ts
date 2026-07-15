import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { PLANS, type PlanId } from '@/lib/stripe/plans';
import { entitlementsFor } from '@/lib/plans/entitlements';
import type {
  Audit,
  AuditArea,
  AuditFinding,
  AuditItem,
  ContactMessage,
  CalendarEvent,
  EvidenceFile,
  FileSample,
  LibraryArea,
  LibraryAsset,
  Organisation,
  Profile,
  Report,
  ComplianceRequest,
  SafQuestion,
  SafResponse,
  SocialProfile,
  Subscription,
  Task,
  Alert,
} from '@/types/database';

// All admin reads go through the RLS-scoped client: the is_admin() policies
// grant access, so a non-admin session hitting these gets empty results.

export interface AdminAuditRow extends Audit {
  organisation: Pick<Organisation, 'id' | 'name' | 'service_type'> | null;
}

export async function getAuditPipeline(): Promise<AdminAuditRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audits')
    .select('*, organisation:organisations(id, name, service_type)')
    .order('created_at', { ascending: false });
  return (data as unknown as AdminAuditRow[]) ?? [];
}

export interface AuditWorkbenchBundle {
  audit: Audit;
  organisation: Organisation;
  items: AuditItem[];
  areas: AuditArea[];
  libraryAreas: LibraryArea[];
  safQuestions: SafQuestion[];
  safResponses: SafResponse[];
  findings: AuditFinding[];
  evidence: EvidenceFile[];
  fileSamples: FileSample[];
  reports: Report[];
}

export async function getAuditWorkbench(auditId: string): Promise<AuditWorkbenchBundle | null> {
  const supabase = await createClient();
  const { data: audit } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .maybeSingle<Audit>();
  if (!audit) return null;

  const [
    org,
    items,
    areas,
    libraryAreas,
    safQuestions,
    safResponses,
    findings,
    evidence,
    fileSamples,
    reports,
  ] = await Promise.all([
    supabase.from('organisations').select('*').eq('id', audit.org_id).single<Organisation>(),
    supabase.from('audit_items').select('*').eq('audit_id', auditId).order('ref'),
    supabase.from('audit_areas').select('*').eq('audit_id', auditId),
    supabase.from('library_areas').select('*').order('sort'),
    supabase.from('saf_questions').select('*').order('id'),
    supabase.from('saf_responses').select('*').eq('audit_id', auditId),
    supabase.from('audit_findings').select('*').eq('audit_id', auditId).order('sort'),
    supabase
      .from('evidence_files')
      .select('*')
      .eq('org_id', audit.org_id)
      .order('created_at', { ascending: false }),
    supabase.from('file_samples').select('*').eq('audit_id', auditId),
    supabase
      .from('reports')
      .select('*')
      .eq('audit_id', auditId)
      .order('version', { ascending: false }),
  ]);

  if (!org.data) return null;

  return {
    audit,
    organisation: org.data,
    items: (items.data as AuditItem[]) ?? [],
    areas: (areas.data as AuditArea[]) ?? [],
    libraryAreas: (libraryAreas.data as LibraryArea[]) ?? [],
    safQuestions: (safQuestions.data as SafQuestion[]) ?? [],
    safResponses: (safResponses.data as SafResponse[]) ?? [],
    findings: (findings.data as AuditFinding[]) ?? [],
    evidence: (evidence.data as EvidenceFile[]) ?? [],
    fileSamples: (fileSamples.data as FileSample[]) ?? [],
    reports: (reports.data as Report[]) ?? [],
  };
}

export interface AdminCustomerRow {
  profile: Profile;
  organisation: Organisation | null;
  subscription: Subscription | null;
  auditCount: number;
  latestScore: number | null;
  socialProfiles: SocialProfile[];
}

export async function getCustomers(): Promise<AdminCustomerRow[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: orgs }, { data: subs }, { data: audits }, { data: socials }] =
    await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false }),
    supabase.from('organisations').select('*'),
    supabase.from('subscriptions').select('*'),
    supabase.from('audits').select('id, org_id, score, created_at'),
    supabase
      .from('social_profiles')
      .select('*')
      .order('category', { ascending: true })
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  const orgById = new Map(((orgs as Organisation[]) ?? []).map((o) => [o.id, o]));
  const subByOrg = new Map<string, Subscription>();
  for (const s of (subs as Subscription[]) ?? []) {
    const existing = subByOrg.get(s.org_id);
    if (!existing || s.created_at > existing.created_at) subByOrg.set(s.org_id, s);
  }
  const auditsByOrg = new Map<string, { count: number; latestScore: number | null; latestAt: string }>();
  const socialsByOrg = new Map<string, SocialProfile[]>();
  for (const s of (socials as SocialProfile[]) ?? []) {
    const list = socialsByOrg.get(s.org_id) ?? [];
    list.push(s);
    socialsByOrg.set(s.org_id, list);
  }
  for (const a of (audits as Pick<Audit, 'id' | 'org_id' | 'score' | 'created_at'>[]) ?? []) {
    const cur = auditsByOrg.get(a.org_id);
    if (!cur) auditsByOrg.set(a.org_id, { count: 1, latestScore: a.score, latestAt: a.created_at });
    else {
      cur.count++;
      if (a.created_at > cur.latestAt) {
        cur.latestAt = a.created_at;
        cur.latestScore = a.score;
      }
    }
  }

  return ((profiles as Profile[]) ?? []).map((p) => {
    const organisation = p.org_id ? (orgById.get(p.org_id) ?? null) : null;
    const subscription = p.org_id ? (subByOrg.get(p.org_id) ?? null) : null;
    const auditAgg = p.org_id ? auditsByOrg.get(p.org_id) : undefined;
    return {
      profile: p,
      organisation,
      subscription,
      auditCount: auditAgg?.count ?? 0,
      latestScore: auditAgg?.latestScore ?? null,
      socialProfiles: p.org_id ? socialsByOrg.get(p.org_id) ?? [] : [],
    };
  });
}

export interface AdminStats {
  mrr: number;
  activeSubscriptions: number;
  activeAudits: number;
  auditsDueSoon: number;
  evidencePending: number;
  openRequests: number;
  clientCount: number;
  revenueThisMonthPence: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [subs, audits, evidence, requests, clients, purchases] = await Promise.all([
    supabase.from('subscriptions').select('plan, status'),
    supabase.from('audits').select('id, status, due_at'),
    supabase
      .from('evidence_files')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'pending'),
    supabase
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_review']),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
    supabase
      .from('purchases')
      .select('amount_pence, created_at')
      .gte('created_at', monthStart.toISOString()),
  ]);

  const activeSubs = ((subs.data as Pick<Subscription, 'plan' | 'status'>[]) ?? []).filter((s) =>
    ['active', 'trialing', 'past_due'].includes(s.status),
  );
  const mrr = activeSubs.reduce((sum, s) => sum + (PLANS[s.plan]?.priceGbp ?? 0), 0);

  const auditRows = (audits.data as Pick<Audit, 'id' | 'status' | 'due_at'>[]) ?? [];
  const active = auditRows.filter((a) => !['delivered', 'closed'].includes(a.status));
  const soon = active.filter(
    (a) => a.due_at && new Date(a.due_at).getTime() - Date.now() < 24 * 3600 * 1000,
  );

  const revenueThisMonthPence = ((purchases.data as { amount_pence: number }[]) ?? []).reduce(
    (sum, p) => sum + p.amount_pence,
    0,
  );

  return {
    mrr,
    activeSubscriptions: activeSubs.length,
    activeAudits: active.length,
    auditsDueSoon: soon.length,
    evidencePending: evidence.count ?? 0,
    openRequests: requests.count ?? 0,
    clientCount: clients.count ?? 0,
    revenueThisMonthPence,
  };
}

export interface EvidenceQueueRow extends EvidenceFile {
  organisation: Pick<Organisation, 'id' | 'name'> | null;
}

export async function getEvidenceQueue(): Promise<EvidenceQueueRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('evidence_files')
    .select('*, organisation:organisations(id, name)')
    .or('lifecycle_state.eq.current,review_status.eq.pending')
    .order('created_at', { ascending: false })
    .limit(200);
  return (data as unknown as EvidenceQueueRow[]) ?? [];
}

async function getAllPendingEvidence(): Promise<EvidenceQueueRow[]> {
  const supabase = await createClient();
  const rows: EvidenceQueueRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data } = await supabase
      .from('evidence_files')
      .select('*, organisation:organisations(id, name)')
      .eq('review_status', 'pending')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    const page = (data as unknown as EvidenceQueueRow[]) ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

export async function getEvidenceReviewQueues(): Promise<{
  pending: EvidenceQueueRow[];
  reviewed: EvidenceQueueRow[];
}> {
  const supabase = await createClient();
  const [pending, reviewedResult] = await Promise.all([
    getAllPendingEvidence(),
    supabase
      .from('evidence_files')
      .select('*, organisation:organisations(id, name)')
      .eq('lifecycle_state', 'current')
      .neq('review_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return {
    pending,
    reviewed: (reviewedResult.data as unknown as EvidenceQueueRow[]) ?? [],
  };
}

export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });
  return (data as Task[]) ?? [];
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .order('due_date', { ascending: true });
  return (data as CalendarEvent[]) ?? [];
}

export interface CalendarOrganisationOption {
  id: string;
  name: string;
  planLabel: string;
  siteVisitPerQuarter: number;
}

export async function getOrganisationsForCalendar(): Promise<CalendarOrganisationOption[]> {
  const supabase = await createClient();
  const [{ data: orgs }, { data: subs }] = await Promise.all([
    supabase.from('organisations').select('id, name').order('name'),
    supabase
      .from('subscriptions')
      .select('org_id, plan, status, created_at')
      .in('status', ['active', 'trialing', 'past_due']),
  ]);

  const subByOrg = new Map<string, { plan: string; created_at: string }>();
  for (const sub of ((subs as { org_id: string; plan: string; created_at: string }[]) ?? [])) {
    const current = subByOrg.get(sub.org_id);
    if (!current || sub.created_at > current.created_at) subByOrg.set(sub.org_id, sub);
  }

  return ((orgs as Pick<Organisation, 'id' | 'name'>[]) ?? []).map((org) => {
    const sub = subByOrg.get(org.id);
    const planId = sub?.plan as PlanId | undefined;
    const entitlements = entitlementsFor(planId);
    return {
      id: org.id,
      name: org.name,
      planLabel: sub ? PLANS[sub.plan as PlanId]?.name ?? sub.plan : 'Pay-as-you-go',
      siteVisitPerQuarter: entitlements.siteVisitPerQuarter,
    };
  });
}

export interface AdminRequestRow extends ComplianceRequest {
  organisation: Pick<Organisation, 'id' | 'name'> | null;
}

export async function getAllRequests(): Promise<AdminRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('requests')
    .select('*, organisation:organisations(id, name)')
    .order('created_at', { ascending: false });
  return (data as unknown as AdminRequestRow[]) ?? [];
}

export interface LibraryBundle {
  areas: LibraryArea[];
  assets: LibraryAsset[];
}

export async function getLibrary(): Promise<LibraryBundle> {
  const supabase = await createClient();
  const [{ data: areas }, { data: assets }] = await Promise.all([
    supabase.from('library_areas').select('*').order('sort'),
    supabase.from('library_assets').select('*').order('ref'),
  ]);
  return { areas: (areas as LibraryArea[]) ?? [], assets: (assets as LibraryAsset[]) ?? [] };
}

export async function getAllAlerts(): Promise<Alert[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
  return (data as Alert[]) ?? [];
}

export async function getContactMessages(): Promise<ContactMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  return (data as ContactMessage[]) ?? [];
}

export async function getOrganisations(): Promise<Organisation[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('organisations').select('*').order('name');
  return (data as Organisation[]) ?? [];
}
