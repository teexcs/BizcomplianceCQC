import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import type { Audit, AuditKind } from '@/types/database';

type AdminClient = ReturnType<typeof createAdminClient>;

const AUDIT_TURNAROUND_HOURS = 48;
const ACTIVE_AUDIT_STATUSES = ['intake', 'evidence', 'in_review', 'report_draft'] as const;

export interface AuditStartResult {
  audit: Pick<Audit, 'id' | 'org_id' | 'status' | 'purchase_id'>;
  created: boolean;
}

interface StartAuditOptions {
  admin?: AdminClient;
  orgId: string;
  orgName?: string | null;
  kind?: AuditKind;
  purchaseId?: string | null;
  forceNew?: boolean;
  autoCreated?: boolean;
  taskTitle?: string;
}

async function linkCurrentEvidenceToAudit(admin: AdminClient, orgId: string, auditId: string) {
  await admin
    .from('evidence_files')
    .update({ audit_id: auditId })
    .eq('org_id', orgId)
    .is('audit_id', null);
}

export async function startAuditForOrg({
  admin = createAdminClient(),
  orgId,
  orgName,
  kind = 'one_off',
  purchaseId = null,
  forceNew = false,
  autoCreated = false,
  taskTitle,
}: StartAuditOptions): Promise<AuditStartResult> {
  if (!forceNew) {
    const { data: active } = await admin
      .from('audits')
      .select('id, org_id, status, purchase_id')
      .eq('org_id', orgId)
      .in('status', [...ACTIVE_AUDIT_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Audit, 'id' | 'org_id' | 'status' | 'purchase_id'>>();

    if (active) {
      await linkCurrentEvidenceToAudit(admin, orgId, active.id);
      return { audit: active, created: false };
    }
  }

  const dueAt = new Date(Date.now() + AUDIT_TURNAROUND_HOURS * 3600 * 1000).toISOString();
  const { data: audit, error } = await admin
    .from('audits')
    .insert({
      org_id: orgId,
      kind,
      status: 'evidence',
      purchase_id: purchaseId,
      due_at: dueAt,
      auto_created: autoCreated,
    })
    .select('id, org_id, status, purchase_id')
    .single<Pick<Audit, 'id' | 'org_id' | 'status' | 'purchase_id'>>();

  if (error || !audit) {
    throw new Error(error?.message ?? 'Could not create audit.');
  }

  const { error: snapErr } = await admin.rpc('build_audit_snapshot', { p_audit_id: audit.id });
  if (snapErr) throw new Error(`Audit created but snapshot failed: ${snapErr.message}`);

  await linkCurrentEvidenceToAudit(admin, orgId, audit.id);

  await admin.from('tasks').insert({
    title: taskTitle ?? `Run CQC readiness audit${orgName ? ` - ${orgName}` : ''}`,
    org_id: orgId,
    audit_id: audit.id,
    kind: 'audit',
    priority: 'high',
    due_date: dueAt.slice(0, 10),
  });

  return { audit, created: true };
}

export async function resolveAuditForEvidenceUpload(
  orgId: string,
  requestedAuditId?: string | null,
): Promise<AuditStartResult> {
  const admin = createAdminClient();

  if (requestedAuditId && /^[0-9a-f-]{36}$/i.test(requestedAuditId)) {
    const { data: audit } = await admin
      .from('audits')
      .select('id, org_id, status, purchase_id')
      .eq('id', requestedAuditId)
      .maybeSingle<Pick<Audit, 'id' | 'org_id' | 'status' | 'purchase_id'>>();

    if (audit?.org_id === orgId && !['delivered', 'closed'].includes(audit.status)) {
      await linkCurrentEvidenceToAudit(admin, orgId, audit.id);
      return { audit, created: false };
    }
  }

  return startAuditForOrg({
    admin,
    orgId,
    forceNew: false,
    autoCreated: true,
    taskTitle: 'Evidence uploaded - run CQC readiness audit',
  });
}
