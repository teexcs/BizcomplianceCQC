import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Alert,
  Audit,
  AuditArea,
  AuditFinding,
  CalendarEvent,
  ClientDocument,
  ComplianceRequest,
  EvidenceFile,
  LibraryArea,
  Report,
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

export async function getCalendarEvents(orgId: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .gte('due_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .order('due_date', { ascending: true })
    .limit(50);
  return (data as CalendarEvent[]) ?? [];
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

export async function getLibraryAreas(): Promise<LibraryArea[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('library_areas').select('*').order('sort');
  return (data as LibraryArea[]) ?? [];
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
