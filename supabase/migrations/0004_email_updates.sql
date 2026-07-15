-- Explicit email consent and delivery bookkeeping.

alter table public.profiles
  add column if not exists email_updates boolean not null default false,
  add column if not exists email_consent_at timestamptz,
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists last_digest_sent_at timestamptz;

create index if not exists profiles_email_updates_idx
  on public.profiles (email_updates)
  where email_updates = true;
