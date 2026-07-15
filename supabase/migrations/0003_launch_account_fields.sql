-- Launch-ready student profile fields and self-service account deletion.

alter table public.profiles
  add column if not exists email text not null default '',
  add column if not exists gender text not null default '',
  add column if not exists date_of_birth date,
  add column if not exists photo_url text not null default '';

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender in ('', 'female', 'male', 'non-binary', 'prefer-not-to-say'));

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
