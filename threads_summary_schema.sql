-- Persist the editable TL;DR generated in the share workflow.
alter table public.threads
  add column if not exists summary text;

comment on column public.threads.summary is
  'Editable generated or author-provided TL;DR shown on Discover cards.';
