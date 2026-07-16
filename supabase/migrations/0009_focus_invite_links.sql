-- Secure bearer links for Focus friend requests and study-group invitations.
-- The raw token is returned once to the creator and is never stored. Only a
-- SHA-256 digest is persisted, so a database read cannot recreate share links.

-- Migration 0007 returned a column named user_id from these PL/pgSQL
-- functions and also referenced table columns named user_id. PostgreSQL can
-- consequently treat the lookup-limit DELETE as ambiguous. Recompile both
-- exact-lookup RPCs with explicit table aliases before adding QR discovery.
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
#variable_conflict use_column
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
    raise exception 'Enter a complete username.' using errcode = '22023';
  end if;

  insert into public.focus_contact_lookup_limits (user_id, window_start, lookup_count)
  values (auth.uid(), v_window, 1)
  on conflict (user_id, window_start) do update
    set lookup_count = public.focus_contact_lookup_limits.lookup_count + 1
  returning lookup_count into v_count;
  if v_count > 30 then raise exception 'Account lookup limit reached; try again later'; end if;
  delete from public.focus_contact_lookup_limits as lookup_limit
  where lookup_limit.user_id = auth.uid()
    and lookup_limit.window_start < v_window - interval '24 hours';

  return query
  select profile.user_id, profile.username, profile.display_name, profile.avatar_url, profile.headline,
    case
      when public.focus_are_friends(auth.uid(), profile.user_id) then 'friend'
      when exists (
        select 1 from public.focus_friend_requests request
        where request.sender_id = auth.uid() and request.recipient_id = profile.user_id and request.status = 'pending'
      ) then 'outgoing'
      when exists (
        select 1 from public.focus_friend_requests request
        where request.recipient_id = auth.uid() and request.sender_id = profile.user_id and request.status = 'pending'
      ) then 'incoming'
      else 'none'
    end
  from public.focus_profiles as profile
  where lower(profile.username) = v_username
    and profile.user_id <> auth.uid()
    and profile.discoverable = true
    and profile.allow_friend_requests = true
    and not public.focus_is_blocked(auth.uid(), profile.user_id)
  limit 1;
end;
$$;

create or replace function public.find_focus_profile_by_hash(p_contact_kind text, p_contact_hash text)
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
#variable_conflict use_column
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
  delete from public.focus_contact_lookup_limits as lookup_limit
  where lookup_limit.user_id = auth.uid()
    and lookup_limit.window_start < v_window - interval '24 hours';

  return query
  select profile.user_id, profile.username, profile.display_name, profile.avatar_url, profile.headline,
    case
      when public.focus_are_friends(auth.uid(), profile.user_id) then 'friend'
      when exists (
        select 1 from public.focus_friend_requests request
        where request.sender_id = auth.uid() and request.recipient_id = profile.user_id and request.status = 'pending'
      ) then 'outgoing'
      when exists (
        select 1 from public.focus_friend_requests request
        where request.recipient_id = auth.uid() and request.sender_id = profile.user_id and request.status = 'pending'
      ) then 'incoming'
      else 'none'
    end
  from public.focus_contact_hashes as contact
  join public.focus_profiles as profile on profile.user_id = contact.user_id
  where contact.contact_kind = p_contact_kind
    and contact.contact_hash = lower(p_contact_hash)
    and profile.user_id <> auth.uid()
    and profile.discoverable = true
    and profile.allow_friend_requests = true
    and not public.focus_is_blocked(auth.uid(), profile.user_id)
  limit 1;
end;
$$;

create table if not exists public.focus_invite_links (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('friend', 'group')),
  group_id    uuid references public.focus_groups(id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  max_uses    integer not null check (max_uses between 1 and 200),
  use_count   integer not null default 0 check (use_count between 0 and max_uses),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  last_used_at timestamptz,
  created_at  timestamptz not null default now(),
  check ((kind = 'friend' and group_id is null) or (kind = 'group' and group_id is not null)),
  check (expires_at > created_at)
);

create index if not exists focus_invite_links_creator_idx
  on public.focus_invite_links (creator_id, created_at desc);
create index if not exists focus_invite_links_active_idx
  on public.focus_invite_links (token_hash, expires_at)
  where revoked_at is null;

alter table public.focus_invite_links enable row level security;

comment on table public.focus_invite_links is
  'Expiring Focus friend/group invitation links. Raw bearer tokens are never stored.';

