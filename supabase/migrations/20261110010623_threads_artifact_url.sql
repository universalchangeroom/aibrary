-- ============================================================================
-- ChatShare: External Artifact Linking — optional media / mini-app URL
-- ============================================================================

alter table public.threads
  add column if not exists artifact_url text;

alter table public.threads
  add column if not exists artifact_type text;

comment on column public.threads.artifact_url is
  'Optional external URL for an AI-generated artifact (image, video, audio, or interactive app).';

comment on column public.threads.artifact_type is
  'Artifact kind: image | video | audio | iframe | link.';

alter table public.threads
  drop constraint if exists threads_artifact_type_check;

alter table public.threads
  add constraint threads_artifact_type_check
  check (
    artifact_type is null
    or artifact_type in ('image', 'video', 'audio', 'iframe', 'link')
  );
