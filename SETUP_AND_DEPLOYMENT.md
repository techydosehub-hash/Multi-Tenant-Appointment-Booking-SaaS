# Steadly: complete setup, error recovery, GitHub, Vercel, and Render guide

This is the single, step-by-step guide for this exact project. Follow it in order. Commands labelled **project root** run in `J:\TECH STARTUP GOAL\Multi tenant booking saas`; commands labelled **Backend** or **Frontend** run inside that folder.

**Latest 7 October 2026 update:** the earlier CORS/API-base issue is resolved and the existing production dashboard pages were inspected successfully. The four demo workspaces remain accessible from your existing account. New searchable timezones, account profiles, and simulated checkout/receipt/history features are ready locally. Follow [PDF_REQUIREMENTS_AUDIT.md](docs/PDF_REQUIREMENTS_AUDIT.md), especially section 6, to apply the safe incremental `002_booking_conflict.sql` function patch and deploy both updated folders. The longer manual feature tour remains in [DEMO_WORKFLOW_GUIDE.md](DEMO_WORKFLOW_GUIDE.md).

The intended deployment is:

```text
Browser
  ├─ React frontend on Vercel
  ├─ Login / Google sign-in through Supabase Auth
  └─ HTTPS API calls to Express on Render
        └─ Supabase PostgreSQL / RLS / booking transactions

Render Cron Job
  └─ Authenticated call to the Render API every 15 minutes
        └─ Process reminder and confirmation jobs
```

Your database stays in **Supabase**. The frontend goes to **Vercel**. The backend and optional reminder cron go to **Render**. You do not need a second database on Render or a second copy of the backend on Vercel for this deployment.

## Step 1 — Understand and recover from your PGRST205 error

Your log reports a successful Node startup, followed by `PGRST205` on `GET /api/me`. `/me` queries `public.business_members` and joins the related business. `PGRST205` means the requested table is unavailable to PostgREST's schema cache. An unapplied schema, stale cache, or server pointed at a different project can cause it. [Official PostgREST error reference](https://docs.postgrest.org/en/stable/references/errors.html)

### What was observed during this fix

A read-only metadata diagnosis against the backend's currently configured project, `qubtwpwdljjoweeasdhn.supabase.co`, returned successful responses for the 16 application tables and `client_metrics`. The `business_members` → `businesses` relationship also resolved. No customer rows were read, and no users, appointments, payments, or notification deliveries were created.

This means those objects are visible **now**. The supplied earlier failure was not reproduced by that metadata diagnosis. Do not rerun the initial migration blindly over your existing tables.

The code now returns an explanatory **503** for missing schema objects instead of a generic 500. It also resolves the local backend `.env` from the Backend folder, even if Node is launched from the project root. This prevents a different working directory from silently selecting the wrong local configuration. A readiness endpoint is available at `/api/health/ready`.

### 1A. Confirm the intended Supabase project

The following values must describe the same project:

```text
Frontend/.env.local: VITE_SUPABASE_URL
Frontend/.env.local: VITE_SUPABASE_ANON_KEY
Backend/.env: SUPABASE_URL
Backend/.env: SUPABASE_ANON_KEY
Backend/.env: SUPABASE_SERVICE_ROLE_KEY
```

Your intended URL is:

```text
https://qubtwpwdljjoweeasdhn.supabase.co
```

Copy the URL and keys from that project's dashboard if you need to correct them. Do not mix keys from another project. The anon key is used by the frontend; the service-role key belongs only in the backend.

### 1B. Inspect and reload the schema cache

1. Open your Supabase project dashboard.
2. Open **SQL Editor** and create a new query.
3. Run the contents of `Backend/supabase/repair_schema_cache.sql`, or run this directly:

```sql
select
  to_regclass('public.businesses') as businesses,
  to_regclass('public.business_members') as business_members,
  to_regclass('public.client_metrics') as client_metrics;

notify pgrst, 'reload schema';
```

4. If the three values show their relation names, the objects exist. An empty membership table is valid; a newly signed-in user without a business should see onboarding.
5. Wait briefly for the cache reload to take effect.
6. Stop the local backend with `Ctrl+C` and start it again from Backend with `npm run dev`.
7. Restart Vite if you changed its environment variables, then refresh the browser and choose **Retry connection**.

