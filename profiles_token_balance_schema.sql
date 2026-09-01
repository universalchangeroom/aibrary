-- ============================================================================
-- ChatShare: profiles Props / Honest Start columns + trigger
-- Run in the Supabase SQL Editor (additive; safe to re-run).
--
-- Fixes live DBs where profiles lacked token_balance / timezone /
-- last_token_reset, or handle_new_user did not set day-based starting balance.
-- ============================================================================

-- Columns used by Props / Generosification
alter table public.profiles
  add column if not exists token_balance integer;

alter table public.profiles
  add column if not exists timezone text not null default 'UTC';

alter table public.profiles
  add column if not exists last_token_reset timestamptz;

alter table public.profiles
  add column if not exists auto_unstar boolean not null default true;

-- Prefer a non-null balance going forward (existing nulls backfilled below).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'token_balance'
      and is_nullable = 'YES'
  ) then
    -- Temporary default so we can backfill then tighten.
    alter table public.profiles
      alter column token_balance set default 60;
  end if;
end $$;

-- Backfill: missing or uninitialized (0 with no last_token_reset) → Honest Start
-- Sun/Mon = 100, Tue/Wed = 80, Thu–Sat = 60 (UTC weekday).
update public.profiles
set
  token_balance = case extract(dow from now())::integer
    when 0 then 100
    when 1 then 100
    when 2 then 80
    when 3 then 80
    else 60
  end,
  last_token_reset = coalesce(last_token_reset, now()),
  timezone = coalesce(nullif(timezone, ''), 'UTC')
where
  token_balance is null
  or (token_balance = 0 and last_token_reset is null);

alter table public.profiles
  alter column token_balance set not null;

alter table public.profiles
  alter column token_balance set default 60;

-- Recreate signup trigger so new users always get day-based Honest Start.
-- Preserves username from raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_dow integer;
  starting_balance integer;
begin
  -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  current_dow := extract(dow from now());

  -- Honest Start balance based on Generosification weekly schedule.
  if current_dow in (0, 1) then
    starting_balance := 100;
  elsif current_dow in (2, 3) then
    starting_balance := 80;
  else
    starting_balance := 60;
  end if;

  insert into public.profiles (
    id,
    username,
    token_balance,
    timezone,
    last_token_reset
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    starting_balance,
    'UTC',
    now()
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Optional: confirm columns + trigger
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles'
--   and column_name in ('token_balance', 'timezone', 'last_token_reset', 'auto_unstar');
--
-- select tgname from pg_trigger
-- where tgrelid = 'auth.users'::regclass and not tgisinternal;
