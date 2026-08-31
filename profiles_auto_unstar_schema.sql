alter table public.profiles
  add column if not exists auto_unstar boolean not null default true;
