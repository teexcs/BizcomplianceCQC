import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { PLANS } from '@/lib/stripe/plans';
import type {
  Audit,
  AuditArea,
  AuditFinding,
  AuditItem,
  ContactMessage,
  EvidenceFile,
  LibraryArea,
  LibraryAsset,
  Organisation,
  Profile,
  Report,
  ComplianceRequest,
  SafQuestion,
  SafResponse,
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

  const [org, items, areas, libraryAreas, safQuestions, safResponses, findings, evidence, reports] =
    await Promise.all([
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
    reports: (reports.data as Report[]) ?? [],
  };
}

export interface AdminCustomerRow {
  profile: Profile;
  organisation: Organisation | null;
  subscription: Subscription | null;
  auditCount: number;
  latestScore: number | null;
}

export async function getCustomers(): Promise<AdminCustomerRow[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: orgs }, { data: subs }, { data: audits }] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false }),
    supabase.from('organisations').select('*'),
    supabase.from('subscriptions').select('*'),
    supabase.from('audits').select('id, org_id, score, created_at'),
  ]);

  const orgById = new Map(((orgs as Organisation[]) ?? []).map((o) => [o.id, o]));
  const subByOrg = new Map<string, Subscription>();
  for (const s of (subs as Subscription[]) ?? []) {
    const existing = subByOrg.get(s.org_id);
    if (!existing || s.created_at > existing.created_at) subByOrg.set(s.org_id, s);
  }
  const auditsByOrg = new Map<string, { count: number; latestScore: number | null; latestAt: string }>();
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
    .order('created_at', { ascending: false })
    .limit(200);
  return (data as unknown as EvidenceQueueRow[]) ?? [];
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
