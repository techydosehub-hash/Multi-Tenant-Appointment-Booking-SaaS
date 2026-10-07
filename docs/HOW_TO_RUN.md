# How to run Steadly

For the updated consolidated guide including Google sign-in, the reported `PGRST205` recovery, GitHub push, Vercel frontend, and Render backend/cron deployment, use `SETUP_AND_DEPLOYMENT.md` at the repository root. The original Vercel-backend option below remains an alternative.

## 1. Prerequisites

- Node.js **22.12 or newer**; this workspace uses Node 24.
- npm and access to the package registry.
- Your Supabase project, with permission to use its SQL editor and Auth settings.
- Two terminals for local development.

Use the existing `Frontend` and `Backend` folders, preserving capitalization when deploying on Linux.

## 2. Local environment

In this delivered workspace, the supplied Supabase credentials are already configured in:

- `Frontend/.env.local`: public project URL, anon key, API URL.
- `Backend/.env`: project URL, anon key, service-role secret, application origin, generated cron and billing webhook secrets.

Those files are ignored by Git and intentionally absent from the example files. Their values have not been verified against the live service. The Markdown escape before the underscore in the pasted service key was removed when saving the key.

For a fresh checkout, create these files yourself:

```powershell
Copy-Item Frontend/.env.example Frontend/.env.local
Copy-Item Backend/.env.example Backend/.env
```

Do not overwrite the populated local files unless you intend to reconfigure them.

| Variable | Location | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Public anon key, safe for browser use with RLS |
| `VITE_API_URL` | Frontend | `http://localhost:3001/api` locally; includes `/api` |
| `SUPABASE_URL` | Backend | Same project URL |
| `SUPABASE_ANON_KEY` | Backend | Builds clients carrying the authenticated user's JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Trusted booking, billing, and job operations |
| `APP_URL` | Backend | Exact frontend origin, locally `http://localhost:5173`; no trailing slash |
| `PORT` | Backend | Local API port, default 3001 |
| `CRON_SECRET` | Backend only | At least 32 characters; authorization for the scheduled worker |
| `BILLING_WEBHOOK_SECRET` | Backend only | At least 32 characters; HMAC billing signature secret |
| `BILLING_MODE` | Backend | `simulation` only |
| `NOTIFICATION_MODE` | Backend | `mock` only |

Optional setup-only variables: `DEMO_PASSWORD`, `DEMO_SUFFIX`, and `API_URL` for the billing simulator. These are not required by the application.

Generate a secret locally if needed:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Because the service-role secret was shared in chat, rotate it before a production handoff and update only the backend environment. Never prefix a server secret with `VITE_` or paste it into source files.

## 3. Supabase database and RLS

1. Open the Supabase project dashboard and its SQL editor.
2. Open `Backend/supabase/migrations/001_initial.sql` locally.
3. Paste the complete migration into a new SQL query and run it **once** against a clean application schema.
4. The migration creates tables, indexes, composite foreign keys, a GiST overlap constraint, RLS policies, functions, and the `client_metrics` view.
5. RLS is enabled in the migration; there is no separate RLS toggle step.

The migration is an initial migration, not an idempotent reset script. It deliberately does not drop data. If the project already has conflicting tables, use a fresh Supabase project or review and adapt the schema before execution. Keep later changes as new migration files.

The migration enables `btree_gist` in the `extensions` schema. Supabase provides PostgreSQL 15+ features used by the security-invoker view. Do not expose the `private` schema through the Data API.

**No live migration was applied during implementation.** Supabase API keys alone cannot run arbitrary schema SQL. If preferring the Supabase CLI, place this migration in your CLI project's `supabase/migrations` folder and use your own authenticated CLI/database credentials to push it; no such credentials were supplied here.

## 4. Supabase Auth configuration

In Authentication settings:

1. Enable email/password sign-in and sign-up.
2. Set Site URL to `http://localhost:5173` for local use.
3. Add redirect URLs `http://localhost:5173/dashboard` and `http://localhost:5173/reset-password`.
4. Keep email confirmation enabled for realistic onboarding, or disable it only in your development project. If enabled, confirm the account from the email before logging in.
5. Configure an email delivery provider in Supabase if required for reliable auth emails. Auth emails are separate from the application's mock appointment notifications.
6. Before production, add the equivalent production redirect URLs and update the Site URL.

Users create their business after obtaining a session. This makes the owner-to-business mapping depend on `auth.uid()`, never an arbitrary supplied user ID.

## 5. Install and start

Backend terminal, from the project root:

```powershell
cd Backend
npm ci
npm run dev
```

Frontend terminal, from the project root:

