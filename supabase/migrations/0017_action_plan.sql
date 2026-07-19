-- Action Plan ("This Week")
-- ---------------------------------------------------------------------------
-- The action layer that turns the status dashboard into a manager: a
-- prioritised list of what the client must do (fix findings, renew expiring
-- documents, respond to CQC changes, meet calendar deadlines). Most items are
-- DERIVED live from existing data (findings, evidence review dates, alerts,
-- calendar) — we only need to persist the CLIENT'S PROGRESS on them (ticked
-- done) and the AUDITOR'S evidence requests. Hence one lightweight table keyed
-- by a stable action "key".

create table if not exists public.action_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  -- Stable key identifying the action across recomputes, e.g.
  -- "finding:<uuid>", "doc-review:<evidence_id>", "alert:<alert_id>",
  -- "calendar:<event_id>". So a derived item keeps its state run to run.
  action_key text not null,
  -- Client progress.
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  -- Auditor asks for proof the action was really completed. When set, the
  -- client sees "evidence requested" on that item.
  evidence_requested boolean not null default false,
  evidence_requested_at timestamptz,
  evidence_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, action_key)
);

create index if not exists action_states_org_idx
  on public.action_states (org_id, updated_at desc);

alter table public.action_states enable row level security;

-- Client reads + updates their own org's action progress; admin sees all and
-- can set evidence requests.
create policy "action_states: org read" on public.action_states
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "action_states: org upsert" on public.action_states
  for insert with check (org_id = public.current_org_id() or public.is_admin());
create policy "action_states: org update" on public.action_states
  for update using (org_id = public.current_org_id() or public.is_admin())
  with check (org_id = public.current_org_id() or public.is_admin());

create or replace function public.touch_action_states_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists action_states_touch on public.action_states;
create trigger action_states_touch
  before update on public.action_states
  for each row execute function public.touch_action_states_updated_at();

comment on table public.action_states is
  'Per-org progress on Action Plan items (client tick-done) and auditor evidence requests. Items themselves are derived live from findings, document review dates, alerts and calendar events.';
