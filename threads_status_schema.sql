-- ============================================================================
-- Threads moderation status
-- Run in the Supabase SQL Editor (or apply as a migration).
--
-- Adds threads.status for image content review before public feed visibility.
-- ============================================================================

-- Status: 'published' (default, visible on public feed) | 'pending_review' (awaiting admin)
alter table public.threads
  add column if not exists status text not null default 'published';

alter table public.threads
  drop constraint if exists threads_status_check;

alter table public.threads
  add constraint threads_status_check
  check (status in ('published', 'pending_review'));

comment on column public.threads.status is
  'Moderation state: published (public feed) or pending_review (image content awaiting admin).';

create index if not exists threads_status_idx on public.threads (status);
create index if not exists threads_public_published_idx
  on public.threads (created_at desc)
  where is_public = true and status = 'published';

-- Public feed: only fully public + published rows. Authors still see their own (any status).
drop policy if exists "Public threads are viewable by everyone" on public.threads;

create policy "Public threads are viewable by everyone"
  on public.threads for select
  to anon, authenticated
  using (
    (
      is_public = true
      and status = 'published'
    )
    or (select auth.uid()) = author_id
  );

-- Footnotes visible only when parent thread is visible under the same rules.
drop policy if exists "Footnotes on visible threads are viewable" on public.footnotes;

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

drop policy if exists "Users can add footnotes to visible threads" on public.footnotes;

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
