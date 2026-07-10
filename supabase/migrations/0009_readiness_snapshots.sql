-- Live readiness score
-- ---------------------------------------------------------------------------
-- The readiness score stops being a photo taken at delivery and becomes a
-- heartbeat: it decays as evidence ages past its 12-month review date and
-- recovers when documents are renewed. Every material change is snapshotted
-- with an Experian-style breakdown of *why* it moved.

create table if not exists public.readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  audit_id uuid references public.audits (id) on delete set null,
  score integer not null,
  -- Structured breakdown used to diff two snapshots (per-ref effective status,
  -- doc weighting, aggregate counts).
  factors jsonb not null default '{}'::jsonb,
  -- Signed, human-readable reasons for the change vs the previous snapshot.
  reasons jsonb not null default '[]'::jsonb,
  source text not null default 'cron',
  created_at timestamptz not null default now()
);

create index if not exists readiness_snapshots_org_idx
  on public.readiness_snapshots (org_id, created_at desc);

alter table public.readiness_snapshots enable row level security;

-- Clients read their own history; the founder (admin) reads all. Writes are
-- service-role only (the engine), so no client-facing write policy.
create policy "snapshots: org read" on public.readiness_snapshots
  for select using (org_id = public.current_org_id() or public.is_admin());

comment on table public.readiness_snapshots is
  'Point-in-time live readiness scores with a factor breakdown and the reasons the score changed since the previous snapshot.';
