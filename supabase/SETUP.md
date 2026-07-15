# Penni Supabase setup

## 1. Apply the database migrations

In Supabase Dashboard, open **SQL Editor**, run the migrations in order, and
keep each file as one transaction:

1. `migrations/0001_content.sql`
2. `migrations/0002_student_accounts.sql`
3. `migrations/0003_launch_account_fields.sql`
4. `migrations/0004_email_updates.sql`
5. `migrations/0005_whatsapp_updates.sql`

The account migrations create student profiles, cross-device learning state,
launch profile fields and explicit email/WhatsApp consent. Their RLS policies
only allow an authenticated user to access their own rows.

## 2. Enable login providers

In **Authentication > Providers**:

- Enable **Phone** and configure a supported SMS provider for OTP delivery.
- Enable Google and Apple only after their OAuth credentials are configured.
- Add the production Vercel URL and local development URL to the allowed
  redirect URLs.

Phone OTP cannot deliver messages until the SMS provider is enabled. Provider
credentials belong in Supabase Dashboard, never in this repository.

Google OAuth signs the user in but does not send a Penni welcome or briefing
email. Penni product emails are sent by the Edge Functions below through
Resend. Supabase Auth SMTP is only needed if you also enable email/password,
magic-link or other Supabase Auth emails.

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

## 5. Configure product email

Create and verify a sending domain in Resend. Add these Edge Function secrets
in **Project Settings > Edge Functions > Secrets** (or with `supabase secrets
set`):

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Penni <updates@your-verified-domain.com>
APP_URL=https://your-production-app.example
BROADCAST_SECRET=generate-a-long-random-secret
```

Students are not subscribed automatically. They must enable email updates in
onboarding or Settings. On first opt-in, `send-welcome-email` sends one welcome
message. Publishing a daily pack from the CMS sends the briefing email to
subscribed students.

## 6. Configure WhatsApp Business

Create a Meta Business app, connect a WhatsApp Business Account and add these
Edge Function secrets:

```env
META_WHATSAPP_TOKEN=<permanent-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=<meta-phone-number-id>
WHATSAPP_TEMPLATE_DAILY=penni_daily_briefing
WHATSAPP_TEMPLATE_FEATURE=penni_feature_update
```

Submit both message templates for Meta approval before launch. The daily
template must have four body variables in this order: student name, date,
article count and app URL. The feature template must have four body variables:
student name, feature title, feature summary and app URL. Template language is
currently `en`; change the function if the approved template uses another
locale.

Store WhatsApp numbers with a country code (for example `+919876543210`). Only
students who explicitly opt in are selected for delivery. They can opt out in
Settings.

## 7. Deploy notification functions

After migrations and secrets are configured, deploy both functions:

```bash
npx supabase functions deploy send-welcome-email
npx supabase functions deploy broadcast-updates
```

The CMS automatically invokes `broadcast-updates` after a daily pack is
published. An editor can use **Announce feature** in the CMS for important
product news. A trusted server can also invoke the function using
`BROADCAST_SECRET` with a body like:

```json
{
  "type": "feature",
  "title": "New revision planner",
  "summary": "Plan and track revision sessions from your Penni dashboard."
}
```
