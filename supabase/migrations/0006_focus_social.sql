-- Focus social accountability: private timers, contact-hash discovery,
-- friendships, study groups, nudges, presence and scoped leaderboards.
-- Raw email addresses and phone numbers never enter any public.focus_* table.

create extension if not exists pgcrypto with schema extensions;

-- ─── Focus identity and private contact hashes ───────────────

create table if not exists public.focus_profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null default 'UPSC Aspirant'
                      check (char_length(btrim(display_name)) between 2 and 60),
  avatar_url        text not null default ''
                      check (char_length(avatar_url) <= 1000),
  headline          text not null default ''
                      check (char_length(headline) <= 120),
  timezone          text not null default 'Asia/Kolkata'
                      check (char_length(timezone) between 1 and 64),
  discoverable      boolean not null default false,
  allow_friend_requests boolean not null default true,
  allow_group_invites boolean not null default true,
  show_in_rankings  boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.focus_profiles is
  'Public-safe Focus identity. Contact details are never stored here.';

create table if not exists public.focus_contact_hashes (
  user_id       uuid not null references auth.users(id) on delete cascade,
  contact_kind  text not null check (contact_kind in ('email', 'phone')),
  contact_hash  text not null check (contact_hash ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  primary key (user_id, contact_kind),
  unique (contact_kind, contact_hash)
);

create table if not exists public.focus_contact_lookup_limits (
  user_id       uuid not null references auth.users(id) on delete cascade,
  window_start  timestamptz not null,
  lookup_count  integer not null default 0 check (lookup_count >= 0),
  primary key (user_id, window_start)
);

comment on table public.focus_contact_hashes is
  'SHA-256(email:<normalized>) or SHA-256(phone:<normalized>); never expose directly.';

-- ─── Categories and sessions ─────────────────────────────────

create table if not exists public.focus_categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 2 and 50),
  color        text not null default '#7C8CFF'
                 check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon         text not null default 'clock' check (char_length(icon) between 1 and 40),
  sort_order   smallint not null default 0 check (sort_order between 0 and 1000),
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.focus_categories.user_id is
  'NULL for system categories; otherwise a private category owned by one user.';

