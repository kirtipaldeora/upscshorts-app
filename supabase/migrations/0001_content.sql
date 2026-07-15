-- Penni CMS: content authoring tables.
--
-- Source of truth for articles lives here. The admin app writes rows; the
-- publish step renders them into the exact JSON shape the Penni app already
-- fetches (see app/src/types/article.ts) and uploads it to the `content`
-- storage bucket. Penni itself never reads these tables.
--
-- Column names are snake_case; the admin maps to/from Penni's camelCase
-- Article shape in one place (admin/src/lib/mapArticle.ts).

-- ─── Editors ──────────────────────────────────────────────────
-- Allowlist. A Supabase auth user with no row here can sign in but sees
-- nothing: every policy below joins against this table.

create table if not exists public.editors (
  user_id    uuid primary key references auth.users on delete cascade,
  email      text,
  role       text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

comment on table public.editors is
  'Allowlist of CMS users. Seed the first admin by hand after they sign in once.';

create or replace function public.is_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.editors where user_id = auth.uid());
$$;

-- ─── Articles ─────────────────────────────────────────────────
-- Mirrors the Article interface. `deep_dive`, `prelims_qs` and `location` stay
-- jsonb because Penni consumes them as nested objects and the admin edits them
-- as units — splitting them into columns would buy nothing and cost a join.

create table if not exists public.articles (
  id              text primary key,
  date            date not null,
  headline        text not null,
  source          text not null default '',
  category        text not null default 'Polity',
  gs_paper        text not null default 'GS 2',
  summary         text not null default '',
  why_it_matters  text not null default '',
  deep_dive       jsonb not null default '{"explanation": "", "possibleMainsQuestion": ""}'::jsonb,
  audio_script    text,
  audio_script_hi text,
  prelims_qs      jsonb not null default '[]'::jsonb,
  key_terms       text[] not null default '{}',
  location        jsonb,

  -- Workflow. Only `published` rows are rendered into a snapshot.
  status          text not null default 'draft' check (status in ('draft', 'published')),
  -- Position within a date's feed; ties broken by created_at.
  sort_order      int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users
);

create index if not exists articles_date_idx   on public.articles (date desc);
create index if not exists articles_status_idx on public.articles (status);

-- ─── Publications ─────────────────────────────────────────────
-- Append-only log of what was pushed to the bucket and by whom, so a bad
-- publish can be traced without digging through Storage timestamps.

create table if not exists public.publications (
  id           bigserial primary key,
  kind         text not null default 'articles',
  ref          text not null,              -- the date published, e.g. '2026-07-15'
  path         text not null,              -- bucket path written
  count        int  not null default 0,    -- articles in the snapshot
  published_at timestamptz not null default now(),
  published_by uuid references auth.users
);

create index if not exists publications_ref_idx on public.publications (kind, ref, published_at desc);

-- ─── updated_at ───────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_touch_updated_at on public.articles;
create trigger articles_touch_updated_at
  before update on public.articles
  for each row execute function public.touch_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
-- Drafts must never be readable by the anon key: Penni ships that key to every
-- device. Nothing here is anon-readable at all — students only ever see the
-- published JSON snapshot in the bucket.

alter table public.editors      enable row level security;
alter table public.articles     enable row level security;
alter table public.publications enable row level security;

drop policy if exists editors_read_self on public.editors;
create policy editors_read_self on public.editors
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists articles_editor_all on public.articles;
create policy articles_editor_all on public.articles
  for all to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists publications_editor_read on public.publications;
create policy publications_editor_read on public.publications
  for select to authenticated
  using (public.is_editor());

drop policy if exists publications_editor_write on public.publications;
create policy publications_editor_write on public.publications
  for insert to authenticated
  with check (public.is_editor());

-- ─── Storage ──────────────────────────────────────────────────
-- Public read: these are the files Penni fetches, same as today's /data/*.json.
-- Writes are editor-only.

insert into storage.buckets (id, name, public)
values ('content', 'content', true)
on conflict (id) do update set public = true;

drop policy if exists content_public_read on storage.objects;
create policy content_public_read on storage.objects
  for select to public
  using (bucket_id = 'content');

drop policy if exists content_editor_write on storage.objects;
create policy content_editor_write on storage.objects
  for all to authenticated
  using (bucket_id = 'content' and public.is_editor())
  with check (bucket_id = 'content' and public.is_editor());