```powershell
cd Frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Local startup does not seed, reset, or migrate the remote database automatically.

Production build / local asset preview:

```powershell
cd Frontend
npm run build
npm run preview -- --port 5173
```

The backend remains necessary while previewing. Backend production start is `npm start` inside `Backend`.

## 6. First business setup

1. Choose **Start your workspace**, register, and confirm your email when required.
2. Create the business name, unique slug, and IANA timezone.
3. Open **Settings** to set public contact details, description, currency, and approval preferences.
4. Open **Services** and add at least one service with duration and price.
5. Open **Providers**, add yourself or a staff resource, and check the services that provider can perform.
6. Open **Availability**. Business defaults are Monday–Friday, 09:00–17:00. Edit and save them.
7. Optionally select a provider for narrower hours, or add blocked periods.
8. Open **Your booking page**. Its address is `/booking/your-slug`.

A provider must be active **and assigned to the service** for slots to appear. The page supports an any-provider selection, but the selected slot always identifies one concrete provider before submission.

## 7. Optional demo data

The seed utility creates two independent users, two businesses, two services and two providers per business, and service mappings. It does not create appointments or send messages. It was supplied but **not executed**.

Run only after the migration, from `Backend`:

```powershell
$env:DEMO_PASSWORD = 'ChooseYourOwnLongDemoPassword'
$env:DEMO_SUFFIX = 'review1'
npm run seed
```

Accounts are `oak-review1@example.com` and `fieldwork-review1@example.com`, using your chosen password. The utility confirms these demo accounts administratively because example.com cannot receive email. Slugs are `oak-form-review1` and `fieldwork-review1`. Use a different suffix for a new set.

Existing business slugs are skipped. If an earlier seed partially failed after creating an Auth user, remove that incomplete demo user through the Supabase dashboard or choose a new suffix before rerunning. The seed does not silently modify existing user accounts.

## 8. Notification jobs

Booking creation records a confirmation job and a 24-hour reminder job for enabled channels. Booking within 24 hours schedules the reminder immediately. Reschedule/cancel/confirmation actions replace stale jobs with the appropriate new version.

The scheduler endpoint is `GET /api/jobs/reminders`, protected by `Authorization: Bearer CRON_SECRET`. Running it processes up to 50 jobs using the **mock adapter**; delivery is a database log entry, not an email or SMS.

To run manually from `Backend`, when you choose to exercise this workflow:

```powershell
node --env-file=.env --input-type=module -e "const r=await fetch('http://localhost:3001/api/jobs/reminders',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}); console.log(r.status,await r.text())"
```

This command is documented only and was not executed during implementation. For a local recurring schedule, use a scheduler you control to call the same authenticated endpoint every 15 minutes. Keep the secret out of browser code and public URLs.

`Backend/vercel.json` supplies a 15-minute cron schedule. A Vercel plan that supports that interval is required. If your plan does not, remove the `crons` entry and configure an external scheduler with the authorization header. Daily jobs are insufficient for timely 24-hour reminders. Vercel's `CRON_SECRET` integration supplies the bearer header to supported cron invocations.

## 9. Billing simulation

All new tenants start a 14-day trial. The UI displays a $19 USD monthly plan, independent of the business's appointment currency.

1. Open **Billing**.
2. Choose **Start monthly subscription**.
3. Review the explicitly labelled simulated checkout.
4. Choose **Confirm simulated subscription**. The server validates the owner's membership and checkout session, then activates one month.
5. Replaying completion of the same session does not extend the subscription again.
6. Cancellation removes premium access immediately. Billing remains accessible to restore access.

For signed webhook simulation, use the selected business UUID shown in Supabase or returned by the seed. From `Backend`:

```powershell
npm run simulate:billing -- BUSINESS_UUID past_due 2026-10-07T00:00:00.000Z
```

Replace the example time with the period end appropriate to your exercise. Supported states: `active`, `trialing`, `past_due`, `cancelled`, `incomplete`. The script signs exact raw JSON bytes with the backend secret. Set `API_URL` if targeting a different backend. Do not point this utility at a real customer's tenant without intending to change its subscription state.

The simulation script is not a test runner and was not run. No Stripe keys are needed or accepted by this implementation. See `ARCHITECTURE.md` for access semantics and a real-provider extension path.

## 10. Deploy to Vercel

Two Vercel projects can share this source repository:

**Backend project**

1. Import the repository and set Root Directory to `Backend`.
2. Use the Node.js/serverless project configuration. `api/index.js` exports the Express app and `vercel.json` routes `/api/*` to it.
3. Configure all server variables from `Backend/.env.example` with production values. Set `APP_URL` to the final frontend origin.
4. Set an appropriate Node runtime version, at least 22.12.
5. Configure cron support as above. Do not expose the cron secret in a URL.

**Frontend project**

1. Import the same repository and set Root Directory to `Frontend`.
2. Choose Vite; build command `npm run build`; output directory `dist`.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=https://YOUR_BACKEND_DOMAIN/api`.
4. Deploy. SPA rewrites are supplied so direct links to dashboard and booking routes work.
5. Add the deployed frontend redirects in Supabase Auth and ensure the backend `APP_URL` exactly matches.
6. Rebuild the frontend when changing `VITE_` variables; they are embedded at build time.

No deployment has been performed. Cloud account access, environment configuration, migration execution, and a production acceptance run remain for the operator.

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| API exits with environment validation errors | Complete `Backend/.env`; both generated secrets must be at least 32 characters |
| Blank/missing data after sign-in | Apply the migration and use the same Supabase project in both folders |
| Email confirmation missing | Supabase Auth email settings, rate limits, SMTP, and spam folder |
| No time slots | Active service, active provider, mapping, enabled business hours, provider overrides, blocks, requested business-local date, future time |
| Booking conflict | Another booking occupied the provider/time; choose a newly returned slot |
| Subscription required | Use Billing to activate simulation; cancelled/incomplete/expired tenants cannot use premium APIs |
| CORS failure | Match `APP_URL` to the browser origin and restart backend |
| HTML received instead of API JSON | `VITE_API_URL` must include `/api` and point to the backend |
| Reminder remains queued | Run/configure the worker; check scheduled time and notification preferences |
| Currency update rejected | Bookings exist; historical appointment values must retain the same currency |
| Unknown function or relation | Migration missing, partial, or applied to a different Supabase project |

## 12. Tests and formatting

No executable test suite is included and no live verification was performed, following the explicit user instruction. `docs/TEST_CASES.md` lists the intended cases and their expected outcomes for later use. Do not interpret a successful compilation as evidence that database policies or workflows have passed those cases.
