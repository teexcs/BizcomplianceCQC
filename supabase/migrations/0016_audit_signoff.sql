-- Auditor sign-off trail
-- ---------------------------------------------------------------------------
-- A report reaches a client only after a named human auditor formally reviews
-- and approves it. This records WHO approved and WHEN, so every delivered
-- report carries "Reviewed & approved by <name> on <date>" — the professional
-- judgement is on record, not "the system decided". Delivery is gated on it.

alter table public.audits
  add column if not exists signed_off_by uuid references public.profiles (id) on delete set null,
  add column if not exists signed_off_at timestamptz,
  -- The display name stamped on the report at sign-off time (kept even if the
  -- profile later changes), plus the auditor's professional statement.
  add column if not exists sign_off_name text,
  add column if not exists sign_off_statement text;

create index if not exists audits_signed_off_idx
  on public.audits (signed_off_at);

comment on column public.audits.signed_off_at is
  'When a named auditor formally approved this audit for client delivery. Required before a report can be delivered/published.';
