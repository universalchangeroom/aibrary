-- ============================================================================
-- ChatShare: Proof of Authenticity — optional original share link
-- ============================================================================

alter table public.threads
  add column if not exists source_url text;

comment on column public.threads.source_url is
  'Optional public share URL of the original AI conversation for reader verification.';
