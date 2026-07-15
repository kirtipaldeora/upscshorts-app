-- Explicit WhatsApp consent for approved outbound message templates.

alter table public.profiles
  add column if not exists whatsapp_updates boolean not null default false,
  add column if not exists whatsapp_consent_at timestamptz,
  add column if not exists last_whatsapp_sent_at timestamptz;

create index if not exists profiles_whatsapp_updates_idx
  on public.profiles (whatsapp_updates)
  where whatsapp_updates = true;
