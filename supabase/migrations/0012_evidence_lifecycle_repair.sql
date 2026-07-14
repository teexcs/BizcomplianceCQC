-- Repair: partial migration 0005 (lifecycle + client documents)
-- ---------------------------------------------------------------------------
-- Migration 0005 (lifecycle_calendar_documents) was only partially applied to
-- the canonical project: its calendar parts landed, but the evidence-lifecycle
-- columns and the client_documents columns did not. That broke ALL evidence
-- uploads (insert lifecycle_state → 500) and would break issuing client
-- documents (insert audit_id/file_name). This re-applies exactly the missing
-- pieces. Idempotent and additive — safe to run more than once.

-- Evidence lifecycle (was blocking uploads).
alter table public.evidence_files
  add column if not exists lifecycle_state text not null default 'current',
  add column if not exists replaces_evidence_id uuid references public.evidence_files (id) on delete set null,
  add column if not exists superseded_by_id uuid references public.evidence_files (id) on delete set null;

update public.evidence_files
set lifecycle_state = 'current'
where lifecycle_state is null;

create index if not exists evidence_lifecycle_idx
  on public.evidence_files (org_id, lifecycle_state, created_at desc);

-- Client documents: link issued docs to their audit + keep the download name.
alter table public.client_documents
  add column if not exists audit_id uuid references public.audits (id) on delete set null,
  add column if not exists file_name text;

update public.client_documents
set file_name = coalesce(file_name, title || ' v' || version || '.docx')
where file_name is null;

create index if not exists client_documents_audit_idx
  on public.client_documents (audit_id);