`NOTIFY pgrst, 'reload schema'` refreshes metadata; it does not create missing tables or remove customer records. [Official schema-cache reload documentation](https://docs.postgrest.org/en/stable/references/schema_cache.html)

### 1C. Only if the schema is missing: apply the initial migration

If this is an empty project and the relation results are `NULL`:

1. Open `Backend/supabase/migrations/001_initial.sql`.
2. Copy **the complete file**, not only the `business_members` table.
3. Paste it into Supabase SQL Editor and run it once.
4. Run the cache-reload statement above.
5. Restart the backend and frontend.

From PowerShell at the project root, you can copy the SQL without altering it:

```powershell
Get-Content -LiteralPath 'Backend/supabase/migrations/001_initial.sql' -Raw | Set-Clipboard
```

The initial migration creates tenant tables, relationships, indexes, RLS policies, restricted grants, the slot engine, transactional booking functions, CRM metrics, billing state, and notification jobs. Supabase API keys cannot execute this schema SQL; use the project SQL editor or your own authenticated database/migration tooling.

If some tables already exist and others are missing, inspect the first error from the previous migration before continuing. Do not delete tenant data, disable RLS, or create only the missing table as a shortcut. A partial schema needs a deliberate corrective migration.

### 1D. If the error persists with tables present

In Supabase SQL Editor, inspect the setup without reading customers:

```sql
-- The required relationship must exist.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.business_members'::regclass
  and contype = 'f';

-- Authenticated users need the intended read grants, with RLS controlling rows.
select has_table_privilege('authenticated', 'public.business_members', 'SELECT')
       as can_select_memberships,
       has_table_privilege('authenticated', 'public.businesses', 'SELECT')
       as can_select_businesses;

-- RLS must stay enabled.
select relname, relrowsecurity
from pg_class
where oid in ('public.business_members'::regclass, 'public.businesses'::regclass);
```

Ensure `public` is an exposed Data API schema in Supabase's API settings. Keep `private` unexposed. Compare the policies/grants with the supplied migration rather than granting public access. If the local configuration is correct but old logs still appear, confirm that the terminal you restarted is the process serving port 3001; stop any old backend instance before restarting the intended one.

The ready endpoint confirms that the membership relationship and CRM view are available. It is an operational readiness check, not proof that all RLS, scheduling, or concurrency cases pass.

## Step 2 — Install the required local tools

1. Install Node.js 22.12+; Node 24 is suitable for this project.
2. Install Git if it is not already installed.
3. Have access to your Supabase dashboard, GitHub account, Vercel account, Render account, and a Google Cloud project for Google sign-in.

At the project root:

```powershell
node --version
npm --version
git --version
```

The two package lockfiles are included. Use `npm ci` when installing a checkout so you use the locked dependency versions.

## Step 3 — Configure local environment files

The supplied workspace already has ignored local files. Keep the populated files unless changing their values. For a fresh checkout only:

```powershell
Copy-Item Frontend/.env.example Frontend/.env.local
Copy-Item Backend/.env.example Backend/.env
```

Edit `Frontend/.env.local`:

```dotenv
VITE_SUPABASE_URL=https://qubtwpwdljjoweeasdhn.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
VITE_API_URL=http://localhost:3001/api
```

Edit `Backend/.env`:

```dotenv
PORT=3001
SUPABASE_URL=https://qubtwpwdljjoweeasdhn.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
APP_URL=http://localhost:5173
CRON_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
BILLING_WEBHOOK_SECRET=ANOTHER_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
BILLING_MODE=simulation
NOTIFICATION_MODE=mock
TRUST_PROXY=0
```

Generate independent cron and webhook secrets if needed:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run that command separately for each secret. Existing generated secrets can be reused across the corresponding web service and cron configuration. Do not put the cron/webhook/service-role secret in any `VITE_` variable. Rotate the service-role credential shared in chat before production and update its backend copies.

`APP_URL` is the exact frontend origin, with no path or trailing slash. `VITE_API_URL` includes `/api` and has no trailing slash. Google client credentials are configured in **Supabase**, not in these files.

## Step 4 — Configure Supabase email/password authentication

In Supabase **Authentication** settings:

1. Enable the Email provider with password sign-in.
2. Configure your desired email-confirmation requirement.
3. Set the local Site URL to `http://localhost:5173` while developing.
4. Add these allowed redirect URLs:

```text
http://localhost:5173/dashboard
http://localhost:5173/reset-password
http://localhost:5173/auth/callback
```

5. If confirmation is enabled, the owner must confirm their email before onboarding can create a business.
6. Configure Supabase SMTP/auth-email settings for reliable confirmation and recovery delivery.

Supabase authentication emails are separate from Steadly's appointment notifications. The latter remain simulated in this assessment edition.

The app sends explicit redirects for email confirmation, recovery, and Google callback. Those destinations must be in Supabase's allowed redirect list. [Supabase redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls)

## Step 5 — Enable Continue with Google

Both `/login` and `/signup` now contain **Continue with Google**. The shared button calls Supabase OAuth and returns to `/auth/callback`; a new user then enters the same business-onboarding flow. Existing users return to their workspace.

### 5A. Google Cloud / Google Auth Platform

1. Create or select a Google Cloud project.
2. Configure the Google Auth Platform application's branding and audience.
3. Configure basic identity scopes: `openid`, `userinfo.email`, and `userinfo.profile`.
4. If using an external app in testing status, add the Google accounts you intend to use as test users. Before wider access, complete the audience/publishing requirements shown by Google.
5. Create an OAuth client with application type **Web application**.
6. Add the local origin `http://localhost:5173` under authorized JavaScript origins.
7. Under authorized redirect URIs, add **this Supabase callback**, not the frontend callback:

```text
https://qubtwpwdljjoweeasdhn.supabase.co/auth/v1/callback
```

8. Save the OAuth client ID and client secret.

### 5B. Supabase Google provider

1. Open Supabase **Authentication → Providers → Google**.
2. Enable Google and paste the OAuth client ID and secret.
3. Save the provider configuration.
4. Confirm the callback URL displayed there matches the Google redirect URI above.
5. Confirm `http://localhost:5173/auth/callback` is in Supabase's allowed redirect URLs.

These provider/origin/scope requirements follow the [official Supabase Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

### 5C. Know the two different callback addresses

| Address                                                     | Configured in                               | Purpose                                   |
| ----------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| `https://qubtwpwdljjoweeasdhn.supabase.co/auth/v1/callback` | Google OAuth authorized redirect URIs       | Google returns to Supabase                |
| `http://localhost:5173/auth/callback`                       | Supabase allowed redirects                  | Supabase returns to the local frontend    |
| `https://YOUR_FRONTEND.vercel.app/auth/callback`            | Supabase allowed redirects after deployment | Supabase returns to the deployed frontend |

This frontend uses the Supabase browser SDK's default OAuth session handling. The callback waits for SDK initialization and redirects to the dashboard; you do not need to write a separate backend Google-token exchange or put Google's secret in React.

Google sign-in will need the external configuration above before it can succeed. Do not create a second business solely because you used a different login method; the application loads the signed-in Supabase user's existing memberships.

## Step 6 — Run locally

Terminal 1, from the project root:

```powershell
Set-Location 'J:\TECH STARTUP GOAL\Multi tenant booking saas\Backend'
npm ci
npm run dev
```

Terminal 2:

```powershell
Set-Location 'J:\TECH STARTUP GOAL\Multi tenant booking saas\Frontend'
npm ci
npm run dev
```

Open `http://localhost:5173`.

The backend startup log should say `server_started` with port 3001. `/api/health` confirms the process; `/api/health/ready` additionally inspects essential database metadata. If you change local frontend environment values, restart Vite. Backend local env values are now read from `Backend/.env` regardless of the launch directory.

No executable test suite was added. The application build and syntax checks do not replace runtime acceptance or security testing. The detailed future case list remains in `docs/TEST_CASES.md`.

## Step 7 — Configure your first real workspace

1. Register with email/password or use Google sign-in after completing Step 5.
2. Confirm email if required for email/password accounts.
3. Onboarding: enter business name, unique slug, and `Asia/Kolkata` or your actual IANA timezone.
4. **Settings:** add business description and public email/phone; choose appointment currency and approval preferences.
5. **Services:** add each service's name, duration, price, and description.
6. **Providers:** add yourself or your staff resources. Check the services each provider can perform.
7. **Availability:** save business hours; add narrower provider hours if needed; add holidays/lunch/leave as blocks.
8. Leave the business published (`active`) when ready to accept appointments.
9. Share `http://localhost:5173/booking/YOUR_SLUG` locally; replace its origin with your Vercel address after deployment.

Without an active provider assigned to a service, that service has no slots. Default hours are Monday–Friday 09:00–17:00. Slots start every 15 minutes, account for full service duration, and are shown in the business timezone. Configure currency before accepting bookings; it cannot be changed once appointment values exist.

Bookings created with approval enabled are pending and reserve the provider's time. The owner/admin can confirm, cancel, or reschedule them. After a confirmed appointment ends, mark it completed or no-show. CRM clients are created from booking details, with email deduplication inside each business.

If you want disposable demonstration tenants, the optional seed command is supplied but has not been run:

```powershell
# Run inside Backend, only after the schema exists.
$env:DEMO_PASSWORD = 'ChooseYourOwnLongDemoPassword'
$env:DEMO_SUFFIX = 'review1'
npm run seed
```

It creates `oak-review1@example.com` and `fieldwork-review1@example.com` with your chosen password. It creates configuration, not appointments. Existing slugs are skipped; a partially created demo user needs manual cleanup or a different suffix. Do not seed a production project unless you want these demonstration accounts there.

## Step 8 — Prepare the project for GitHub

Before uploading:

1. Keep both `Frontend/package-lock.json` and `Backend/package-lock.json`.
2. Keep migrations, `.env.example` files, documentation, and hosting configuration.
3. Keep actual credentials in local ignored env files and the hosting dashboards.
4. Keep `node_modules`, `dist`, and `.vercel` out of the repository.
5. The supplied `.gitignore` handles the local env and generated folders.

The runtime system does not require committing the assessment PDF. The commands below stage the application and documentation explicitly.

At the project root, if this folder is not yet a Git repository:

```powershell
git init
git branch -M main
```

If Git asks for author identity, set your own details in this repository:

```powershell
git config user.name "YOUR_NAME"
git config user.email "YOUR_GITHUB_EMAIL"
```

Inspect ignored files:

```powershell
git check-ignore Backend/.env Frontend/.env.local
git status --short
```

The first command should report both local env paths as ignored. Then stage the source:

```powershell
git add .gitignore .prettierrc.json .prettierignore README.md SETUP_AND_DEPLOYMENT.md render.yaml Frontend Backend docs
git diff --cached --stat
git ls-files '*env*'
```

The tracked env files should be **only** the examples, not `Backend/.env` or `Frontend/.env.local`. If those were tracked in a pre-existing repository, remove them from Git's index without deleting the local copies:

```powershell
git rm --cached --ignore-unmatch Backend/.env Frontend/.env.local
```

Commit:

```powershell
git commit -m "Build Steadly multi-tenant booking platform"
```

## Step 9 — Create the GitHub repository and push

1. In GitHub, create a repository such as `steadly-booking-saas`.
2. Choose your intended visibility. Render and Vercel can import private repositories when you grant their Git integrations access.
3. For this first push, create an empty remote without initializing an extra README or license.
4. Copy its HTTPS clone URL.

At the project root, replace the username and repository name:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/steadly-booking-saas.git
git push -u origin main
```

If `origin` already exists:

```powershell
git remote -v
```

Only if it points to the wrong destination, update it:

```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/steadly-booking-saas.git
git push -u origin main
```

Complete GitHub authentication using your Git credential manager/browser. Do not place a GitHub token in your remote URL. Open the repository afterward and confirm it contains the two application folders, lockfiles, SQL, and this guide.

## Step 10 — Deploy the backend to Render

First deploy the backend to get its real API hostname. The initial `APP_URL` can be your local frontend; Step 12 will replace it with the Vercel origin.

### 10A. Create a Web Service

In Render:

1. Connect your GitHub account and allow access to this repository.
2. Select **New → Web Service**, choose the repository, and use these exact project settings:

| Setting            | Value                                    |
| ------------------ | ---------------------------------------- |
| Name               | `steadly-api` or your chosen unique name |
| Branch             | `main`                                   |
| Runtime / language | Node                                     |
| Root Directory     | `Backend` — capital B                    |
| Build Command      | `npm ci`                                 |
| Start Command      | `npm start`                              |
| Health Check Path  | `/api/health/ready`                      |

Use your desired region and compute plan. The server binds to `0.0.0.0` and reads Render's `PORT`; no fixed external port is required. [Render web-service configuration](https://render.com/docs/web-services)

For an effective always-available booking service, use an always-on instance. Free Render web services can sleep after idle time and take time to wake up, which affects API response time. Confirm the plan's current billing before selecting it. [Render free-service limitations](https://render.com/docs/free)

### 10B. Add backend environment variables

Add these to the Render Web Service environment:

| Variable                    | Value                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| `NODE_VERSION`              | `24.14.1` or a supported Node 24 release                         |
| `SUPABASE_URL`              | `https://qubtwpwdljjoweeasdhn.supabase.co`                       |
| `SUPABASE_ANON_KEY`         | Anon key from this Supabase project                              |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key from this Supabase project                       |
| `APP_URL`                   | Initially `http://localhost:5173`, later the exact Vercel origin |
| `CRON_SECRET`               | Your generated cron secret                                       |
| `BILLING_WEBHOOK_SECRET`    | Your generated webhook secret                                    |
| `BILLING_MODE`              | `simulation`                                                     |
| `NOTIFICATION_MODE`         | `mock`                                                           |
| `TRUST_PROXY`               | `1` for Render's reverse proxy                                   |

Let Render supply `PORT`; do not copy `PORT=3001` from the local env. No `DATABASE_URL` is needed by this Express service because it uses Supabase's HTTP client. You do not need Stripe or email/SMS provider keys for the included simulation.

`NODE_VERSION` pins the Render runtime separately from the package engine requirement. [Render Node version settings](https://render.com/docs/node-version)

### 10C. Deploy and save the hostname

1. Create/deploy the service.
2. Review build/start logs. The start script is `node src/server.js`, not `node app.js`.
3. Save the generated service origin, for example:

```text
https://YOUR_BACKEND.onrender.com
```

4. Your frontend API base will be:

```text
https://YOUR_BACKEND.onrender.com/api
```

The supplied `Backend/vercel.json` belongs to the alternative Vercel-backend deployment and has no scheduling effect on Render. For the chosen Render deployment, configure the separate cron job in Step 14.

### Optional: Render Blueprint instead of manual creation

The root `render.yaml` declares a backend web service and reminder cron job. Importing it as a Render Blueprint can create both services; it defaults the web service to the paid `starter` plan and the cron uses billed Render cron execution. Review those choices before using it. Supply all `sync: false` values in the dashboard. After the backend hostname exists, set the cron's `API_URL` to that hostname plus `/api`, and copy the web service's `CRON_SECRET` exactly.

Choose **manual creation or Blueprint creation** for these services so you do not accidentally create duplicates. [Render Blueprint specification](https://render.com/docs/blueprint-spec)

## Step 11 — Deploy the frontend to Vercel

1. Sign in to Vercel and import the same GitHub repository.
2. Create the frontend project with:

| Setting           | Value                                       |
| ----------------- | ------------------------------------------- |
| Framework preset  | Vite                                        |
| Root Directory    | `Frontend` — capital F                      |
| Production branch | `main`                                      |
| Install command   | `npm ci`                                    |
| Build command     | `npm run build`                             |
| Output directory  | `dist`                                      |
| Node.js version   | A supported 24.x version, or at least 22.12 |

Selecting `Frontend` as the root ensures Vercel uses its package file and SPA configuration. [Vercel monorepo/root-directory documentation](https://vercel.com/docs/monorepos)

3. Add these frontend environment variables for Production:

```dotenv
VITE_SUPABASE_URL=https://qubtwpwdljjoweeasdhn.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
VITE_API_URL=https://YOUR_BACKEND.onrender.com/api
```

4. Deploy and save the actual frontend origin:

```text
https://YOUR_FRONTEND.vercel.app
```

5. `Frontend/vercel.json` supplies SPA rewrites for direct paths such as `/booking/your-slug`, `/dashboard/calendar`, and `/auth/callback`.
6. Every `VITE_` value is compiled into browser assets. Environment changes require a new frontend deployment.

Do not add service-role, cron, webhook, or Google client secrets to this Vercel frontend project.

## Step 12 — Connect the final production URLs

After both deployments exist:

1. In Render, set `APP_URL=https://YOUR_FRONTEND.vercel.app` and redeploy/restart the backend.
2. In Vercel, confirm `VITE_API_URL=https://YOUR_BACKEND.onrender.com/api`, then redeploy if you changed it.
3. In Supabase Auth, set Site URL to `https://YOUR_FRONTEND.vercel.app`.
4. Add these exact Supabase allowed redirects:

```text
https://YOUR_FRONTEND.vercel.app/dashboard
https://YOUR_FRONTEND.vercel.app/reset-password
https://YOUR_FRONTEND.vercel.app/auth/callback
```

5. Keep local redirects only if you still need local development using this project.
6. In Google OAuth, add `https://YOUR_FRONTEND.vercel.app` to authorized JavaScript origins.
7. Keep the Google authorized redirect URI set to `https://qubtwpwdljjoweeasdhn.supabase.co/auth/v1/callback`.
8. If Google is still in testing mode, ensure your intended login accounts are permitted by its audience/test-user configuration.

The backend accepts one intentional `APP_URL` origin. A random Vercel preview address will not automatically have CORS or OAuth access. For a preview environment, configure a corresponding backend/Supabase redirect setup deliberately; avoid broadly opening all origins.

### URL reference sheet

| Name                     | Example / place used                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Frontend origin          | `https://YOUR_FRONTEND.vercel.app` → Render APP_URL, Supabase Site URL, Google origin |
| Backend origin           | `https://YOUR_BACKEND.onrender.com` → service base address                            |
| API base                 | `https://YOUR_BACKEND.onrender.com/api` → VITE_API_URL and cron API_URL               |
| Google provider callback | `https://qubtwpwdljjoweeasdhn.supabase.co/auth/v1/callback` → Google redirect URI     |
| App Google callback      | `https://YOUR_FRONTEND.vercel.app/auth/callback` → Supabase allowed redirect          |
| Public booking link      | `https://YOUR_FRONTEND.vercel.app/booking/YOUR_SLUG` → share with clients             |

## Step 13 — Configure subscription access

New businesses receive a 14-day trial. After the trial expires, owners can open Billing to restore access through the explicit **simulated** checkout:

1. Open the deployed frontend and sign in as the owner.
2. Open **Billing**.
3. Choose **Start monthly subscription**.
4. Review and confirm the simulated checkout.
5. The backend activates one month; completing the same session again does not extend it again.

There is no payment collection or automatic renewal. Active/trial access lasts until period end; past-due access has a three-day grace period; cancelled/incomplete access is blocked. Billing remains available. Public bookings remain available while the business is published; pause the public page before cancellation if you wish to stop accepting bookings.

A signed lifecycle simulator is supplied for later deliberate use. Running it changes the named business's subscription; it was not executed during this fix:

```powershell
# Inside Backend; use the actual UUID and intended state/time.
$env:API_URL = 'https://YOUR_BACKEND.onrender.com/api'
npm run simulate:billing -- BUSINESS_UUID past_due 2026-10-07T00:00:00.000Z
```

Its `BILLING_WEBHOOK_SECRET` must match the deployed backend. The date above is an example, not a value to reuse indefinitely. This HMAC protocol is the project's simulation, not Stripe's webhook format. Actual Stripe charging requires a real billing adapter and provider configuration; creating a Stripe account alone does not enable payments here.

## Step 14 — Schedule confirmations and reminders on Render

The application queues notification jobs when booking/changing appointments. Jobs need a recurring caller. **They will stay queued if you never schedule the worker.**

### 14A. Create the Cron Job

In Render, connect the same Git repository and choose **New → Cron Job**:

| Setting        | Value                    |
| -------------- | ------------------------ |
| Name           | `steadly-reminders`      |
| Branch         | `main`                   |
| Runtime        | Node                     |
| Root Directory | `Backend`                |
| Schedule       | `*/15 * * * *`           |
| Build Command  | `npm ci`                 |
| Command        | `npm run jobs:reminders` |

The job script performs a single authenticated HTTP call and exits. It does not start a second Express server.

### 14B. Add only the caller's required environment

```dotenv
NODE_VERSION=24.14.1
API_URL=https://YOUR_BACKEND.onrender.com/api
CRON_SECRET=EXACT_SAME_SECRET_AS_THE_RENDER_WEB_SERVICE
```

The caller does not need Supabase service-role credentials. It uses the web service's protected `/api/jobs/reminders` endpoint; the backend performs the database work.

Render cron schedules use UTC and are a billed service. Review the current plan and charges in the dashboard. Configure one scheduler for this worker. [Render cron documentation](https://render.com/docs/cronjobs)

### 14C. Job behavior and limitations

- Up to 50 due jobs are processed in one run.
- Confirmation jobs are due immediately but wait for the next scheduler invocation.
- Reminder jobs are due 24 hours before the appointment; bookings within that threshold have an immediately due reminder.
- The worker excludes stale booking versions, invalid states, expired reminders, and disabled channels.
- Lease/retry handling limits attempts to three and avoids duplicate mock delivery records.
- **Notifications → Jobs / Attempts** shows queued, skipped, sent, failed, and simulated-delivery information.
- The adapter records mock email/SMS delivery. It does not send real messages.

For actual email/SMS delivery, an external notification adapter, provider credentials, idempotency integration, and delivery/failure callbacks still need implementation. Supabase Auth SMTP does not send appointment reminders for this app automatically.

If you prefer another scheduler, it must call `GET https://YOUR_BACKEND.onrender.com/api/jobs/reminders` with `Authorization: Bearer CRON_SECRET` every 15 minutes. Keep the secret in the scheduler's secret/header configuration, not in a URL. Do not create both an external schedule and an unnecessary duplicate Render cron.

Local manual invocation, only when you intend to process queued jobs:

```powershell
# Inside Backend; reads CRON_SECRET from Backend/.env.
$env:API_URL = 'http://localhost:3001/api'
npm run jobs:reminders
```

## Step 15 — Add custom domains if desired

1. Add your frontend domain in the Vercel project's domain settings and apply the DNS records it provides.
2. If using an API domain, configure it on the Render web service and apply Render's DNS records.
3. Wait for DNS and HTTPS certificates to become ready.
4. Update Render `APP_URL` to the frontend domain.
5. Update Vercel `VITE_API_URL` to the API domain plus `/api`, and rebuild.
6. Update Supabase Site URL and all three app redirect URLs.
7. Add the frontend origin in Google OAuth's authorized JavaScript origins.
8. The Google-to-Supabase callback remains the Supabase callback unless you intentionally configure a Supabase Auth custom domain too.
9. Share the new frontend `/booking/:slug` address.

## Step 16 — Ongoing updates and rollback

For later local source changes, at the project root:

```powershell
git status --short
git add Frontend Backend docs README.md SETUP_AND_DEPLOYMENT.md render.yaml
git diff --cached --stat
git commit -m "Describe the actual change"
git push origin main
```

With your Git integrations/automatic deployments enabled, Vercel and Render deploy new commits from their configured branch. Review both hosting logs; a frontend success does not guarantee the backend started with all required values.

- When changing dependencies, commit the corresponding lockfile.
- When changing database structure, add a new migration; do not rerun or edit an already-applied initial migration as your upgrade mechanism.
- Apply backward-compatible database changes before deploying code that requires them.
- When changing frontend env variables, rebuild/redeploy Vercel.
- When changing backend env variables, redeploy/restart Render.
- Rotate `CRON_SECRET` in both the web service and scheduler together.
- Use the host's previous-deployment/rollback tools to restore an earlier application build if needed; rolling back source does not reverse database migrations.
- Keep Supabase database backups appropriate to your data and plan, and keep a record of migrations applied.

## Step 17 — Troubleshooting reference

| Symptom                                               | What to do                                                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PGRST205` on `/me`                                   | Follow Step 1; check project, relations, cache, grants, and restart the intended backend                                                           |
| `PGRST202` / missing function                         | Check that the complete migration's functions exist; reload cache after function changes                                                           |
| Server environment validation failure                 | Complete required Render variables; verify secrets are at least 32 characters                                                                      |
| Render cannot find package.json                       | Set Root Directory to `Backend`, respecting capitalization                                                                                         |
| Vercel cannot build/import                            | Set Root Directory to `Frontend`, build `npm run build`, output `dist`, and supported Node                                                         |
| CORS failure after deployment                         | Render APP_URL must equal the final browser origin exactly; redeploy                                                                               |
| API client gets HTML instead of JSON                  | Confirm VITE_API_URL is the backend URL with `/api`; check backend startup and free-service cold start                                             |
| Google reports redirect_uri_mismatch                  | In Google, configure the Supabase `/auth/v1/callback` URL, not the app callback                                                                    |
| Google returns to the wrong frontend                  | Correct Supabase Site URL and allowed app `/auth/callback` URLs                                                                                    |
| Google provider disabled                              | Enable Google in Supabase and configure its OAuth client credentials                                                                               |
| Google denies a testing user                          | Review Google Auth Platform audience/test-user setup                                                                                               |
| OAuth callback says no session                        | Confirm the callback reached the same frontend origin, allowed redirect, and Supabase project; retry login                                         |
| Email confirmation/recovery absent                    | Review Supabase SMTP and email settings; this is separate from the app's mock delivery                                                             |
| No booking slots                                      | Active published business/service/provider, provider assignment, enabled hours, provider overrides, future date, blocks, and existing appointments |
| Booking returns 409                                   | Reload availability and choose another time; double-booking protection is doing its job                                                            |
| Subscription required                                 | Open Billing and activate the simulation; do not edit subscription rows from the browser                                                           |
| Reminder stays queued                                 | Configure Step 14, verify exact API_URL/secret match, and examine cron run logs                                                                    |
| Cron returns 401                                      | Web service and cron have different CRON_SECRET values                                                                                             |
| Notification marked simulated but no message received | Expected: the included adapter records mock delivery only                                                                                          |
| Provider cannot sign in                               | Providers are schedulable resources, not staff login accounts; owner/admin users sign in                                                           |
| Currency change rejected                              | Existing bookings require preserving the original currency; configure it before the first appointment                                              |
| One working-hours change affects old bookings         | Existing appointments are retained; deliberately reschedule/cancel affected records                                                                |

## Step 18 — Final readiness checklist

These are operator setup/acceptance items to complete later, not claims of tests already passed:

- [ ] Supabase URL/keys all belong to the intended project.
- [ ] The complete migration exists; RLS, restricted grants, functions, and relationships are present.
- [ ] Schema metadata reload/restart has removed the earlier `/me` setup failure.
- [ ] Email/password sign-in and required email confirmation/recovery are configured.
- [ ] Google OAuth credentials, callback URI, audience, and local/production redirects are configured.
- [ ] Services and active providers are created and assigned.
- [ ] Business/provider hours, timezone, currency, and blocks match operations.
- [ ] Source/lockfiles/config/examples are pushed; actual secrets are absent from the repository.
- [ ] Render backend is deployed with correct environment and readiness health path.
- [ ] Vercel frontend is deployed with the Render API base.
- [ ] APP_URL, Site URL, redirects, and Google origins all match the final frontend.
- [ ] Cron is configured and job history is observable.
- [ ] The owner understands simulation billing and notification behavior.
- [ ] The detailed acceptance, tenant-isolation, and concurrency cases are performed when authorized.
- [ ] Backups, access ownership, monitoring, and update/rollback procedures are ready for actual customer use.

## What this follow-up implemented and what you still configure

Implemented: Google buttons on login/signup, an OAuth callback page, informative schema errors, readiness reporting, backend local-env path correction, Render host/proxy/shutdown support, a cron caller script, optional Render Blueprint, and this consolidated guide.

Diagnosed: core table/view metadata and the membership relationship are currently visible in the configured Supabase project. This read-only diagnosis does not prove the logged-in `/me` flow or broader RLS/booking correctness.

You still configure: Google OAuth credentials in Supabase/Google, any remaining schema-cache recovery, hosting accounts/env values, GitHub push, Vercel/Render deployment, and the scheduler. No cloud deployment, remote push, Google credential creation, booking/payment mutation, notification delivery, or automated/live workflow test was performed during this follow-up.
