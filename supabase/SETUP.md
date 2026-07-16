# Penni Supabase setup

## 1. Apply the database migrations

In Supabase Dashboard, open **SQL Editor**, run the migrations in order, and
keep each file as one transaction:

1. `migrations/0001_content.sql`
2. `migrations/0002_student_accounts.sql`
3. `migrations/0003_launch_account_fields.sql`
4. `migrations/0004_email_updates.sql`
5. `migrations/0005_whatsapp_updates.sql`
6. `migrations/0006_focus_social.sql`
7. `migrations/0007_focus_usernames.sql`
8. `migrations/0008_username_availability.sql`
9. `migrations/0009_focus_invite_links.sql`
10. `migrations/0010_focus_shared_totals.sql`
11. `migrations/0011_content_hindi.sql`

The account migrations create student profiles, cross-device learning state,
launch profile fields and explicit email/WhatsApp consent. Their RLS policies
only allow an authenticated user to access their own rows.

The Focus migration adds privacy-safe exact-contact discovery, focus-session
sync, friends, blocks, study groups, chat, presence and day/week/month
rankings. It must be applied before the Focus social tabs can return live data;
the timer and local analytics continue to work offline without it.
The username migration adds globally unique public handles and exact
`@username` friend lookup. The availability migration adds the authenticated,
rate-limited onboarding check; saving remains protected by the database's
atomic unique index. Apply all Focus migrations before testing usernames,
friend search or group invitations.
The invite-link migration also recompiles both exact-match lookup functions
with qualified column references. It is required to remove the legacy
`user_id is ambiguous` error from username, email and phone discovery.
The shared-totals migration separates friend/group aggregate sharing from
leaderboard visibility. Apply it before testing either Focus privacy toggle;
raw sessions remain owner-only under RLS.
The content-Hindi migration preserves the reviewed Hindi feed card in CMS
drafts and published snapshots. Deep Dive and MCQ Hindi remain in their nested
JSON fields.

## 2. Enable login providers

In **Authentication > Providers**:

- Enable **Google** and add the production OAuth credentials.
- Leave **Apple** disabled; Penni no longer presents Apple sign-in.
- Leave **Phone** disabled unless a phone-login screen is deliberately added in
  a future release. Phone numbers used for WhatsApp preferences are not an
  authentication method.
- Add the production Vercel URL and local development URL to the allowed
  redirect URLs.

Provider credentials belong in Supabase Dashboard, never in this repository.

In **Authentication > URL Configuration**, set the Site URL to the canonical
production app and explicitly allow every origin/path Penni is served from,
for example:

```text
https://penni.app/
https://www.penni.app/
https://<vercel-project>.vercel.app/
https://<github-user>.github.io/<repository>/
http://localhost:5173/
```

Penni preserves `import.meta.env.BASE_URL` during OAuth redirects, so the
GitHub Pages entry must retain its repository subpath. In Google Cloud, the
authorised redirect URI is Supabase's callback URL:
`https://<project-ref>.supabase.co/auth/v1/callback`.
For phone-on-LAN QA, temporarily allow the exact
`http://<your-mac-lan-ip>:5173/` URL as well; remove it after testing rather
than leaving a broad wildcard redirect in production.

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

For Vercel, add all three variables to the Production and Preview environments
and redeploy; Vite reads them at build time, so adding them after a build does
not repair that deployment. For GitHub Pages, create repository variables
`VITE_SUPABASE_URL` and `VITE_CONTENT_BASE`, plus the repository secret
`VITE_SUPABASE_PUBLISHABLE_KEY`. The workflow passes those values only to the
build step. A production bundle without these values deliberately runs in
local-only guest mode.

## 4. Allow CMS editors

After an editor has authenticated once, add their Auth user UUID to
`public.editors`. Students do not need an editor row.

Migration `0001_content.sql` also creates the public `content` Storage bucket.
Before launch, publish at least one daily pack and confirm
`content/articles/index.json` is publicly readable. Keep the CMS on a separate
deployment and do not expose an editor account to students.

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

The sending domain needs the DKIM and SPF records supplied by Resend. Configure
an MX route for the visible support/reply address and publish a DMARC record;
an address such as `support@penni.app` cannot receive mail from DNS alone.

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
npx supabase link --project-ref <project-ref>
npx supabase functions deploy send-welcome-email
npx supabase functions deploy broadcast-updates --no-verify-jwt
```

`send-welcome-email` keeps Supabase's gateway JWT verification because only a
signed-in student may invoke it. `broadcast-updates` performs its own editor
JWT or `BROADCAST_SECRET` check, so it is deployed with gateway verification
disabled; otherwise the documented trusted-server secret route is rejected
before the function receives the request.

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

After deployment, test with one consented internal account before enabling a
real audience. A missing function returns `404`; a deployed protected function
must reject an unauthorised request instead. Check the Edge Function logs and
the Resend/Meta delivery logs rather than treating a CMS publish as proof of
delivery.

## 8. Connect the production domain

Point both the apex and `www` hostnames at the chosen production deployment,
make one canonical and redirect the other. Remove any legacy S3/CloudFront
distribution first, then wait for the hosting provider to issue TLS for both
names. Only after HTTPS works should the canonical domain replace temporary
Vercel URLs in `APP_URL`, Supabase URL Configuration and OAuth provider
settings.
