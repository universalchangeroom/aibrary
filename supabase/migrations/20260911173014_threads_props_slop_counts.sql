-- Props vs Slop counters on threads.
-- props_count mirrors gifted Props (kept in sync with total_tokens).
-- slop_count is the public Mr. Slop tally.

alter table public.threads
  add column if not exists props_count integer not null default 0;

alter table public.threads
  add column if not exists slop_count integer not null default 0;

comment on column public.threads.props_count is
  'Public Props tally gifted to this thread.';
comment on column public.threads.slop_count is
  'Public Mr. Slop tally marking low-quality / slop content.';

-- Backfill from legacy total_tokens.
update public.threads
set props_count = greatest(coalesce(total_tokens, 0), 0)
where props_count = 0
  and coalesce(total_tokens, 0) > 0;

alter table public.threads
  drop constraint if exists threads_props_count_nonnegative;

alter table public.threads
  add constraint threads_props_count_nonnegative
  check (props_count >= 0);

alter table public.threads
  drop constraint if exists threads_slop_count_nonnegative;

alter table public.threads
  add constraint threads_slop_count_nonnegative
  check (slop_count >= 0);

-- One Mr. Slop mark per user per thread.
create table if not exists public.slop_marks (
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

comment on table public.slop_marks is
  'Unique Mr. Slop marks so each user can slop a thread once.';

alter table public.slop_marks enable row level security;

create policy "Users can insert their own slop marks"
  on public.slop_marks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can read their own slop marks"
  on public.slop_marks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
