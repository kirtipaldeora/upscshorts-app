-- Authenticated, rate-limited username availability checks for onboarding.
-- This RPC never claims or changes a username; the unique index and
-- set_my_focus_username() in migration 0007 remain the final authority when a
-- handle is saved.

create table if not exists public.focus_username_availability_limits (
  user_id       uuid not null references auth.users(id) on delete cascade,
  window_start  timestamptz not null,
  lookup_count  integer not null default 0 check (lookup_count >= 0),
  primary key (user_id, window_start)
);

alter table public.focus_username_availability_limits enable row level security;

comment on table public.focus_username_availability_limits is
  'Private hourly counters used only by is_focus_username_available().';

create or replace function public.is_focus_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_count integer;
  v_window timestamptz := date_trunc('hour', now());
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if left(v_username, 1) = '@' then
    v_username := substr(v_username, 2);
  end if;

  if char_length(v_username) not between 3 and 24
     or v_username !~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'
     or v_username ~ '[._]{2}' then
    raise exception 'Use 3-24 lowercase letters, numbers, dots or underscores; separators cannot touch or appear at either end.'
      using errcode = '22023';
  end if;

  if v_username ~ '^(admin|administrator|support|penni|official|moderator|system)' then
    raise exception 'That username is reserved. Please choose another.' using errcode = '22023';
  end if;

  insert into public.focus_username_availability_limits (user_id, window_start, lookup_count)
  values (auth.uid(), v_window, 1)
  on conflict (user_id, window_start) do update
    set lookup_count = public.focus_username_availability_limits.lookup_count + 1
  returning lookup_count into v_count;

  if v_count > 60 then
    raise exception 'Username availability limit reached; try again later' using errcode = '42900';
  end if;

  delete from public.focus_username_availability_limits
  where user_id = auth.uid()
    and window_start < v_window - interval '24 hours';

  -- A user's already-claimed handle remains available to that same user. The
  -- atomic unique index in 0007 still resolves a race between check and save.
  return not exists (
    select 1
    from public.focus_profiles
    where lower(username) = v_username
      and user_id <> auth.uid()
  );
end;
$$;

revoke all on table public.focus_username_availability_limits from public;
revoke all on function public.is_focus_username_available(text) from public;
grant execute on function public.is_focus_username_available(text) to authenticated;

comment on function public.is_focus_username_available(text) is
  'Checks a valid handle without claiming it; authenticated and limited to 60 checks per user per hour.';
