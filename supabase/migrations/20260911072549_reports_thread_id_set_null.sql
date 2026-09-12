-- Preserve report rows after Delete & Strike by nulling thread_id
-- instead of cascading the entire report away.

alter table public.reports
  alter column thread_id drop not null;

alter table public.reports
  drop constraint if exists reports_thread_id_fkey;

alter table public.reports
  add constraint reports_thread_id_fkey
  foreign key (thread_id)
  references public.threads (id)
  on delete set null;
