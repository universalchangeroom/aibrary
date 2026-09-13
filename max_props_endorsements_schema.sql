-- ============================================================================
-- ChatShare: Max Props endorsements ("Generosification par excellence")
-- Run in the Supabase SQL Editor (or apply via supabase/migrations).
-- Mirror of: supabase/migrations/20260912065723_create_max_props_endorsements.sql
-- ============================================================================

create table public.max_props_endorsements (
  id uuid not null primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint max_props_endorsements_comment_length
    check (comment is null or char_length(comment) <= 3000),
  constraint max_props_endorsements_thread_user_unique
    unique (thread_id, user_id)
);

comment on table public.max_props_endorsements is
  'Optional curator notes unlocked when a user awards the full 100-Prop Influence Cap to a thread.';
comment on column public.max_props_endorsements.comment is
  'Optional endorsement note; max 3,000 characters (~500 words). Nullable so Max Props can be awarded before/without a note.';

create index max_props_endorsements_thread_created_idx
  on public.max_props_endorsements (thread_id, created_at asc);

create index max_props_endorsements_user_id_idx
  on public.max_props_endorsements (user_id);

create or replace function public.set_max_props_endorsements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists max_props_endorsements_set_updated_at
  on public.max_props_endorsements;

create trigger max_props_endorsements_set_updated_at
  before update on public.max_props_endorsements
  for each row
  execute function public.set_max_props_endorsements_updated_at();

alter table public.max_props_endorsements enable row level security;

create policy "Max props endorsements are viewable by everyone"
  on public.max_props_endorsements
  for select
  to anon, authenticated
  using (true);

create policy "Users can insert their own max props endorsements"
  on public.max_props_endorsements
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own max props endorsements"
  on public.max_props_endorsements
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own max props endorsements"
  on public.max_props_endorsements
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
