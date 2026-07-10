-- ============================================================================
-- BizCompliance - Migration 0005: lifecycle, calendar quotas, custom delivery
-- Adds the minimum fields needed to represent evidence history, audit-linked
-- client documents, and plan-aware calendar/document workflows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Client documents: link issued documents back to the audit that triggered them
-- and preserve the original filename for client-facing downloads.
-- ----------------------------------------------------------------------------
alter table public.client_documents
  add column if not exists audit_id uuid references public.audits (id) on delete set null,
  add column if not exists file_name text;

update public.client_documents
set file_name = coalesce(file_name, title || ' v' || version || '.docx')
where file_name is null;

create index if not exists client_documents_audit_idx on public.client_documents (audit_id);

-- ----------------------------------------------------------------------------
-- Evidence lifecycle: keep the current upload visible, but retain superseded
-- versions so the vault reads like a proper document history.
-- ----------------------------------------------------------------------------
alter table public.evidence_files
  add column if not exists lifecycle_state text not null default 'current',
  add column if not exists replaces_evidence_id uuid references public.evidence_files (id) on delete set null,
  add column if not exists superseded_by_id uuid references public.evidence_files (id) on delete set null;

update public.evidence_files
set lifecycle_state = 'current'
where lifecycle_state is null;

create index if not exists evidence_lifecycle_idx on public.evidence_files (org_id, lifecycle_state, created_at desc);