create or replace function public.create_focus_invite_link(
  p_kind text,
  p_group_id uuid default null,
  p_expires_hours integer default 168
)
returns table (
  invite_id uuid,
  invite_token text,
  invite_kind text,
  invite_group_id uuid,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_token text;
  v_hash text;
  v_id uuid;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_kind not in ('friend', 'group') then
    raise exception 'Invite type must be friend or group' using errcode = '22023';
  end if;
  if p_expires_hours not between 1 and 168 then
    raise exception 'Invite expiry must be between 1 and 168 hours' using errcode = '22023';
  end if;

  if v_kind = 'friend' then
    if p_group_id is not null then raise exception 'Friend invites cannot target a group'; end if;
    if not exists (
      select 1 from public.focus_profiles
      where user_id = auth.uid() and allow_friend_requests = true
    ) then
      raise exception 'Enable friend requests before sharing your QR';
    end if;
  else
    if p_group_id is null or not public.focus_is_group_admin(p_group_id) then
      raise exception 'Group admin access required';
    end if;
  end if;

  -- A newly generated QR supersedes the previous active QR for the same
  -- person or room, giving the creator a simple way to rotate access.
  update public.focus_invite_links
  set revoked_at = now()
  where creator_id = auth.uid()
    and kind = v_kind
    and group_id is not distinct from p_group_id
    and revoked_at is null
    and expires_at > now();

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  v_expires_at := now() + make_interval(hours => p_expires_hours);

  insert into public.focus_invite_links (
    creator_id, kind, group_id, token_hash, max_uses, expires_at
  ) values (
    auth.uid(), v_kind, p_group_id, v_hash,
    case when v_kind = 'friend' then 100 else 200 end,
    v_expires_at
  ) returning id into v_id;

  return query select v_id, v_token, v_kind, p_group_id, v_expires_at;
end;
$$;

create or replace function public.resolve_focus_invite_link(p_token text)
returns table (
  invite_id uuid,
  invite_kind text,
  inviter_id uuid,
  inviter_username text,
  inviter_display_name text,
  inviter_avatar_url text,
  relationship text,
  invite_group_id uuid,
  group_name text,
  group_category text,
  group_privacy text,
  group_member_count integer,
  group_capacity integer,
  viewer_is_member boolean,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_link public.focus_invite_links%rowtype;
begin
  if coalesce(char_length(p_token), 0) not between 32 and 128 then return; end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select * into v_link
  from public.focus_invite_links
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses;
  if not found then return; end if;

  if auth.uid() is not null and public.focus_is_blocked(auth.uid(), v_link.creator_id) then return; end if;

  if v_link.kind = 'friend' then
    return query
    select v_link.id, v_link.kind, profile.user_id, profile.username,
      profile.display_name, profile.avatar_url,
      case
        when auth.uid() is null then 'none'
        when auth.uid() = profile.user_id then 'self'
        when public.focus_are_friends(auth.uid(), profile.user_id) then 'friend'
        when exists (
          select 1 from public.focus_friend_requests request
          where request.sender_id = auth.uid() and request.recipient_id = profile.user_id
            and request.status = 'pending'
        ) then 'outgoing'
        when exists (
          select 1 from public.focus_friend_requests request
          where request.recipient_id = auth.uid() and request.sender_id = profile.user_id
            and request.status = 'pending'
        ) then 'incoming'
        else 'none'
      end,
      null::uuid, ''::text, ''::text, ''::text, 0, 0, false,
      v_link.expires_at
    from public.focus_profiles profile
    where profile.user_id = v_link.creator_id
      and profile.allow_friend_requests = true;
    return;
  end if;

  -- A group link stops resolving if its creator is no longer an admin.
  return query
  select v_link.id, v_link.kind, profile.user_id, profile.username,
    profile.display_name, profile.avatar_url,
    'none'::text,
    room.id, room.name, room.category, room.privacy,
    (select count(*)::integer from public.focus_group_members members where members.group_id = room.id),
    room.capacity,
    coalesce(auth.uid() is not null and exists (
      select 1 from public.focus_group_members mine
      where mine.group_id = room.id and mine.user_id = auth.uid()
    ), false),
    v_link.expires_at
  from public.focus_groups room
  join public.focus_group_members admin_member
    on admin_member.group_id = room.id
   and admin_member.user_id = v_link.creator_id
   and admin_member.role in ('owner', 'admin')
  join public.focus_profiles profile on profile.user_id = v_link.creator_id
  where room.id = v_link.group_id;
end;
$$;

create or replace function public.accept_focus_invite_link(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_link public.focus_invite_links%rowtype;
  v_request public.focus_friend_requests%rowtype;
  v_capacity integer;
  v_member_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce(char_length(p_token), 0) not between 32 and 128 then
    raise exception 'This invite link is invalid' using errcode = '22023';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select * into v_link
  from public.focus_invite_links
  where token_hash = v_hash
  for update;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now()
     or v_link.use_count >= v_link.max_uses then
    raise exception 'This invite link has expired or is no longer active';
  end if;
  if v_link.creator_id = auth.uid() then return 'self'; end if;
  if public.focus_is_blocked(auth.uid(), v_link.creator_id) then
    raise exception 'This invite is unavailable';
  end if;

  if v_link.kind = 'friend' then
    if not exists (
      select 1 from public.focus_profiles
      where user_id = v_link.creator_id and allow_friend_requests = true
    ) then raise exception 'This account is not accepting friend requests'; end if;
    if public.focus_are_friends(auth.uid(), v_link.creator_id) then return 'friend'; end if;

    select * into v_request
    from public.focus_friend_requests request
    where request.status = 'pending'
      and ((request.sender_id = auth.uid() and request.recipient_id = v_link.creator_id)
        or (request.sender_id = v_link.creator_id and request.recipient_id = auth.uid()))
    for update;

    if found then
      if v_request.recipient_id = auth.uid() then
        update public.focus_friend_requests
        set status = 'accepted', responded_at = now(), updated_at = now()
        where id = v_request.id;
        insert into public.focus_friendships (user_low, user_high, request_id)
        values (least(auth.uid(), v_link.creator_id), greatest(auth.uid(), v_link.creator_id), v_request.id)
        on conflict (user_low, user_high) do nothing;
        update public.focus_invite_links set use_count = use_count + 1, last_used_at = now() where id = v_link.id;
        return 'friend';
      end if;
      return 'outgoing';
    end if;

    insert into public.focus_friend_requests (sender_id, recipient_id, message)
    values (auth.uid(), v_link.creator_id, 'Added through a Penni friend QR');
    update public.focus_invite_links set use_count = use_count + 1, last_used_at = now() where id = v_link.id;
    return 'requested';
  end if;

  if not exists (
    select 1 from public.focus_group_members admin_member
    where admin_member.group_id = v_link.group_id
      and admin_member.user_id = v_link.creator_id
      and admin_member.role in ('owner', 'admin')
  ) then raise exception 'This group invite is no longer active'; end if;
  if exists (
    select 1 from public.focus_group_members mine
    where mine.group_id = v_link.group_id and mine.user_id = auth.uid()
  ) then return 'member'; end if;

  select capacity into v_capacity
  from public.focus_groups where id = v_link.group_id for update;
  if not found then raise exception 'This study group no longer exists'; end if;
  select count(*) into v_member_count
  from public.focus_group_members where group_id = v_link.group_id;
  if v_member_count >= v_capacity then raise exception 'This study group is full'; end if;

  insert into public.focus_group_members (group_id, user_id, role)
  values (v_link.group_id, auth.uid(), 'member');
  update public.focus_group_join_requests
  set status = 'accepted', responded_at = now(), updated_at = now()
  where group_id = v_link.group_id and requester_id = auth.uid() and status = 'pending';
  update public.focus_invite_links set use_count = use_count + 1, last_used_at = now() where id = v_link.id;
  return 'joined';
end;
$$;

create or replace function public.revoke_focus_invite_link(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.focus_invite_links
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id and creator_id = auth.uid();
  return found;
end;
$$;

revoke all on table public.focus_invite_links from public;
revoke all on function public.create_focus_invite_link(text, uuid, integer) from public;
revoke all on function public.resolve_focus_invite_link(text) from public;
revoke all on function public.accept_focus_invite_link(text) from public;
revoke all on function public.revoke_focus_invite_link(uuid) from public;

grant execute on function public.create_focus_invite_link(text, uuid, integer) to authenticated;
grant execute on function public.resolve_focus_invite_link(text) to anon, authenticated;
grant execute on function public.accept_focus_invite_link(text) to authenticated;
grant execute on function public.revoke_focus_invite_link(uuid) to authenticated;
