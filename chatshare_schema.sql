-- ============================================================================
-- ChatShare database schema
-- Run this in the Supabase SQL Editor (or apply it as a migration).
--
-- Tables:
--   1. profiles  - public user profiles, linked 1:1 to auth.users
--   2. threads   - shared AI chat conversations, with a tags array
--   3. footnotes - misinformation annotations attached to threads
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid not null primary key references auth.users (id) on delete cascade,
  username text unique,
  reputation_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint username_length check (username is null or char_length(username) between 3 and 32)
);

comment on table public.profiles is 'Public profile for each user, linked to Supabase Auth.';

-- Automatically create a profile row when a new user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. THREADS (shared AI chat conversations)
-- ----------------------------------------------------------------------------
create table public.threads (
  id uuid not null primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  -- The chat transcript, e.g. [{ "role": "user", "content": "..." }, ...]
  content jsonb not null default '[]'::jsonb,
  -- The AI model/source of the conversation, e.g. "gpt-4o", "claude"
  source_model text,
  tags text[] not null default '{}',
  is_public boolean not null default false,
  -- published = public feed; pending_review = image content awaiting admin
  status text not null default 'published'
    check (status in ('published', 'pending_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.threads is 'Shared AI chat conversations.';
comment on column public.threads.status is
  'Moderation state: published (public feed) or pending_review (image content awaiting admin).';

create index threads_author_id_idx on public.threads (author_id);
create index threads_tags_idx on public.threads using gin (tags);
create index threads_status_idx on public.threads (status);
create index threads_public_published_idx
  on public.threads (created_at desc)
  where is_public = true and status = 'published';

-- ----------------------------------------------------------------------------
-- 3. FOOTNOTES (misinformation annotations on threads)
-- ----------------------------------------------------------------------------
create table public.footnotes (
  id uuid not null primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- The exact passage in the thread that the footnote annotates.
  quoted_text text,
  -- The annotation itself (correction, context, fact-check).
  body text not null,
  -- A supporting source for the correction.
  source_url text,
  created_at timestamptz not null default now()
);

comment on table public.footnotes is 'Misinformation annotations (fact-check footnotes) attached to threads.';

create index footnotes_thread_id_idx on public.footnotes (thread_id);
create index footnotes_author_id_idx on public.footnotes (author_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.footnotes enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES policies
-- ----------------------------------------------------------------------------
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- THREADS policies
-- ----------------------------------------------------------------------------
-- Public feed: is_public + published. Authors can always read their own (any status).
create policy "Public threads are viewable by everyone"
  on public.threads for select
  to anon, authenticated
  using (
    (is_public = true and status = 'published')
    or (select auth.uid()) = author_id
  );

create policy "Users can create their own threads"
  on public.threads for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Users can update their own threads"
  on public.threads for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Users can delete their own threads"
  on public.threads for delete
  to authenticated
  using ((select auth.uid()) = author_id);

-- ----------------------------------------------------------------------------
-- FOOTNOTES policies
-- ----------------------------------------------------------------------------
-- Footnotes are visible whenever their parent thread is visible.
create policy "Footnotes on visible threads are viewable"
  on public.footnotes for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.threads t
      where t.id = thread_id
        and (
          (t.is_public = true and t.status = 'published')
          or t.author_id = (select auth.uid())
        )
    )
  );

-- Signed-in users can annotate public threads (or their own threads).
create policy "Users can add footnotes to visible threads"
  on public.footnotes for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1
      from public.threads t
      where t.id = thread_id
        and (
          (t.is_public = true and t.status = 'published')
          or t.author_id = (select auth.uid())
        )
    )
  );

create policy "Users can update their own footnotes"
  on public.footnotes for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Users can delete their own footnotes"
  on public.footnotes for delete
  to authenticated
  using ((select auth.uid()) = author_id);
