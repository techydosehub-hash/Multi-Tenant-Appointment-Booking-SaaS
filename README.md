# Steadly — multi-tenant appointment SaaS

A complete source implementation of the required booking platform in **Jay Interview Task.pdf**, with a restrained ivory, charcoal, and muted-green interface. React lives in `Frontend`; the Express API, Supabase migration, and setup utilities live in `Backend`.

**Delivery status:** source written; dependencies installed; database migration and deployment are manual setup steps. Billing and notifications intentionally use the simulations allowed by the specification. No automated tests or live workflow tests have been created or run, at the user's request. See `docs/COMPLETION.md` for percentages and the distinction between implementation and verification.

## Start here

For the complete current path from local setup and the `PGRST205` fix through GitHub, Google sign-in, Vercel frontend hosting, and Render backend/cron hosting, follow [SETUP_AND_DEPLOYMENT.md](SETUP_AND_DEPLOYMENT.md). This is the consolidated step-by-step guide.

1. Read [how to run](docs/HOW_TO_RUN.md).
2. Apply [the database migration](Backend/supabase/migrations/001_initial.sql) to your Supabase project using its SQL editor.
3. Configure Supabase Auth URLs as described in the run guide.
4. Start the backend and frontend in separate terminals:

```powershell
cd Backend
npm ci
npm run dev
```

```powershell
cd Frontend
npm ci
npm run dev
```

5. Open `http://localhost:5173`, register, confirm your email if required, and create a business.
6. Add services, add a provider, assign services to the provider, and configure availability.
7. Share `/booking/your-business-slug`.

The supplied Supabase URL and keys have been placed in ignored local environment files. The server-only service-role key is **only** in `Backend/.env`. The `.env.example` files contain placeholders. If reproducing from a checkout, copy the examples and supply your own values. A later read-only schema diagnosis confirmed the application tables/view are visible; authenticated user workflows remain unverified.

## Stack and structure

- React 19, React Router, Vite, plain CSS, Lucide icons, Luxon for browser timezone presentation.
- Node.js 22.12+ and Express 5, Zod validation, Helmet, intentional CORS, public rate limiting.
- Supabase Auth and PostgreSQL, tenant RLS, composite foreign keys, exclusion constraint, transactional functions.
- Vercel-compatible frontend and backend deployment configuration, protected cron endpoint.
- Transactional notification mock adapter and signed HMAC billing simulation.

```text
Frontend/
  src/
    pages/             Landing, auth, booking, dashboard, CRM, configuration, billing
    context.jsx        Auth and selected-workspace state
    lib.js             API client and date/money presentation
    ui.jsx             Shared UI and resource loading
    styles.css         Responsive design system
Backend/
  src/
    app.js             Public and tenant-authorized API routes
    validation.js      Request schemas
    db.js              User JWT and trusted system clients
    notifications.js   Notification job processor and mock adapter
    config.js          Validated server environment
  api/index.js         Vercel entry point
  supabase/migrations/001_initial.sql
  scripts/             Optional two-business seed and signed billing simulator
docs/
  HOW_TO_RUN.md
  COMPLETION.md
  WORKFLOWS.md
  TEST_CASES.md
  ARCHITECTURE.md
  API.md
```

## Architecture

```mermaid
flowchart LR
  Public[Public booking client] --> React[React frontend]
  Owner[Owner or admin] --> React
  React --> Auth[Supabase Auth]
  React --> API[Express API]
  API --> User[User JWT client]
  User --> RLS[PostgreSQL RLS]
  API --> System[Scoped trusted RPC calls]
  System --> DB[PostgreSQL transactions]
  RLS --> DB
  Cron[Authenticated cron] --> Jobs[Notification worker]
  Jobs --> DB
  Billing[Signed simulation events] --> API
```

Private CRUD uses the user's JWT, membership checks, and RLS. Public booking and privileged system operations use a server-only client with narrow response projections and validated tenant context. Availability and final booking validation share the same SQL function. PostgreSQL serializes changes per business and rejects overlapping provider appointments even under concurrency.

## Documentation and verification

- [Run and deployment guide](docs/HOW_TO_RUN.md): variables, migration/RLS, optional seed, jobs, billing, Vercel, troubleshooting.
- [Completion percentages](docs/COMPLETION.md): implemented artifacts versus unverified runtime behavior.
- [Workflows and roles](docs/WORKFLOWS.md): public client, owner, admin, provider resource, scheduler, billing.
- [Detailed test-case list](docs/TEST_CASES.md): planned manual/unit/integration/E2E cases; **all unexecuted**.
- [Architecture and trade-offs](docs/ARCHITECTURE.md): tenant boundary, races, DST, state rules, metrics, scaling, limitations.
- [API reference](docs/API.md): endpoints, auth headers, error contract, request examples.

There is no `npm test` script and no test suite, per the explicit request. `npm run build` in `Frontend` compiles production assets; it is not a workflow test. JavaScript syntax checks do not establish correctness of the SQL or live integration. See the completion report for actual checks performed.

**Live demo:** not deployed; no production URL is claimed. Vercel configuration is included for both folders. No remote repository, commits, or cloud deployment were created.

## Main limitations

The SQL migration must be applied before the app can use live data. A Supabase anon or service-role API key is not a SQL editor or database password. Auth delivery settings and production hosting credentials must be configured in their respective dashboards.

Email/SMS delivery and paid billing are simulated. Core flows have source implementations but have not been runtime-tested. The basic rate limiter is per process; production serverless deployments should add distributed abuse controls. Staff/provider records represent schedulable resources rather than staff login accounts. Member invitation UI, optional AI features, waitlists, iCal export, and public self-service rescheduling are outside the required baseline. See the architecture guide for details.
