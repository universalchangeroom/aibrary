-- ============================================================================
-- ChatShare: reports table + admin RLS helpers
-- ============================================================================
-- Content reports filed by authenticated users against threads.
-- Standard users may INSERT only. SELECT/UPDATE are admin-only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Admin flag on profiles (used by RLS; not editable by end users)
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Privileged moderator flag. Must only be set via service role / SQL console.';

create or replace function public.protect_profile_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_admin cannot be changed by clients';
  end if;

  if tg_op = 'INSERT'
     and coalesce(new.is_admin, false) = true
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_admin cannot be set by clients';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_is_admin on public.profiles;
create trigger protect_profile_is_admin
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_is_admin();

-- Stable helper for RLS policies (SECURITY DEFINER avoids policy recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- REPORTS
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid not null primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),

  constraint reports_reason_check
    check (reason in ('SPAM', 'PII', 'DANGER', 'OTHER')),
  constraint reports_status_check
    check (status in ('PENDING', 'RESOLVED', 'DISMISSED'))
);

comment on table public.reports is
  'User-submitted content reports. Readable/updatable only by admins.';
comment on column public.reports.reason is
  'Report category: SPAM, PII (personal info), DANGER, or OTHER.';
comment on column public.reports.status is
  'Moderation workflow: PENDING, RESOLVED, or DISMISSED.';

create index if not exists reports_thread_id_idx on public.reports (thread_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_created_at_idx
  on public.reports (created_at desc);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.reports enable row level security;

-- Authenticated users may file a report for themselves only.
create policy "Authenticated users can create reports"
  on public.reports
  for insert
  to authenticated
  with check (
    (select auth.uid()) = reporter_id
  );

-- Admins only: read the queue (standard users never see this table).
create policy "Admins can select reports"
  on public.reports
  for select
  to authenticated
  using (public.is_admin());

-- Admins only: resolve / dismiss (requires SELECT policy above).
create policy "Admins can update reports"
  on public.reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
