-- Exact username discovery for Focus friends. Usernames are a public-safe,
-- globally unique handle; email and phone lookup continue to use private hashes.

alter table public.focus_profiles
  add column if not exists username text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'focus_profiles_username_format_check'
      and conrelid = 'public.focus_profiles'::regclass
  ) then
    alter table public.focus_profiles
      add constraint focus_profiles_username_format_check check (
        username is null
        or (
          char_length(username) between 3 and 24
          and username ~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'
          and username !~ '[._]{2}'
        )
      );
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'focus_profiles_username_reserved_check'
      and conrelid = 'public.focus_profiles'::regclass
  ) then
    alter table public.focus_profiles
      add constraint focus_profiles_username_reserved_check check (
        username is null
        or username !~ '^(admin|administrator|support|penni|official|moderator|system)'
      );
  end if;
end $$;

-- The expression index also protects uniqueness if a privileged writer ever
-- bypasses the normalising trigger. PostgreSQL arbitrates concurrent claims,
-- so two users can never win the same handle in a race.
create unique index if not exists focus_profiles_username_ci_uidx
  on public.focus_profiles (lower(username))
  where username is not null;

comment on column public.focus_profiles.username is
  'Optional public Focus handle. Canonical lowercase; globally unique case-insensitively.';

create or replace function public.focus_validate_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.display_name := btrim(new.display_name);
  if new.username is not null then
    new.username := nullif(lower(btrim(new.username)), '');
  end if;
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone';
  end if;
  return new;
end;
$$;

create or replace function public.set_my_focus_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if left(v_username, 1) = '@' then v_username := substr(v_username, 2); end if;

  if char_length(v_username) not between 3 and 24
     or v_username !~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'
     or v_username ~ '[._]{2}' then
    raise exception 'Use 3-24 lowercase letters, numbers, dots or underscores; separators cannot touch or appear at either end.'
      using errcode = '22023';
  end if;
  if v_username ~ '^(admin|administrator|support|penni|official|moderator|system)' then
    raise exception 'That username is reserved. Please choose another.' using errcode = '22023';
  end if;

  begin
    insert into public.focus_profiles (user_id, display_name, username)
    values (auth.uid(), 'UPSC Aspirant', v_username)
    on conflict (user_id) do update set username = excluded.username;
  exception
    when unique_violation then
      raise exception 'That username is already taken.' using errcode = '23505';
  end;

  return v_username;
end;
$$;

-- Migration 0006 predates usernames, so its exact-contact lookup cannot expose
-- the newly added public handle. PostgreSQL requires a drop/recreate when a
-- table-returning function gains a column.
drop function if exists public.find_focus_profile_by_hash(text, text);
create function public.find_focus_profile_by_hash(p_contact_kind text, p_contact_hash text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  headline text,
  relationship text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_window timestamptz := date_trunc('hour', now());
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_contact_kind not in ('email', 'phone') or p_contact_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid contact hash';
  end if;

  insert into public.focus_contact_lookup_limits (user_id, window_start, lookup_count)
  values (auth.uid(), v_window, 1)
  on conflict (user_id, window_start) do update
    set lookup_count = public.focus_contact_lookup_limits.lookup_count + 1
  returning lookup_count into v_count;
  if v_count > 30 then raise exception 'Contact lookup limit reached; try again later'; end if;

  delete from public.focus_contact_lookup_limits
  where user_id = auth.uid() and window_start < v_window - interval '24 hours';

  return query
  select p.user_id, p.username, p.display_name, p.avatar_url, p.headline,
    case
      when public.focus_are_friends(auth.uid(), p.user_id) then 'friend'
      when exists (
        select 1 from public.focus_friend_requests r
        where r.sender_id = auth.uid() and r.recipient_id = p.user_id and r.status = 'pending'
      ) then 'outgoing'
      when exists (
        select 1 from public.focus_friend_requests r
        where r.recipient_id = auth.uid() and r.sender_id = p.user_id and r.status = 'pending'
      ) then 'incoming'
      else 'none'
    end
  from public.focus_contact_hashes h
  join public.focus_profiles p on p.user_id = h.user_id
  where h.contact_kind = p_contact_kind
    and h.contact_hash = lower(p_contact_hash)
    and p.user_id <> auth.uid()
    and p.discoverable = true
    and p.allow_friend_requests = true
    and not public.focus_is_blocked(auth.uid(), p.user_id)
  limit 1;
end;
$$;

create or replace function public.find_focus_profile_by_username(p_username text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  headline text,
  relationship text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_count integer;
  v_window timestamptz := date_trunc('hour', now());
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if left(v_username, 1) = '@' then v_username := substr(v_username, 2); end if;
  if char_length(v_username) not between 3 and 24
     or v_username !~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'
     or v_username ~ '[._]{2}' then
    raise exception 'Enter a complete @username.' using errcode = '22023';
  end if;
  if v_username ~ '^(admin|administrator|support|penni|official|moderator|system)' then
    raise exception 'That username is reserved.' using errcode = '22023';
  end if;

  insert into public.focus_contact_lookup_limits (user_id, window_start, lookup_count)
  values (auth.uid(), v_window, 1)
  on conflict (user_id, window_start) do update
    set lookup_count = public.focus_contact_lookup_limits.lookup_count + 1
  returning lookup_count into v_count;
  if v_count > 30 then raise exception 'Account lookup limit reached; try again later'; end if;

  delete from public.focus_contact_lookup_limits
  where user_id = auth.uid() and window_start < v_window - interval '24 hours';

  return query
  select p.user_id, p.username, p.display_name, p.avatar_url, p.headline,
    case
      when public.focus_are_friends(auth.uid(), p.user_id) then 'friend'
      when exists (
        select 1 from public.focus_friend_requests r
        where r.sender_id = auth.uid() and r.recipient_id = p.user_id and r.status = 'pending'
      ) then 'outgoing'
      when exists (
        select 1 from public.focus_friend_requests r
        where r.recipient_id = auth.uid() and r.sender_id = p.user_id and r.status = 'pending'
      ) then 'incoming'
      else 'none'
    end
  from public.focus_profiles p
  where lower(p.username) = v_username
    and p.user_id <> auth.uid()
    and p.discoverable = true
    and p.allow_friend_requests = true
    and not public.focus_is_blocked(auth.uid(), p.user_id)
  limit 1;
end;
$$;

revoke all on function public.set_my_focus_username(text) from public;
revoke all on function public.find_focus_profile_by_hash(text, text) from public;
revoke all on function public.find_focus_profile_by_username(text) from public;
grant execute on function public.set_my_focus_username(text) to authenticated;
grant execute on function public.find_focus_profile_by_hash(text, text) to authenticated;
grant execute on function public.find_focus_profile_by_username(text) to authenticated;