create unique index if not exists focus_categories_owner_name_uidx
  on public.focus_categories (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

insert into public.focus_categories (id, user_id, name, color, icon, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', null, 'Newspaper & Current Affairs', '#F5A94E', 'newspaper', 10),
  ('00000000-0000-4000-8000-000000000002', null, 'Prelims MCQs', '#7C8CFF', 'list-check', 20),
  ('00000000-0000-4000-8000-000000000003', null, 'Mains Answer Writing', '#57C9A5', 'pen', 30),
  ('00000000-0000-4000-8000-000000000004', null, 'GS Revision', '#B08CFF', 'rotate', 40),
  ('00000000-0000-4000-8000-000000000005', null, 'Optional Subject', '#EF7F8C', 'book', 50),
  ('00000000-0000-4000-8000-000000000006', null, 'Other Study', '#8D9AAF', 'clock', 60)
on conflict (id) do nothing;

create table if not exists public.focus_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  client_session_id text not null default (gen_random_uuid()::text)
                      check (char_length(client_session_id) between 8 and 100),
  category_id       uuid references public.focus_categories(id) on delete set null,
  label             text not null default '' check (char_length(label) <= 120),
  note              text not null default '' check (char_length(note) <= 500),
  mode              text not null default 'stopwatch'
                      check (mode in ('pomodoro', 'stopwatch')),
  phase             text not null default 'focus'
                      check (phase in ('focus', 'short-break', 'long-break')),
  planned_seconds   integer check (planned_seconds between 1 and 43200),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_seconds  integer not null default 0 check (duration_seconds between 0 and 43200),
  paused_seconds    integer not null default 0 check (paused_seconds between 0 and 43200),
  pause_count       integer not null default 0 check (pause_count between 0 and 1000),
  interruption_count integer not null default 0 check (interruption_count between 0 and 1000),
  interruption_seconds integer not null default 0 check (interruption_seconds between 0 and 43200),
  status            text not null default 'active'
                      check (status in ('active', 'completed', 'cancelled')),
  completion_reason text check (completion_reason in ('manual', 'timer', 'cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (status = 'active' or ended_at is not null),
  unique (user_id, client_session_id)
);

create index if not exists focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc);
create index if not exists focus_sessions_completed_idx
  on public.focus_sessions (user_id, ended_at desc)
  where status = 'completed' and phase = 'focus';
create unique index if not exists focus_sessions_one_active_uidx
  on public.focus_sessions (user_id)
  where status = 'active';

-- ─── Friends and blocking ────────────────────────────────────

create table if not exists public.focus_friend_requests (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  message       text not null default '' check (char_length(message) <= 180),
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  updated_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create unique index if not exists focus_friend_requests_pending_pair_uidx
  on public.focus_friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';
create index if not exists focus_friend_requests_recipient_idx
  on public.focus_friend_requests (recipient_id, status, created_at desc);
create index if not exists focus_friend_requests_sender_idx
  on public.focus_friend_requests (sender_id, status, created_at desc);

create table if not exists public.focus_friendships (
  user_low    uuid not null references auth.users(id) on delete cascade,
  user_high   uuid not null references auth.users(id) on delete cascade,
  request_id  uuid references public.focus_friend_requests(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);

create index if not exists focus_friendships_high_idx
  on public.focus_friendships (user_high, created_at desc);

create table if not exists public.focus_blocks (
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists focus_blocks_blocked_idx
  on public.focus_blocks (blocked_id);

-- ─── Groups and invites ──────────────────────────────────────

create table if not exists public.focus_groups (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 2 and 60),
  description         text not null default '' check (char_length(description) <= 280),
  privacy             text not null default 'private' check (privacy in ('public', 'private')),
  category            text not null default 'General UPSC' check (char_length(btrim(category)) between 2 and 50),
  rules               text[] not null default '{}'
                        check (cardinality(rules) <= 10),
  weekly_goal_seconds integer not null default 126000
                        check (weekly_goal_seconds between 900 and 604800),
  capacity            integer not null default 50 check (capacity between 2 and 200),
  join_policy         text not null default 'invite'
                        check (join_policy in ('open', 'request', 'invite')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (privacy = 'public' or join_policy <> 'open')
);

create index if not exists focus_groups_owner_idx
  on public.focus_groups (owner_id, created_at desc);
create index if not exists focus_groups_discover_idx
  on public.focus_groups (category, created_at desc)
  where privacy = 'public';

create table if not exists public.focus_group_members (
  group_id             uuid not null references public.focus_groups(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  role                 text not null default 'member' check (role in ('owner', 'admin', 'member')),
  notifications_enabled boolean not null default true,
  joined_at            timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists focus_group_members_user_idx
  on public.focus_group_members (user_id, joined_at desc);

create table if not exists public.focus_group_invites (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.focus_groups(id) on delete cascade,
  inviter_id   uuid not null references auth.users(id) on delete cascade,
  invitee_id   uuid not null references auth.users(id) on delete cascade,
  message      text not null default '' check (char_length(message) <= 180),
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  updated_at   timestamptz not null default now(),
  check (inviter_id <> invitee_id),
  check (expires_at > created_at)
);

create unique index if not exists focus_group_invites_pending_uidx
  on public.focus_group_invites (group_id, invitee_id)
  where status = 'pending';
create index if not exists focus_group_invites_invitee_idx
  on public.focus_group_invites (invitee_id, status, created_at desc);

create table if not exists public.focus_group_join_requests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.focus_groups(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  message      text not null default '' check (char_length(message) <= 180),
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  updated_at   timestamptz not null default now()
);

create unique index if not exists focus_group_join_requests_pending_uidx
  on public.focus_group_join_requests (group_id, requester_id)
  where status = 'pending';
create index if not exists focus_group_join_requests_group_idx
  on public.focus_group_join_requests (group_id, status, created_at desc);
create index if not exists focus_group_join_requests_user_idx
  on public.focus_group_join_requests (requester_id, status, created_at desc);

create table if not exists public.focus_group_messages (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.focus_groups(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at  timestamptz not null default now()
);

create index if not exists focus_group_messages_timeline_idx
  on public.focus_group_messages (group_id, created_at desc, id);
create index if not exists focus_group_messages_sender_rate_idx
  on public.focus_group_messages (sender_id, group_id, created_at desc);

-- ─── Nudges and presence ─────────────────────────────────────

create table if not exists public.focus_nudges (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  group_id      uuid references public.focus_groups(id) on delete cascade,
  kind          text not null default 'focus'
                  check (kind in ('focus', 'break', 'resume', 'encourage')),
  message       text not null default '' check (char_length(message) <= 160),
  sent_at       timestamptz not null default now(),
  read_at       timestamptz,
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  check (sender_id <> recipient_id),
  check (expires_at > sent_at)
);

create index if not exists focus_nudges_recipient_idx
  on public.focus_nudges (recipient_id, read_at, sent_at desc);
create index if not exists focus_nudges_sender_rate_idx
  on public.focus_nudges (sender_id, recipient_id, sent_at desc);

create table if not exists public.focus_presence (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  status             text not null default 'offline'
                       check (status in ('offline', 'available', 'focusing', 'break')),
  visibility         text not null default 'friends'
                       check (visibility in ('private', 'friends', 'groups')),
  active_session_id  uuid references public.focus_sessions(id) on delete set null,
  message            text not null default '' check (char_length(message) <= 80),
  focus_started_at   timestamptz,
  last_seen_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists focus_presence_recent_idx
  on public.focus_presence (last_seen_at desc)
  where status <> 'offline';

-- ─── Shared security helpers ─────────────────────────────────

create or replace function public.focus_is_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and auth.uid() in (p_user_a, p_user_b)
    and exists (
    select 1 from public.focus_blocks
    where (blocker_id = p_user_a and blocked_id = p_user_b)
       or (blocker_id = p_user_b and blocked_id = p_user_a)
  );
$$;

create or replace function public.focus_are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and auth.uid() in (p_user_a, p_user_b)
    and exists (
    select 1 from public.focus_friendships
    where user_low = least(p_user_a, p_user_b)
      and user_high = greatest(p_user_a, p_user_b)
  );
$$;

create or replace function public.focus_share_group(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and auth.uid() in (p_user_a, p_user_b)
    and exists (
    select 1
    from public.focus_group_members a
    join public.focus_group_members b on b.group_id = a.group_id
    where a.user_id = p_user_a and b.user_id = p_user_b
  );
$$;

create or replace function public.focus_is_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and (
      p_user_id = auth.uid()
      or exists (
        select 1 from public.focus_group_members mine
        where mine.group_id = p_group_id and mine.user_id = auth.uid()
      )
    )
    and exists (
    select 1 from public.focus_group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

create or replace function public.focus_is_group_admin(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and p_user_id = auth.uid()
    and exists (
    select 1 from public.focus_group_members
    where group_id = p_group_id
      and user_id = p_user_id
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.focus_has_pending_group_invite(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and p_user_id = auth.uid()
    and exists (
      select 1 from public.focus_group_invites
      where group_id = p_group_id and invitee_id = p_user_id
        and status = 'pending' and expires_at > now()
    );
$$;

create or replace function public.focus_has_group_invite_context(p_viewer uuid, p_profile_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and p_viewer = auth.uid()
    and exists (
      select 1
      from public.focus_group_invites invite
      where invite.status = 'pending'
        and invite.expires_at > now()
        and invite.invitee_id = p_viewer
        and invite.inviter_id = p_profile_user
    );
$$;

create or replace function public.focus_has_pending_request(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and auth.uid() in (p_user_a, p_user_b)
    and exists (
    select 1 from public.focus_friend_requests
    where status = 'pending'
      and ((sender_id = p_user_a and recipient_id = p_user_b)
        or (sender_id = p_user_b and recipient_id = p_user_a))
  );
$$;

create or replace function public.focus_has_join_request_context(p_viewer uuid, p_profile_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and p_viewer = auth.uid()
    and exists (
    select 1
    from public.focus_group_join_requests r
    where r.requester_id = p_profile_user
      and r.status = 'pending'
      and public.focus_is_group_admin(r.group_id, p_viewer)
  );
$$;

create or replace function public.focus_can_interact(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not public.focus_is_blocked(p_user_a, p_user_b)
    and (public.focus_are_friends(p_user_a, p_user_b)
      or public.focus_share_group(p_user_a, p_user_b));
$$;

-- ─── Validation and lifecycle triggers ──────────────────────

create or replace function public.focus_validate_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.display_name := btrim(new.display_name);
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone';
  end if;
  return new;
end;
$$;

create or replace function public.focus_validate_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule text;
  v_members integer;
begin
  new.name := btrim(new.name);
  new.category := btrim(new.category);
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    raise exception 'Group ownership cannot be changed through a profile update';
  end if;
  foreach v_rule in array new.rules loop
    if char_length(btrim(v_rule)) not between 1 and 180 then
      raise exception 'Each group rule must be between 1 and 180 characters';
    end if;
  end loop;
  if tg_op = 'UPDATE' then
    select count(*) into v_members from public.focus_group_members where group_id = new.id;
    if new.capacity < v_members then raise exception 'Capacity cannot be lower than current membership'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists focus_groups_validate on public.focus_groups;
create trigger focus_groups_validate
  before insert or update on public.focus_groups
  for each row execute function public.focus_validate_group();

create or replace function public.focus_enforce_group_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_members integer;
begin
  select capacity into v_capacity from public.focus_groups where id = new.group_id for update;
  if not found then raise exception 'Focus group not found'; end if;
  select count(*) into v_members from public.focus_group_members where group_id = new.group_id;
  if v_members >= v_capacity then raise exception 'This focus group is full'; end if;
  return new;
end;
$$;

drop trigger if exists focus_group_members_capacity on public.focus_group_members;
create trigger focus_group_members_capacity
  before insert on public.focus_group_members
  for each row execute function public.focus_enforce_group_capacity();

create or replace function public.focus_validate_group_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.body := btrim(new.body);
  if not public.focus_is_group_member(new.group_id, new.sender_id) then
    raise exception 'Group membership required';
  end if;
  if exists (
    select 1
    from public.focus_group_messages
    where group_id = new.group_id and sender_id = new.sender_id
      and created_at > now() - interval '1 minute'
    group by group_id, sender_id
    having count(*) >= 12
  ) then raise exception 'Please slow down before sending another message'; end if;
  return new;
end;
$$;

drop trigger if exists focus_group_messages_validate on public.focus_group_messages;
create trigger focus_group_messages_validate
  before insert on public.focus_group_messages
  for each row execute function public.focus_validate_group_message();

drop trigger if exists focus_profiles_validate on public.focus_profiles;
create trigger focus_profiles_validate
  before insert or update on public.focus_profiles
  for each row execute function public.focus_validate_profile();

create or replace function public.focus_prepare_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_wall_seconds integer;
  v_requested_note text;
begin
  if tg_op = 'UPDATE' then
    v_requested_note := new.note;
    if new.user_id <> old.user_id or new.client_session_id <> old.client_session_id then
      raise exception 'Session ownership and client ID are immutable';
    end if;
    if old.status <> 'active' then
      -- Idempotent re-sync is harmless, but finished duration metrics are
      -- immutable so a client cannot rewrite historical rankings. The user's
      -- private note remains editable after completion.
      new := old;
      new.note := coalesce(v_requested_note, old.note);
      return new;
    end if;
    new.started_at := old.started_at;
  end if;

  if new.started_at > now() + interval '5 minutes' then
    raise exception 'A focus session cannot start in the future';
  end if;

  if new.category_id is not null then
    select user_id into v_owner from public.focus_categories where id = new.category_id;
    if not found or (v_owner is not null and v_owner <> new.user_id) then
      raise exception 'This focus category is not available to the user';
    end if;
  end if;

  if new.status = 'active' then
    new.ended_at := null;
    new.duration_seconds := 0;
    new.paused_seconds := 0;
    new.pause_count := 0;
    new.interruption_count := 0;
    new.interruption_seconds := 0;
    new.completion_reason := null;
  elsif new.status = 'cancelled' then
    new.ended_at := coalesce(new.ended_at, now());
    new.duration_seconds := 0;
    new.completion_reason := 'cancelled';
  else
    if new.ended_at is null or new.ended_at < new.started_at then
      raise exception 'A completed focus session needs a valid end time';
    end if;
    if new.ended_at > now() + interval '5 minutes' then
      raise exception 'A focus session cannot end in the future';
    end if;
    if new.ended_at - new.started_at > interval '12 hours' then
      raise exception 'A single focus session cannot exceed 12 hours';
    end if;
    v_wall_seconds := floor(extract(epoch from (new.ended_at - new.started_at)))::integer;
    if new.duration_seconds > v_wall_seconds + 5 then
      raise exception 'Focused duration cannot exceed wall-clock duration';
    end if;
    if new.paused_seconds > v_wall_seconds + 5 or new.interruption_seconds > v_wall_seconds + 5 then
      raise exception 'Pause or interruption duration exceeds wall-clock duration';
    end if;
    if new.duration_seconds + new.paused_seconds > v_wall_seconds + 10 then
      raise exception 'Focused and paused durations are inconsistent';
    end if;
    new.completion_reason := coalesce(new.completion_reason, 'manual');
  end if;
  return new;
end;
$$;

drop trigger if exists focus_sessions_prepare on public.focus_sessions;
create trigger focus_sessions_prepare
  before insert or update on public.focus_sessions
  for each row execute function public.focus_prepare_session();

create or replace function public.focus_validate_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active_session_id is not null and not exists (
    select 1 from public.focus_sessions
    where id = new.active_session_id and user_id = new.user_id and status = 'active'
  ) then raise exception 'Active focus session does not belong to this user'; end if;
  if new.status <> 'focusing' then
    new.active_session_id := null;
    new.focus_started_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists focus_presence_validate on public.focus_presence;
create trigger focus_presence_validate
  before insert or update on public.focus_presence
  for each row execute function public.focus_validate_presence();

create or replace function public.focus_cleanup_blocked_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.focus_friendships
  where user_low = least(new.blocker_id, new.blocked_id)
    and user_high = greatest(new.blocker_id, new.blocked_id);

  update public.focus_friend_requests
  set status = 'cancelled', responded_at = now(), updated_at = now()
  where status = 'pending'
    and ((sender_id = new.blocker_id and recipient_id = new.blocked_id)
      or (sender_id = new.blocked_id and recipient_id = new.blocker_id));
  return new;
end;
$$;

drop trigger if exists focus_blocks_cleanup_pair on public.focus_blocks;
create trigger focus_blocks_cleanup_pair
  after insert on public.focus_blocks
  for each row execute function public.focus_cleanup_blocked_pair();

drop trigger if exists focus_profiles_touch_updated_at on public.focus_profiles;
create trigger focus_profiles_touch_updated_at
  before update on public.focus_profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists focus_categories_touch_updated_at on public.focus_categories;
create trigger focus_categories_touch_updated_at
  before update on public.focus_categories
  for each row execute function public.touch_updated_at();
drop trigger if exists focus_sessions_touch_updated_at on public.focus_sessions;
create trigger focus_sessions_touch_updated_at
  before update on public.focus_sessions
  for each row execute function public.touch_updated_at();
drop trigger if exists focus_friend_requests_touch_updated_at on public.focus_friend_requests;
create trigger focus_friend_requests_touch_updated_at
  before update on public.focus_friend_requests
  for each row execute function public.touch_updated_at();
drop trigger if exists focus_groups_touch_updated_at on public.focus_groups;
create trigger focus_groups_touch_updated_at
  before update on public.focus_groups
  for each row execute function public.touch_updated_at();
drop trigger if exists focus_group_invites_touch_updated_at on public.focus_group_invites;
create trigger focus_group_invites_touch_updated_at
  before update on public.focus_group_invites
  for each row execute function public.touch_updated_at();
drop trigger if exists focus_group_join_requests_touch_updated_at on public.focus_group_join_requests;
create trigger focus_group_join_requests_touch_updated_at
  before update on public.focus_group_join_requests
  for each row execute function public.touch_updated_at();
drop trigger if exists focus_presence_touch_updated_at on public.focus_presence;
create trigger focus_presence_touch_updated_at
  before update on public.focus_presence
  for each row execute function public.touch_updated_at();

-- ─── Row-level security ──────────────────────────────────────

alter table public.focus_profiles enable row level security;
alter table public.focus_contact_hashes enable row level security;
alter table public.focus_contact_lookup_limits enable row level security;
alter table public.focus_categories enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.focus_friend_requests enable row level security;
alter table public.focus_friendships enable row level security;
alter table public.focus_blocks enable row level security;
alter table public.focus_groups enable row level security;
alter table public.focus_group_members enable row level security;
alter table public.focus_group_invites enable row level security;
alter table public.focus_group_join_requests enable row level security;
alter table public.focus_group_messages enable row level security;
alter table public.focus_nudges enable row level security;
alter table public.focus_presence enable row level security;

drop policy if exists focus_profiles_read_scoped on public.focus_profiles;
create policy focus_profiles_read_scoped on public.focus_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      not public.focus_is_blocked(auth.uid(), user_id)
      and (public.focus_are_friends(auth.uid(), user_id)
        or public.focus_share_group(auth.uid(), user_id)
        or public.focus_has_pending_request(auth.uid(), user_id)
        or public.focus_has_group_invite_context(auth.uid(), user_id)
        or public.focus_has_join_request_context(auth.uid(), user_id))
    )
  );
drop policy if exists focus_profiles_insert_own on public.focus_profiles;
create policy focus_profiles_insert_own on public.focus_profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists focus_profiles_update_own on public.focus_profiles;
create policy focus_profiles_update_own on public.focus_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists focus_profiles_delete_own on public.focus_profiles;
create policy focus_profiles_delete_own on public.focus_profiles
  for delete to authenticated using (user_id = auth.uid());

-- No direct policy intentionally exists for focus_contact_hashes. Only the
-- security-definer sync and lookup RPCs below may touch them.

drop policy if exists focus_categories_read_available on public.focus_categories;
create policy focus_categories_read_available on public.focus_categories
  for select to authenticated using (user_id is null or user_id = auth.uid());
drop policy if exists focus_categories_insert_own on public.focus_categories;
create policy focus_categories_insert_own on public.focus_categories
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists focus_categories_update_own on public.focus_categories;
create policy focus_categories_update_own on public.focus_categories
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists focus_categories_delete_own on public.focus_categories;
create policy focus_categories_delete_own on public.focus_categories
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists focus_sessions_read_own on public.focus_sessions;
create policy focus_sessions_read_own on public.focus_sessions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists focus_sessions_insert_own on public.focus_sessions;
create policy focus_sessions_insert_own on public.focus_sessions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists focus_sessions_update_own on public.focus_sessions;
create policy focus_sessions_update_own on public.focus_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists focus_sessions_delete_own on public.focus_sessions;
create policy focus_sessions_delete_own on public.focus_sessions
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists focus_friend_requests_read_participant on public.focus_friend_requests;
create policy focus_friend_requests_read_participant on public.focus_friend_requests
  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists focus_friendships_read_participant on public.focus_friendships;
create policy focus_friendships_read_participant on public.focus_friendships
  for select to authenticated using (user_low = auth.uid() or user_high = auth.uid());
drop policy if exists focus_friendships_delete_participant on public.focus_friendships;
create policy focus_friendships_delete_participant on public.focus_friendships
  for delete to authenticated using (user_low = auth.uid() or user_high = auth.uid());

drop policy if exists focus_blocks_read_own on public.focus_blocks;
create policy focus_blocks_read_own on public.focus_blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists focus_blocks_insert_own on public.focus_blocks;
create policy focus_blocks_insert_own on public.focus_blocks
  for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists focus_blocks_delete_own on public.focus_blocks;
create policy focus_blocks_delete_own on public.focus_blocks
  for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists focus_groups_read_member on public.focus_groups;
create policy focus_groups_read_member on public.focus_groups
  for select to authenticated using (
    privacy = 'public'
    or public.focus_is_group_member(id)
    or public.focus_has_pending_group_invite(id)
  );
drop policy if exists focus_groups_update_admin on public.focus_groups;
create policy focus_groups_update_admin on public.focus_groups
  for update to authenticated using (public.focus_is_group_admin(id)) with check (public.focus_is_group_admin(id));
drop policy if exists focus_groups_delete_owner on public.focus_groups;
create policy focus_groups_delete_owner on public.focus_groups
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists focus_group_members_read_member on public.focus_group_members;
create policy focus_group_members_read_member on public.focus_group_members
  for select to authenticated using (public.focus_is_group_member(group_id));

drop policy if exists focus_group_invites_read_scoped on public.focus_group_invites;
create policy focus_group_invites_read_scoped on public.focus_group_invites
  for select to authenticated
  using (invitee_id = auth.uid() or inviter_id = auth.uid() or public.focus_is_group_admin(group_id));

drop policy if exists focus_group_join_requests_read_scoped on public.focus_group_join_requests;
create policy focus_group_join_requests_read_scoped on public.focus_group_join_requests
  for select to authenticated
  using (requester_id = auth.uid() or public.focus_is_group_admin(group_id));

drop policy if exists focus_group_messages_read_member on public.focus_group_messages;
create policy focus_group_messages_read_member on public.focus_group_messages
  for select to authenticated using (
    public.focus_is_group_member(group_id)
    and not public.focus_is_blocked(auth.uid(), sender_id)
  );
drop policy if exists focus_group_messages_insert_member on public.focus_group_messages;
create policy focus_group_messages_insert_member on public.focus_group_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.focus_is_group_member(group_id));
drop policy if exists focus_group_messages_delete_sender_or_admin on public.focus_group_messages;
create policy focus_group_messages_delete_sender_or_admin on public.focus_group_messages
  for delete to authenticated
  using (sender_id = auth.uid() or public.focus_is_group_admin(group_id));

drop policy if exists focus_nudges_read_participant on public.focus_nudges;
create policy focus_nudges_read_participant on public.focus_nudges
  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists focus_presence_read_scoped on public.focus_presence;
create policy focus_presence_read_scoped on public.focus_presence
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      visibility <> 'private'
      and not public.focus_is_blocked(auth.uid(), user_id)
      and (
        (visibility = 'friends' and (
          public.focus_are_friends(auth.uid(), user_id)
          or public.focus_share_group(auth.uid(), user_id)
        ))
        or (visibility = 'groups' and public.focus_share_group(auth.uid(), user_id))
      )
    )
  );
drop policy if exists focus_presence_insert_own on public.focus_presence;
create policy focus_presence_insert_own on public.focus_presence
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists focus_presence_update_own on public.focus_presence;
create policy focus_presence_update_own on public.focus_presence
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists focus_presence_delete_own on public.focus_presence;
create policy focus_presence_delete_own on public.focus_presence
  for delete to authenticated using (user_id = auth.uid());

-- ─── Contact discovery RPCs ──────────────────────────────────

create or replace function public.sync_my_focus_contact_hashes()
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_phone text;
  v_normalized text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select email, phone into v_email, v_phone
  from auth.users where id = auth.uid();

  delete from public.focus_contact_hashes where user_id = auth.uid();

  if nullif(btrim(v_email), '') is not null then
    v_normalized := lower(btrim(v_email));
    insert into public.focus_contact_hashes (user_id, contact_kind, contact_hash)
    values (auth.uid(), 'email', encode(digest(convert_to('email:' || v_normalized, 'UTF8'), 'sha256'), 'hex'))
    on conflict (contact_kind, contact_hash) do nothing;
  end if;

  if nullif(btrim(v_phone), '') is not null then
    v_normalized := regexp_replace(v_phone, '[^0-9]', '', 'g');
    if char_length(v_normalized) = 10 then v_normalized := '91' || v_normalized; end if;
    if char_length(v_normalized) between 8 and 15 then
      insert into public.focus_contact_hashes (user_id, contact_kind, contact_hash)
      values (auth.uid(), 'phone', encode(digest(convert_to('phone:' || v_normalized, 'UTF8'), 'sha256'), 'hex'))
      on conflict (contact_kind, contact_hash) do nothing;
    end if;
  end if;
end;
$$;

create or replace function public.find_focus_profile_by_hash(p_contact_kind text, p_contact_hash text)
returns table (
  user_id uuid,
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
  select p.user_id, p.display_name, p.avatar_url, p.headline,
    case
      when public.focus_are_friends(auth.uid(), p.user_id) then 'friend'
      when exists (select 1 from public.focus_friend_requests r where r.sender_id = auth.uid() and r.recipient_id = p.user_id and r.status = 'pending') then 'outgoing'
      when exists (select 1 from public.focus_friend_requests r where r.recipient_id = auth.uid() and r.sender_id = p.user_id and r.status = 'pending') then 'incoming'
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

-- ─── Friend and block RPCs ───────────────────────────────────

create or replace function public.send_focus_friend_request(p_recipient_id uuid, p_message text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_recipient_id = auth.uid() then raise exception 'You cannot add yourself'; end if;
  if public.focus_is_blocked(auth.uid(), p_recipient_id) then raise exception 'This connection is unavailable'; end if;
  if public.focus_are_friends(auth.uid(), p_recipient_id) then raise exception 'You are already friends'; end if;
  if not exists (
    select 1 from public.focus_profiles
    where user_id = p_recipient_id
      and allow_friend_requests = true
      and (discoverable = true or public.focus_share_group(auth.uid(), p_recipient_id))
  ) then raise exception 'Focus profile not found'; end if;
  if public.focus_has_pending_request(auth.uid(), p_recipient_id) then raise exception 'A request is already pending'; end if;

  insert into public.focus_friend_requests (sender_id, recipient_id, message)
  values (auth.uid(), p_recipient_id, left(coalesce(p_message, ''), 180))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.respond_focus_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.focus_friend_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_request from public.focus_friend_requests where id = p_request_id for update;
  if not found or v_request.recipient_id <> auth.uid() or v_request.status <> 'pending' then
    raise exception 'Pending friend request not found';
  end if;
  if public.focus_is_blocked(v_request.sender_id, v_request.recipient_id) then
    raise exception 'This connection is unavailable';
  end if;

  update public.focus_friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now()
  where id = p_request_id;

  if p_accept then
    insert into public.focus_friendships (user_low, user_high, request_id)
    values (least(v_request.sender_id, v_request.recipient_id), greatest(v_request.sender_id, v_request.recipient_id), p_request_id)
    on conflict (user_low, user_high) do nothing;
  end if;
end;
$$;

create or replace function public.cancel_focus_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.focus_friend_requests
  set status = 'cancelled', responded_at = now(), updated_at = now()
  where id = p_request_id and sender_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pending friend request not found'; end if;
end;
$$;

create or replace function public.remove_focus_friend(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.focus_friendships
  where user_low = least(auth.uid(), p_user_id)
    and user_high = greatest(auth.uid(), p_user_id);
end;
$$;

create or replace function public.set_focus_block(p_user_id uuid, p_blocked boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot block yourself'; end if;
  if p_blocked then
    insert into public.focus_blocks (blocker_id, blocked_id)
    values (auth.uid(), p_user_id) on conflict do nothing;
  else
    delete from public.focus_blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
  end if;
end;
$$;

-- ─── Group RPCs ──────────────────────────────────────────────

create or replace function public.list_focus_groups(
  p_scope text default 'mine',
  p_category text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  privacy text,
  category text,
  rules text[],
  weekly_goal_seconds integer,
  capacity integer,
  join_policy text,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint,
  live_count bigint,
  caller_role text,
  is_member boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_scope not in ('mine', 'discover', 'all') then raise exception 'Invalid group scope'; end if;

  return query
  select g.id, g.owner_id, g.name, g.description, g.privacy, g.category, g.rules,
    g.weekly_goal_seconds, g.capacity, g.join_policy, g.created_at, g.updated_at,
    (select count(*) from public.focus_group_members members where members.group_id = g.id)::bigint,
    (select count(*)
      from public.focus_group_members live_members
      join public.focus_presence presence on presence.user_id = live_members.user_id
      where live_members.group_id = g.id
        and mine.user_id is not null
        and presence.status = 'focusing'
        and presence.visibility in ('friends', 'groups')
        and not public.focus_is_blocked(auth.uid(), presence.user_id)
        and presence.last_seen_at > now() - interval '3 minutes')::bigint,
    mine.role,
    mine.user_id is not null
  from public.focus_groups g
  left join public.focus_group_members mine
    on mine.group_id = g.id and mine.user_id = auth.uid()
  where (p_category is null or g.category = p_category)
    and case p_scope
      when 'mine' then mine.user_id is not null
      when 'discover' then g.privacy = 'public' and mine.user_id is null
      else g.privacy = 'public' or mine.user_id is not null
    end
  order by (mine.user_id is not null) desc, g.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.create_focus_group(
  p_name text,
  p_description text default '',
  p_privacy text default 'private',
  p_category text default 'General UPSC',
  p_rules text[] default '{}',
  p_weekly_goal_seconds integer default 126000,
  p_capacity integer default 50,
  p_join_policy text default 'invite'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 60 then raise exception 'Enter a valid group name'; end if;

  insert into public.focus_groups (
    owner_id, name, description, privacy, category, rules,
    weekly_goal_seconds, capacity, join_policy
  ) values (
    auth.uid(), btrim(p_name), left(coalesce(p_description, ''), 280), p_privacy,
    btrim(p_category), coalesce(p_rules, '{}'), p_weekly_goal_seconds, p_capacity, p_join_policy
  )
  returning id into v_group_id;
  insert into public.focus_group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'owner');
  return v_group_id;
end;
$$;

create or replace function public.request_or_join_focus_group(p_group_id uuid, p_message text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.focus_groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_group from public.focus_groups where id = p_group_id for update;
  if not found or v_group.privacy <> 'public' then raise exception 'Public focus group not found'; end if;
  if public.focus_is_group_member(p_group_id, auth.uid()) then return 'member'; end if;

  if v_group.join_policy = 'open' then
    insert into public.focus_group_members (group_id, user_id, role)
    values (p_group_id, auth.uid(), 'member');
    return 'joined';
  elsif v_group.join_policy = 'request' then
    if exists (
      select 1 from public.focus_group_join_requests
      where group_id = p_group_id and requester_id = auth.uid() and status = 'pending'
    ) then return 'pending'; end if;
    insert into public.focus_group_join_requests (group_id, requester_id, message)
    values (p_group_id, auth.uid(), left(coalesce(p_message, ''), 180));
    return 'requested';
  end if;
  raise exception 'This group accepts invitations only';
end;
$$;

create or replace function public.respond_focus_group_join_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.focus_group_join_requests%rowtype;
begin
  select * into v_request from public.focus_group_join_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' or not public.focus_is_group_admin(v_request.group_id) then
    raise exception 'Pending join request not found';
  end if;
  update public.focus_group_join_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now()
  where id = p_request_id;
  if p_accept then
    insert into public.focus_group_members (group_id, user_id, role)
    values (v_request.group_id, v_request.requester_id, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;
end;
$$;

create or replace function public.cancel_focus_group_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.focus_group_join_requests
  set status = 'cancelled', responded_at = now(), updated_at = now()
  where id = p_request_id and requester_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pending join request not found'; end if;
end;
$$;

create or replace function public.invite_focus_group_by_hash(
  p_group_id uuid,
  p_contact_kind text,
  p_contact_hash text,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitee_id uuid;
  v_capacity integer;
  v_member_count integer;
  v_count integer;
  v_window timestamptz := date_trunc('hour', now());
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.focus_is_group_admin(p_group_id) then raise exception 'Group admin access required'; end if;
  if p_contact_kind not in ('email', 'phone') or p_contact_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid contact hash';
  end if;

  select capacity into v_capacity from public.focus_groups where id = p_group_id for update;
  select count(*) into v_member_count from public.focus_group_members where group_id = p_group_id;
  if v_member_count >= v_capacity then raise exception 'This focus group is full'; end if;

  insert into public.focus_contact_lookup_limits (user_id, window_start, lookup_count)
  values (auth.uid(), v_window, 1)
  on conflict (user_id, window_start) do update
    set lookup_count = public.focus_contact_lookup_limits.lookup_count + 1
  returning lookup_count into v_count;
  if v_count > 30 then raise exception 'Contact lookup limit reached; try again later'; end if;
  delete from public.focus_contact_lookup_limits
  where user_id = auth.uid() and window_start < v_window - interval '24 hours';

  select hashes.user_id into v_invitee_id
  from public.focus_contact_hashes hashes
  join public.focus_profiles profile on profile.user_id = hashes.user_id
  where hashes.contact_kind = p_contact_kind
    and hashes.contact_hash = lower(p_contact_hash)
    and profile.allow_group_invites = true
  limit 1;

  if v_invitee_id is null or v_invitee_id = auth.uid() then
    return null;
  end if;
  if public.focus_is_blocked(auth.uid(), v_invitee_id) then return null; end if;
  -- Match-dependent outcomes stay deliberately indistinguishable. An admin
  -- who knows a contact must not be able to prove which account owns it.
  if public.focus_is_group_member(p_group_id, v_invitee_id) then return null; end if;

  update public.focus_group_invites
  set status = 'expired', responded_at = now(), updated_at = now()
  where group_id = p_group_id and invitee_id = v_invitee_id
    and status = 'pending' and expires_at <= now();
  if exists (
    select 1 from public.focus_group_invites
    where group_id = p_group_id and invitee_id = v_invitee_id
      and status = 'pending' and expires_at > now()
  ) then return null; end if;

  insert into public.focus_group_invites (group_id, inviter_id, invitee_id, message)
  values (p_group_id, auth.uid(), v_invitee_id, left(coalesce(p_message, ''), 180))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.invite_focus_group(p_group_id uuid, p_invitee_id uuid, p_message text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.focus_is_group_admin(p_group_id) then raise exception 'Group admin access required'; end if;
  if p_invitee_id = auth.uid() then raise exception 'You are already in this group'; end if;
  if public.focus_is_blocked(auth.uid(), p_invitee_id) then raise exception 'This connection is unavailable'; end if;
  if not public.focus_can_interact(auth.uid(), p_invitee_id) then raise exception 'Only friends or existing group peers can be invited'; end if;
  if public.focus_is_group_member(p_group_id, p_invitee_id) then raise exception 'This person is already a member'; end if;
  if not exists (
    select 1 from public.focus_profiles
    where user_id = p_invitee_id and allow_group_invites = true
  ) then raise exception 'This person is not accepting group invitations'; end if;

  update public.focus_group_invites
  set status = 'expired', responded_at = now(), updated_at = now()
  where group_id = p_group_id and invitee_id = p_invitee_id and status = 'pending' and expires_at <= now();

  insert into public.focus_group_invites (group_id, inviter_id, invitee_id, message)
  values (p_group_id, auth.uid(), p_invitee_id, left(coalesce(p_message, ''), 180))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.respond_focus_group_invite(p_invite_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.focus_group_invites%rowtype;
begin
  select * into v_invite from public.focus_group_invites where id = p_invite_id for update;
  if not found or v_invite.invitee_id <> auth.uid() or v_invite.status <> 'pending' then
    raise exception 'Pending group invite not found';
  end if;
  if v_invite.expires_at <= now() then
    update public.focus_group_invites set status = 'expired', responded_at = now(), updated_at = now() where id = p_invite_id;
    return 'expired';
  end if;
  if public.focus_is_blocked(v_invite.inviter_id, v_invite.invitee_id) then raise exception 'This invite is unavailable'; end if;

  update public.focus_group_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now()
  where id = p_invite_id;
  if p_accept then
    insert into public.focus_group_members (group_id, user_id, role)
    values (v_invite.group_id, auth.uid(), 'member')
    on conflict (group_id, user_id) do nothing;
  end if;
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

create or replace function public.leave_focus_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.focus_groups where id = p_group_id and owner_id = auth.uid()) then
    raise exception 'The owner must delete the group or transfer ownership';
  end if;
  delete from public.focus_group_members where group_id = p_group_id and user_id = auth.uid();
  if not found then raise exception 'Group membership not found'; end if;
end;
$$;

create or replace function public.remove_focus_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.focus_is_group_admin(p_group_id) then raise exception 'Group admin access required'; end if;
  if exists (select 1 from public.focus_groups where id = p_group_id and owner_id = p_user_id) then
    raise exception 'The group owner cannot be removed';
  end if;
  delete from public.focus_group_members where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- ─── Nudge RPCs ──────────────────────────────────────────────

create or replace function public.send_focus_nudge(
  p_recipient_id uuid,
  p_kind text default 'focus',
  p_message text default '',
  p_group_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_recipient_id = auth.uid() then raise exception 'You cannot nudge yourself'; end if;
  if p_kind not in ('focus', 'break', 'resume', 'encourage') then raise exception 'Invalid nudge type'; end if;
  if public.focus_is_blocked(auth.uid(), p_recipient_id) then raise exception 'This connection is unavailable'; end if;

  if p_group_id is null then
    if not public.focus_are_friends(auth.uid(), p_recipient_id) then raise exception 'Only friends can be nudged directly'; end if;
  elsif not (public.focus_is_group_member(p_group_id, auth.uid()) and public.focus_is_group_member(p_group_id, p_recipient_id)) then
    raise exception 'Both users must belong to this group';
  end if;

  if exists (
    select 1 from public.focus_nudges
    where sender_id = auth.uid() and recipient_id = p_recipient_id
      and sent_at > now() - interval '10 minutes'
  ) then raise exception 'Please wait before sending another nudge'; end if;

  insert into public.focus_nudges (sender_id, recipient_id, group_id, kind, message)
  values (auth.uid(), p_recipient_id, p_group_id, p_kind, left(coalesce(p_message, ''), 160))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.mark_focus_nudges_read(p_nudge_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.focus_nudges
  set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid() and read_at is null
    and (p_nudge_id is null or id = p_nudge_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ─── Scoped timezone-aware ranking RPC ───────────────────────

create or replace function public.focus_ranking(
  p_period text default 'week',
  p_timezone text default 'Asia/Kolkata',
  p_group_id uuid default null
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_seconds bigint,
  session_count bigint,
  rank_position bigint,
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_period text := lower(coalesce(p_period, 'week'));
  v_timezone text := coalesce(nullif(p_timezone, ''), 'Asia/Kolkata');
  v_local_start timestamp;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_period not in ('day', 'week', 'month') then raise exception 'Period must be day, week or month'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then raise exception 'Unknown timezone'; end if;
  if p_group_id is not null and not public.focus_is_group_member(p_group_id) then raise exception 'Group membership required'; end if;

  v_local_start := date_trunc(v_period, timezone(v_timezone, now()));
  v_start := v_local_start at time zone v_timezone;
  v_end := (v_local_start + case v_period
    when 'day' then interval '1 day'
    when 'week' then interval '1 week'
    else interval '1 month'
  end) at time zone v_timezone;

  return query
  with eligible as (
    select auth.uid() as uid
    where p_group_id is null
    union
    select case when f.user_low = auth.uid() then f.user_high else f.user_low end
    from public.focus_friendships f
    where p_group_id is null and (f.user_low = auth.uid() or f.user_high = auth.uid())
    union
    select gm.user_id
    from public.focus_group_members gm
    where p_group_id is not null and gm.group_id = p_group_id
  ), totals as (
    select e.uid,
      coalesce(sum(s.duration_seconds) filter (where s.id is not null), 0)::bigint as seconds,
      count(s.id)::bigint as sessions
    from eligible e
    left join public.focus_sessions s
      on s.user_id = e.uid
      and s.status = 'completed'
      and s.phase = 'focus'
      and s.ended_at >= v_start
      and s.ended_at < v_end
    where not public.focus_is_blocked(auth.uid(), e.uid)
    group by e.uid
  ), ranked as (
    select t.*,
      dense_rank() over (order by t.seconds desc, t.sessions desc, t.uid)::bigint as position
    from totals t
    join public.focus_profiles fp on fp.user_id = t.uid
    where fp.show_in_rankings = true or fp.user_id = auth.uid()
  )
  select r.uid, fp.display_name, fp.avatar_url, r.seconds, r.sessions, r.position, v_start, v_end
  from ranked r
  join public.focus_profiles fp on fp.user_id = r.uid
  order by r.position, fp.display_name;
end;
$$;

-- RPCs and policy helpers are authenticated-only. The anon key has no social
-- graph or contact-discovery access even if it can reach the REST endpoint.
revoke all on function public.focus_is_blocked(uuid, uuid) from public;
revoke all on function public.focus_are_friends(uuid, uuid) from public;
revoke all on function public.focus_share_group(uuid, uuid) from public;
revoke all on function public.focus_is_group_member(uuid, uuid) from public;
revoke all on function public.focus_is_group_admin(uuid, uuid) from public;
revoke all on function public.focus_has_pending_group_invite(uuid, uuid) from public;
revoke all on function public.focus_has_group_invite_context(uuid, uuid) from public;
revoke all on function public.focus_has_pending_request(uuid, uuid) from public;
revoke all on function public.focus_has_join_request_context(uuid, uuid) from public;
revoke all on function public.focus_can_interact(uuid, uuid) from public;
revoke all on function public.sync_my_focus_contact_hashes() from public;
revoke all on function public.find_focus_profile_by_hash(text, text) from public;
revoke all on function public.send_focus_friend_request(uuid, text) from public;
revoke all on function public.respond_focus_friend_request(uuid, boolean) from public;
revoke all on function public.cancel_focus_friend_request(uuid) from public;
revoke all on function public.remove_focus_friend(uuid) from public;
revoke all on function public.set_focus_block(uuid, boolean) from public;
revoke all on function public.list_focus_groups(text, text, integer) from public;
revoke all on function public.create_focus_group(text, text, text, text, text[], integer, integer, text) from public;
revoke all on function public.request_or_join_focus_group(uuid, text) from public;
revoke all on function public.respond_focus_group_join_request(uuid, boolean) from public;
revoke all on function public.cancel_focus_group_join_request(uuid) from public;
revoke all on function public.invite_focus_group_by_hash(uuid, text, text, text) from public;
revoke all on function public.invite_focus_group(uuid, uuid, text) from public;
revoke all on function public.respond_focus_group_invite(uuid, boolean) from public;
revoke all on function public.leave_focus_group(uuid) from public;
revoke all on function public.remove_focus_group_member(uuid, uuid) from public;
revoke all on function public.send_focus_nudge(uuid, text, text, uuid) from public;
revoke all on function public.mark_focus_nudges_read(uuid) from public;
revoke all on function public.focus_ranking(text, text, uuid) from public;

grant execute on function public.focus_is_blocked(uuid, uuid) to authenticated;
grant execute on function public.focus_are_friends(uuid, uuid) to authenticated;
grant execute on function public.focus_share_group(uuid, uuid) to authenticated;
grant execute on function public.focus_is_group_member(uuid, uuid) to authenticated;
grant execute on function public.focus_is_group_admin(uuid, uuid) to authenticated;
grant execute on function public.focus_has_pending_group_invite(uuid, uuid) to authenticated;
grant execute on function public.focus_has_group_invite_context(uuid, uuid) to authenticated;
grant execute on function public.focus_has_pending_request(uuid, uuid) to authenticated;
grant execute on function public.focus_has_join_request_context(uuid, uuid) to authenticated;
grant execute on function public.focus_can_interact(uuid, uuid) to authenticated;
grant execute on function public.sync_my_focus_contact_hashes() to authenticated;
grant execute on function public.find_focus_profile_by_hash(text, text) to authenticated;
grant execute on function public.send_focus_friend_request(uuid, text) to authenticated;
grant execute on function public.respond_focus_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_focus_friend_request(uuid) to authenticated;
grant execute on function public.remove_focus_friend(uuid) to authenticated;
grant execute on function public.set_focus_block(uuid, boolean) to authenticated;
grant execute on function public.list_focus_groups(text, text, integer) to authenticated;
grant execute on function public.create_focus_group(text, text, text, text, text[], integer, integer, text) to authenticated;
grant execute on function public.request_or_join_focus_group(uuid, text) to authenticated;
grant execute on function public.respond_focus_group_join_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_focus_group_join_request(uuid) to authenticated;
grant execute on function public.invite_focus_group_by_hash(uuid, text, text, text) to authenticated;
grant execute on function public.invite_focus_group(uuid, uuid, text) to authenticated;
grant execute on function public.respond_focus_group_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_focus_group(uuid) to authenticated;
grant execute on function public.remove_focus_group_member(uuid, uuid) to authenticated;
grant execute on function public.send_focus_nudge(uuid, text, text, uuid) to authenticated;
grant execute on function public.mark_focus_nudges_read(uuid) to authenticated;
grant execute on function public.focus_ranking(text, text, uuid) to authenticated;

-- Presence changes can be subscribed to through Supabase Realtime; RLS still
-- controls which rows a subscriber is allowed to receive.
do $$
begin
  alter publication supabase_realtime add table public.focus_presence;
exception
  when duplicate_object then null;
  when undefined_object then null;
  when insufficient_privilege then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.focus_group_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
  when insufficient_privilege then null;
end $$;
