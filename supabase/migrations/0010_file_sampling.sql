-- File sampling
-- ---------------------------------------------------------------------------
-- Step 5 of a proper independent audit: don't just check a policy exists —
-- pull individual records (a care plan, a MAR chart, a staff file) and read
-- them for completeness, consistency and regulatory alignment. Each sampled
-- file gets a verdict and the auditor's notes, so the report can say exactly
-- which files were examined and what was found — the depth evidence that
-- separates a real audit from a document tick-list.

create table if not exists public.file_samples (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  evidence_id uuid not null references public.evidence_files (id) on delete cascade,
  -- Which CQC area this sample speaks to (mirrors evidence_files.area_code).
  area_code text,
  -- What kind of record was sampled (care_plan, mar_chart, staff_file,
  -- risk_assessment, supervision, recruitment_file, other). Free-ish text so
  -- new sample types don't need a migration.
  sample_type text not null default 'other',
  -- The auditor's verdict on this specific file.
  verdict text not null default 'unset'
    check (verdict in ('unset', 'compliant', 'partial', 'not_compliant', 'not_applicable')),
  -- What was checked and what was found — quoted/specific, human written.
  findings text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per (audit, file): re-sampling updates the existing row.
  unique (audit_id, evidence_id)
);

create index if not exists file_samples_audit_idx
  on public.file_samples (audit_id);
create index if not exists file_samples_evidence_idx
  on public.file_samples (evidence_id);

alter table public.file_samples enable row level security;

-- Clients may read the samples for their own org (so a delivered report's
-- "files sampled" is transparent); the founder (admin) reads and writes all.
-- Writes are admin-only — sampling is the auditor's judgement.
create policy "file_samples: org read" on public.file_samples
  for select using (org_id = public.current_org_id() or public.is_admin());

create policy "file_samples: admin write" on public.file_samples
  for all using (public.is_admin()) with check (public.is_admin());

-- Keep updated_at fresh on re-review.
create or replace function public.touch_file_samples_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists file_samples_touch on public.file_samples;
create trigger file_samples_touch
  before update on public.file_samples
  for each row execute function public.touch_file_samples_updated_at();

comment on table public.file_samples is
  'Auditor file-sampling reviews: a verdict and findings for individual client records examined in depth during an audit.';
