# OpenRiverStack Client Portal

Admin portal and client workspace for OpenRiverStack Studio: clients, projects,
payment stages, GST invoices, files and call scheduling.

Next.js 14 (App Router) · Supabase (Postgres, Auth, Storage) · Razorpay · SMTP

---

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run check-env            # confirms the required variables are set
npm run dev                  # http://localhost:3000
```

Useful scripts:

| Command                | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Development server                                            |
| `npm run build`        | Production build                                              |
| `npm run check-env`    | Validates environment variables                               |
| `npm run seed`         | Seeds studio settings and weekly availability (safe to rerun) |
| `npm run create-admin` | Promotes an existing account to admin                         |

---

## Database setup

The schema lives in `supabase/migrations/`. Run them **in filename order** in the
Supabase SQL editor (Database → SQL Editor) against a fresh project:

1. `20260905000000_init.sql` — tables, row-level security, triggers, storage buckets
2. `20260905000001_cascade_delete.sql` — foreign-key cascade rules
3. `20260905000002_hidden_project_visibility.sql` — stops hidden projects leaking
   through their payments, documents and invoices

Then `npm run seed`, and `npm run create-admin` to give yourself admin access.

> Migrations 2 and 3 have **not** been applied to the current project. The app
> works without them — deletes are ordered in application code, and the client
> portal filters hidden projects in the UI — but the third one closes a real
> data leak at the database level and is worth running before onboarding a
> client with a hidden project.

---

## Deploying to AWS Amplify

This app is **server-rendered**. Middleware guards every route and the `/api`
routes use the Supabase service role and send email, so Amplify must host it on
the **WEB_COMPUTE** platform. Amplify detects that from the build output — you
do not need to configure it, but do not add `output: "export"` to
`next.config.mjs` or middleware and every API route will silently stop working.

### 1. Push the repository

Amplify deploys from a connected Git provider (GitHub, GitLab, Bitbucket, or
CodeCommit). Push this repo to one of them.

### 2. Create the Amplify app

1. AWS Console → **Amplify** → **Create new app** → **Deploy from Git**
2. Pick the repository and branch
3. Amplify reads [`amplify.yml`](amplify.yml) from the repo root — accept it as-is
4. Under **Advanced settings**, add the environment variables below **before**
   the first build

### 3. Environment variables

Set every one of these in **App settings → Environment variables**. The build
fails with a clear message if a required one is missing.

| Variable                         | Required | Notes                                                            |
| -------------------------------- | :------: | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       |    yes   | Inlined into the browser bundle **at build time**                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  |    yes   | Inlined into the browser bundle **at build time**                 |
| `NEXT_PUBLIC_APP_URL`            |    yes   | Your live URL, no trailing slash. Used for email links & redirects |
| `SUPABASE_SERVICE_ROLE_KEY`      |    yes   | Server only. Bypasses RLS — never expose it                       |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` |   —  | Without SMTP, email is logged instead of sent                     |
| `SMTP_USER` `SMTP_PASSWORD`      |     —    |                                                                   |
| `EMAIL_FROM` `EMAIL_REPLY_TO`    |     —    | From/Reply-To on outgoing mail                                    |
| `FOUNDER_EMAIL` `INFO_EMAIL`     |     —    | Where payment and call alerts go                                  |
| `RAZORPAY_KEY_ID` `RAZORPAY_KEY_SECRET` | — | Without these the Pay button is disabled                         |
| `RAZORPAY_WEBHOOK_SECRET`        |     —    | Must match the secret set on the Razorpay webhook                 |

`NEXT_PUBLIC_APP_URL` is a chicken-and-egg on the first deploy: use the
`https://<branch>.<app-id>.amplifyapp.com` URL Amplify assigns, or your custom
domain, then redeploy so the value is baked in correctly.

### 4. After the first successful deploy

Three things point at the old URL until you update them:

**Supabase redirect URLs** — Authentication → URL Configuration:
- Site URL: `https://<your-domain>`
- Redirect URLs: add `https://<your-domain>/**`

Without this, sign-up confirmations and password-reset links are rejected.

**Razorpay webhook** — Dashboard → Settings → Webhooks:
- URL: `https://<your-domain>/api/payments/razorpay/webhook`
- Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`

This is what settles a payment when the customer closes the tab mid-redirect.
Until it is configured, only the browser-side confirmation path runs.

**Supabase custom SMTP** (optional but recommended) — Authentication → Settings:
the app sends its own auth email through your SMTP, so this is only needed for
mail triggered from the Supabase dashboard itself.

---

## Things worth knowing

**Sign-up and password reset bypass Supabase's mailer.** Its built-in mailer
caps auth email at a handful per hour, which produced `email rate limit
exceeded` for real users. `/api/auth/signup` and `/api/auth/reset-password`
create the account and generate the link server-side, then send it over your own
SMTP. Accounts are still created unconfirmed, so email ownership is still proven
before anyone can sign in.

**The rate limiter is in-process.** `src/lib/rate-limit.ts` keeps its counters in
memory, so they reset on redeploy and are not shared between concurrent Amplify
compute instances. Fine for the traffic this portal sees; move it to Postgres if
that changes.

**Projects are hidden from clients by default.** A new project has
`visible_to_client = false`. Adding someone under People & Access gives them the
workspace, not the project — publish it from the client's Projects tab.

**Invoices are drafted automatically, issued manually.** A settled payment
drafts an invoice; clients cannot see drafts (enforced by RLS). Issuing it from
the admin portal reserves the number and emails everyone with access.

---

## Project layout

```
src/app/(admin)     Admin portal
src/app/(client)    Client workspace
src/app/(public)    Sign in, sign up, password reset
src/app/api         Server routes (payments, invoices, auth, email)
src/lib             Supabase clients, data access, email, Razorpay, settlement
supabase/migrations Database schema — apply in filename order
```
