-- Separate private aggregate sharing from optional leaderboard visibility.
-- Existing show_in_rankings values are deliberately preserved; only the
-- default for newly-created Focus profiles becomes private.

alter table public.focus_profiles
  add column if not exists share_focus_totals boolean not null default false;

alter table public.focus_profiles
  alter column share_focus_totals set default false;

update public.focus_profiles
set share_focus_totals = false
where share_focus_totals is null;

alter table public.focus_profiles
  alter column share_focus_totals set not null;

alter table public.focus_profiles
  alter column show_in_rankings set default false;

comment on column public.focus_profiles.share_focus_totals is
  'Allows accepted friends and shared-group peers to read day/week/month aggregate focus totals. Raw sessions remain private.';

comment on column public.focus_profiles.show_in_rankings is
  'Independent opt-in for eligible Focus rankings; it does not grant access to non-ranking aggregate summaries.';

create or replace function public.focus_shared_totals(
  p_target_user_ids uuid[] default null,
  p_timezone text default 'Asia/Kolkata'
)
returns table (
  user_id uuid,
  day_seconds bigint,
  week_seconds bigint,
  month_seconds bigint,
  totals_shared boolean
)
language plpgsql
security definer
set search_path = pg_catalog
stable
as $$
declare
  v_viewer uuid := auth.uid();
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'Asia/Kolkata');
  v_local_now timestamp;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_month_start timestamptz;
  v_month_end timestamptz;
begin
  if v_viewer is null then
    raise exception 'Authentication required';
  end if;
  if p_target_user_ids is null or cardinality(p_target_user_ids) = 0 then
    return;
  end if;
  if cardinality(p_target_user_ids) > 200 then
    raise exception 'At most 200 Focus profiles can be requested at once';
  end if;
  if array_position(p_target_user_ids, null) is not null then
    raise exception 'Target user IDs cannot contain null';
  end if;
  if char_length(v_timezone) > 64
     or not exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = v_timezone) then
    raise exception 'Unknown timezone';
  end if;

  v_local_now := pg_catalog.timezone(v_timezone, pg_catalog.now());
  v_day_start := pg_catalog.timezone(v_timezone, pg_catalog.date_trunc('day', v_local_now));
  v_day_end := pg_catalog.timezone(v_timezone, pg_catalog.date_trunc('day', v_local_now) + interval '1 day');
  v_week_start := pg_catalog.timezone(v_timezone, pg_catalog.date_trunc('week', v_local_now));
  v_week_end := pg_catalog.timezone(v_timezone, pg_catalog.date_trunc('week', v_local_now) + interval '1 week');
  v_month_start := pg_catalog.timezone(v_timezone, pg_catalog.date_trunc('month', v_local_now));
  v_month_end := pg_catalog.timezone(v_timezone, pg_catalog.date_trunc('month', v_local_now) + interval '1 month');

  return query
  with requested as (
    select distinct requested_id as uid
    from pg_catalog.unnest(p_target_user_ids) as target(requested_id)
  ), authorized as (
    select requested.uid, profile.share_focus_totals
    from requested
    join public.focus_profiles as profile on profile.user_id = requested.uid
    where requested.uid = v_viewer
       or (
         not exists (
           select 1
           from public.focus_blocks as block
           where (block.blocker_id = v_viewer and block.blocked_id = requested.uid)
              or (block.blocker_id = requested.uid and block.blocked_id = v_viewer)
         )
         and (
           exists (
             select 1
             from public.focus_friendships as friendship
             where friendship.user_low = least(v_viewer, requested.uid)
               and friendship.user_high = greatest(v_viewer, requested.uid)
           )
           or exists (
             select 1
             from public.focus_group_members as mine
             join public.focus_group_members as peer on peer.group_id = mine.group_id
             where mine.user_id = v_viewer
               and peer.user_id = requested.uid
           )
         )
       )
  )
  select
    authorized.uid,
    coalesce(sum(focus_session.duration_seconds) filter (
      where (authorized.uid = v_viewer or authorized.share_focus_totals)
        and focus_session.ended_at >= v_day_start
        and focus_session.ended_at < v_day_end
    ), 0)::bigint as day_seconds,
    coalesce(sum(focus_session.duration_seconds) filter (
      where (authorized.uid = v_viewer or authorized.share_focus_totals)
        and focus_session.ended_at >= v_week_start
        and focus_session.ended_at < v_week_end
    ), 0)::bigint as week_seconds,
    coalesce(sum(focus_session.duration_seconds) filter (
      where (authorized.uid = v_viewer or authorized.share_focus_totals)
        and focus_session.ended_at >= v_month_start
        and focus_session.ended_at < v_month_end
    ), 0)::bigint as month_seconds,
    (authorized.uid = v_viewer or authorized.share_focus_totals) as totals_shared
  from authorized
  left join public.focus_sessions as focus_session
    on focus_session.user_id = authorized.uid
   and focus_session.status = 'completed'
   and focus_session.phase = 'focus'
   and focus_session.ended_at >= least(v_day_start, v_week_start, v_month_start)
   and focus_session.ended_at < greatest(v_day_end, v_week_end, v_month_end)
  group by authorized.uid, authorized.share_focus_totals
  order by authorized.uid;
end;
$$;

comment on function public.focus_shared_totals(uuid[], text) is
  'Returns privacy-gated aggregate Focus totals for the caller, accepted friends, or shared-group peers. Blocked pairs are always excluded.';

revoke all on function public.focus_shared_totals(uuid[], text) from public;
revoke all on function public.focus_shared_totals(uuid[], text) from anon;
grant execute on function public.focus_shared_totals(uuid[], text) to authenticated;
