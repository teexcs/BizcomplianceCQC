-- ============================================================================
-- BizCompliance — Migration 0006: client social profiles
-- Stores grouped social, messaging and directory handles for each organisation.
-- ============================================================================

create type public.social_profile_category as enum ('social', 'messaging', 'reviews', 'directory', 'other');

create table public.social_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  category public.social_profile_category not null default 'social',
  platform text not null,
  label text,
  handle text,
  url text,
  notes text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_profiles_org_idx on public.social_profiles (org_id);
create index social_profiles_org_category_idx on public.social_profiles (org_id, category, sort);

alter table public.social_profiles enable row level security;

create policy "social_profiles: org read" on public.social_profiles
  for select using (org_id = public.current_org_id() or public.is_admin());
create policy "social_profiles: org write" on public.social_profiles
  for all using (org_id = public.current_org_id() or public.is_admin())
  with check (org_id = public.current_org_id() or public.is_admin());

do $$
begin
  execute 'create trigger set_updated_at before update on public.social_profiles for each row execute function public.set_updated_at();';
exception
  when duplicate_object then null;
end $$;

