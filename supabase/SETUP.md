# Penni Supabase setup

## 1. Apply the database migrations

In Supabase Dashboard, open **SQL Editor**, run the migrations in order, and
keep each file as one transaction:

1. `migrations/0001_content.sql`
2. `migrations/0002_student_accounts.sql`

The second migration creates student profiles and cross-device learning state.
Its RLS policies only allow an authenticated user to access their own rows.

## 2. Enable login providers

In **Authentication > Providers**:

- Enable **Phone** and configure a supported SMS provider for OTP delivery.
- Enable Google and Apple only after their OAuth credentials are configured.
- Add the production Vercel URL and local development URL to the allowed
  redirect URLs.

Phone OTP cannot deliver messages until the SMS provider is enabled. Provider
credentials belong in Supabase Dashboard, never in this repository.

## 3. Configure frontend environments

Set these separately for `app` and `admin`, locally and in Vercel:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_CONTENT_BASE=https://<project-ref>.supabase.co/storage/v1/object/public/content
```

Never expose `SUPABASE_SECRET_KEY` or a legacy `service_role` key in a
`VITE_` variable. The browser apps use RLS and the publishable key.

## 4. Allow CMS editors

After an editor has authenticated once, add their Auth user UUID to
`public.editors`. Students do not need an editor row.
