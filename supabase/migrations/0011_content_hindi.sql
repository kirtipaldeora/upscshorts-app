-- Keep the reviewed Hindi feed-card copy alongside each CMS article. Deep Dive
-- Hindi remains nested in deep_dive and question Hindi remains nested in
-- prelims_qs; this column is only the article-level headline and summaries.

alter table public.articles
  add column if not exists hindi jsonb not null default '{}'::jsonb;

update public.articles
set hindi = '{}'::jsonb
where hindi is null;

alter table public.articles
  alter column hindi set default '{}'::jsonb,
  alter column hindi set not null;

comment on column public.articles.hindi is
  'Reviewed Hindi feed-card copy: headline, summary and whyItMatters.';
