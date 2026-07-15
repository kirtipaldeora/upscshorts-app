-- Penni student accounts and cross-device learning state.
-- Every row is owned by exactly one Supabase Auth user. The publishable key
-- can reach these tables, but RLS prevents users from reading or changing
-- anyone else's data.

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null default '',
  phone            text not null default '',
  mascot_id        text not null default 'penni-red',
  attempt_year     text not null default '',
  prep_stage       text not null default 'Foundation',
  target_exam      text not null default 'CSE 2027',
  language         text not null default 'english'
                     check (language in ('english', 'hinglish', 'hindi')),
  daily_target     integer not null default 10
                     check (daily_target between 1 and 100),
  gs_focus         text[] not null default '{}',
  optional_subject text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.student_state (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  practice_stats     jsonb not null default '{}'::jsonb,
  practice_settings  jsonb not null default '{}'::jsonb,
  article_bookmarks  jsonb not null default '[]'::jsonb,
  question_bookmarks jsonb not null default '[]'::jsonb,
  mains_quota        jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists student_state_touch_updated_at on public.student_state;
create trigger student_state_touch_updated_at
  before update on public.student_state
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.student_state enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (id = auth.uid());

drop policy if exists student_state_read_own on public.student_state;
create policy student_state_read_own on public.student_state
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists student_state_insert_own on public.student_state;
create policy student_state_insert_own on public.student_state
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists student_state_update_own on public.student_state;
create policy student_state_update_own on public.student_state
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists student_state_delete_own on public.student_state;
create policy student_state_delete_own on public.student_state
  for delete to authenticated
  using (user_id = auth.uid());
