# Penni CMS

Internal content tool. Add and edit each day's articles, then publish them to
students without a rebuild or an App Store release.

## How it fits together

```
  news-pipeline ──▶ app/public/data/articles/<date>.json   (unchanged; still writes to the repo)
                              │
                              │  Import JSON  (drafts)
                              ▼
                      ┌───────────────┐
                      │   Supabase    │   source of truth
                      │   Postgres    │
                      └───────┬───────┘
                              │  Publish
                              ▼
              Supabase Storage, public `content` bucket
                              │
                              ▼
                            Penni  ──▶ falls back to bundled JSON
```

The rule this is built around: **Penni's data contract does not change.** The CMS
publishes the same JSON shape Penni already parses —
`articles/<date>.json` is `{ "<date>": Article[] }`, `articles/index.json` is
`{ dates: string[] }`. Penni's only change is `app/src/utils/content.ts`, which
picks the origin. No component, store, or type was touched.

That means the blast radius of a bad publish is a bad *article*, never a broken
app — and with `VITE_CONTENT_BASE` unset, Penni behaves exactly as it did before
any of this existed.

### Why publish is a button, not automatic

Rows are the source of truth; the bucket holds a rendered snapshot. Editing an
article does nothing to students until someone publishes that date. That's the
point — half-finished edits shouldn't reach a feed.

## Setup

1. **Run the migration** — paste `supabase/migrations/0001_content.sql` into the
   Supabase SQL editor. It creates the tables, RLS policies, and the public
   `content` bucket.

2. **Configure** — `cp .env.example .env` and fill in the same project URL and
   anon key Penni uses. `VITE_CONTENT_BASE` is:

   ```
   https://<project-ref>.supabase.co/storage/v1/object/public/content
   ```

3. **Grant yourself access** — `npm run dev`, sign in with your email. You'll be
   told you're not an editor and shown the exact `insert` to run. Run it, reload.

   Signing in is not enough by design: every policy joins against `editors`, so
   an account without a row can read and write nothing.

4. **Point Penni at the bucket** — set the same `VITE_CONTENT_BASE` in Penni's
   env (Vercel, and `app/.env` for local). Leave it unset to keep reading
   bundled files.

## Daily use

1. Run the pipeline as usual — it still writes `app/public/data/articles/<date>.json`.
2. **Import JSON** in the CMS, drop that file in. Everything lands as a draft.
3. Review and edit. Quality flags shown on the date are the same checks the
   pipeline uses (`contentQualityIssues`); they're advisory and never block.
4. Mark articles published, then **Publish this date**.
5. Live within ~60s (the snapshot's `cache-control`).

To pull an article back: unpublish it and publish the date again. The snapshot is
re-rendered from scratch each time, so removals propagate.

## Notes

- **Types are shared, not copied.** `@penni/*` resolves to `../app/src`, so
  `Article` has one definition. A field added there surfaces here as a type
  error rather than as silently dropped data.
- **`admin/` deploys as its own Vercel project** — set the root directory to
  `admin`. It's `noindex` and gated, but it's still a separate origin from the
  student app.
- **Drafts are never anon-readable.** Penni ships the anon key to every device;
  no policy here grants it anything.

## Not covered yet

PYQ and question-bank management. The tables, publish path, and auth generalise
to it — `pyq_questions` alongside `articles`, publishing to `content/pyq/` —
but none of it is built.
