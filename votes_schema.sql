-- ============================================================================
-- ChatShare votes schema
-- Run this in the Supabase SQL Editor after chatshare_schema.sql.
--
-- Polymorphic votes for threads and footnotes:
--   value =  1  → upvote
--   value = -1  → downvote
-- ============================================================================

create table public.votes (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint votes_target_type_check
    check (target_type in ('thread', 'footnote')),
  constraint votes_value_check
    check (value in (1, -1)),
  constraint votes_user_target_unique
    unique (user_id, target_type, target_id)
);

comment on table public.votes is 'Upvotes and downvotes for threads and footnotes.';

create index votes_target_idx on public.votes (target_type, target_id);
create index votes_user_id_idx on public.votes (user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.votes enable row level security;

-- Anyone can read votes so scores can be shown publicly.
create policy "Votes are viewable by everyone"
  on public.votes for select
  to anon, authenticated
  using (true);

create policy "Users can insert their own votes"
  on public.votes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own votes"
  on public.votes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own votes"
  on public.votes for delete
  to authenticated
  using ((select auth.uid()) = user_id);
