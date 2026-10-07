# Project audit against Jay Interview Task.pdf

**Audit date: 7 October 2026 (Asia/Kolkata).** Source specification: `J:\TECH STARTUP GOAL\Jay Interview Task.pdf`, all 17 pages. This report separates implementation, observed behavior, deployment work, and optional scope. It does not equate written code with a perfectly verified production system.

## 1. Changes completed in this update

- **Timezone selection:** replaced browser-dependent datalists in Add Business and Settings with a searchable, labelled native select. It accepts valid IANA timezone values, supports city/region search, preserves the selected value when a search has no matches, includes UTC, and falls back to common valid zones if a browser lacks `Intl.supportedValuesOf`. Kolkata is explicitly included even when a browser lists the older Calcutta alias.
- **Owner/admin account profiles:** added `/dashboard/profile`, sidebar navigation, and a clickable name/role/avatar in the header. Users can save their own full name, phone, biography, and personal timezone to Supabase Auth. The page shows email, sign-in providers, account creation date, role, workspace memberships, switching controls, and password-reset action. A personal timezone does not change business availability.
- **Profile authorization:** the backend validates the JWT and editable fields. It updates only the authenticated user's presentation metadata. Tenant roles remain authoritative in `business_members`; profile edits cannot change permissions. Profiles remain accessible when billing is inactive.
- **Realistic simulated payments:** payment-method selection, order review, expiry countdown, animated processing, approved/declined demo outcomes, retry, server-confirmed activation, persistent receipts, downloadable receipt files, and paginated checkout history. The amount comes from the backend's fixed $19 USD monthly plan. No real card/bank fields, payment gateway, charges, or automatic renewal were introduced.
- **Booking list filters:** added provider and business-local date filters alongside the existing status filter, plus Clear filters and pagination reset.
- **Stale-update handling:** added a fast authorized version check to status/reschedule endpoints. An explicitly stale version now returns HTTP 409 promptly. The database still performs the final version check while holding the transaction lock.
- **Database error hardening:** database requests have a 20-second timeout; connection timeout errors return an explanatory 503 instead of hanging indefinitely.
- **Safe incremental SQL patch:** `Backend/supabase/migrations/002_booking_conflict.sql` replaces only two functions. It changes the atomic stale-version exception to `PT409`, and fixes the business-creation allowance so shared/demo memberships do not consume the limit of five businesses actually created by an account. It preserves existing rows, RLS, and function privileges.

## 2. What is working and what was verified

### Existing production deployment

Your earlier URL/CORS issue is resolved. Using a dedicated demo owner, the Vercel site successfully opened the dashboard, calendar, bookings, clients, services, providers, availability, notifications, settings, and billing. Those page visits produced no browser exceptions or error alerts. New changes in this update were verified through the local updated frontend/API, connected to the same Supabase **demo** data; they are not yet deployed by this task.

### Targeted API/database checks: 25 passed

1. Missing authentication is rejected.
2. A dedicated tenant owner cannot read another tenant's private API data.
3. Direct Supabase reads using that owner's JWT return no foreign clients.
4. Direct writes into another tenant are rejected by RLS.
5. Admin profile reads work.
6. Admin billing mutations are rejected by the current owner-only rule.
7. Cancelled billing gates premium dashboard access.
8. Personal profile reads remain accessible outside that gate.
9. Public metadata exposes active offerings.
10. A 90-minute service produces 90-minute slots.
11. A whole-business holiday returns no slots.
12. Simultaneous requests for the same provider/time produce exactly one success and one conflict.
13. A created public booking has tenant-visible detail and CRM linkage.
14. A scoped mock notification delivery repeated with the same lease produces one delivery log.
15. Rescheduling validates availability and increments the version.
16. An explicit stale version returns 409 through the updated API.
17. Cancellation with the current version succeeds.
18. Cancellation releases the exact appointment slot.
19. An ended confirmed appointment can become completed.
20. An ended confirmed appointment can become no-show.
21. CRM lifetime value includes completed spend only.
22. Reusing a request key returns the same booking, and repeated email bookings reuse the tenant's client.
23. An approval-enabled booking goes pending → confirmed → cancelled.
24. An unsigned billing webhook is rejected.
25. An invalid profile timezone is rejected server-side.

The checks used actual Supabase demo rows. A few clearly labelled QA appointments and one fictional QA customer per exercised tenant were retained as audit/history data. Future QA appointments were cancelled to release their slots. The original two hands-on practice appointments were not consumed. No real workspace configuration was edited. The global reminder processor was not invoked.

An early stale-update check returned an upstream timeout. The updated API precheck was subsequently verified to return 409, and a valid cancellation succeeded. The SQL patch's `PT409` path has **not** been executed against the live database; apply the patch before considering simultaneous version-conflict behavior fully hardened. The underlying timeout's infrastructure cause was not independently proven. `PT409` deliberately expresses a domain conflict rather than a PostgreSQL serialization rollback. [PostgREST custom error documentation](https://docs.postgrest.org/en/stable/references/errors.html#custom-errors)

### Browser checks on the new implementation

- Selected America/New_York during onboarding and preserved it when searching for a nonexistent city.
- Saved the Oak demo owner's profile and confirmed it survived a full reload.
- Confirmed both owner and admin profile role labels.
- Completed the declined-payment flow and returned to method selection for retry.
- Completed an approved Horizon demo payment and observed server-confirmed active subscription state.
- Refreshed the completed checkout and reopened its receipt.
- Downloaded a simulated receipt file.
- Cancelled Horizon's subscription afterwards, restoring its cancelled example state.
- Opened the profile after cancellation.
- Confirmed the admin has no owner checkout controls.
- Confirmed the new provider/date filter controls render.
- Checked the checkout at a 390-pixel viewport: no horizontal page overflow.
- No browser exceptions occurred during the successful owner/admin interface checks.

The receipt screen was visually inspected. Reduced-motion preferences disable checkout animations. Email delivery of password resets and a real Google OAuth round trip were not performed.

## 3. Requirement-by-requirement coverage

“Implemented” means there is an identifiable code/schema/UI path. “Verified” below states the actual scope; it does not imply every edge case in that area was exercised.

| PDF section/pages          | Requirement                                                                              | Current implementation and evidence                                                                                                                                   | Remaining limits                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| §§1–3, pp. 1–3             | End-to-end SaaS for independent businesses                                               | Landing, Auth, onboarding, separate tenant configuration, public booking, dashboard, CRM, mock billing/jobs                                                           | A clean new-reviewer reproduction is still outstanding                                                                                     |
| §4, p. 4                   | React/Vercel, Node API, Supabase Auth/Postgres/RLS                                       | React 19/Vite, Express 5 on Render, Supabase; existing production pages opened successfully                                                                           | New source changes need hosting deployments                                                                                                |
| §5, pp. 4–5                | Explicit tenant context, transaction-safe bookings, provider abstraction, server secrets | JWT membership checks, tenant header validation, slug resolution, advisory locks/exclusion constraint, notification adapter, ignored backend secret file              | No high-load benchmark or infrastructure review                                                                                            |
| §6, p. 5                   | Auth, memberships, public/staff separation, RBAC                                         | Email/Google UI, JWT validation, owner/admin membership, role-specific profiles; foreign tenant access and admin restrictions checked                                 | Admin billing permission is narrower than the PDF's combined Owner/Admin matrix; see section 5                                             |
| §7, pp. 5–6                | Relational schema and integrity                                                          | 16 application tables, metrics view, tenant composite FKs, minor-unit prices, unique slugs/email, indexes, timestamptz                                                | Clean-database replay of migrations not executed in this update                                                                            |
| §8, p. 6                   | Database tenant isolation                                                                | Membership-based RLS and grants; foreign client reads empty and foreign service inserts denied using tenant JWT                                                       | Exhaustive cross-tenant tests for every table/mutation are not a committed suite                                                           |
| §9, pp. 6–7                | Public slug/service/provider/date/slot/contact/confirmation                              | Full journey; server-generated duration/price/status; real public API booking and CRM linkage checked                                                                 | New browser public-form submission and mobile booking at every viewport not rerun here                                                     |
| §10, pp. 7–8               | Authoritative availability, overlap prevention, timezones                                | Shared SQL engine, 15-minute starts, full duration, hours/overrides/blocks; 90-minute duration, holiday, race and released-slot checks passed                         | Runtime DST transitions, midnight boundaries, and back-to-back endpoint boundaries still need dedicated fixtures                           |
| §11, p. 8                  | Confirm/cancel/reschedule/complete/no-show, terminal states, audit                       | All transitions implemented; approval, reschedule, cancel, completed/no-show verified; version precheck verified                                                      | Atomic version-conflict SQL patch pending; complete rejection matrix not exhaustively run                                                  |
| §12, pp. 8–9               | Day/week/month calendar, summary, configuration                                          | Calendar views/provider filter, status badges/detail links, metrics, business/services/providers/schedule/preferences, new list filters                               | All calendar modes and filter combinations are not covered by a saved regression suite                                                     |
| §13, p. 9                  | CRM search, profiles, history, private notes, value, deduplication                       | CRM screens/view; QA history, completed-only spend and email deduplication verified                                                                                   | Notes editing/search permutations and phone validation boundaries need fuller regression coverage                                          |
| §14, pp. 9–10              | 24-hour jobs, excluded cancellations, idempotent delivery, failure/retry records         | Queue records, protected worker, leases, three-attempt retry bounds, mock logs; scoped delivery idempotency verified                                                  | Hosting cron execution, full crash/lease recovery and bounded failure retries were not exercised; no actual email/SMS                      |
| §15, p. 10                 | Monthly access state, provider identifiers, signed webhook, server gating                | Trial/active/past_due/cancelled/incomplete, $19 checkout, demo receipt/history, HMAC webhook, three-day grace; activation/cancel/gate and unsigned rejection verified | No real payment provider; intentionally allowed by the PDF and requested by you. Full signed replay/out-of-order event checks remain       |
| §16, pp. 10–11             | Public/private APIs, JSON, validation/auth/statuses                                      | All listed capabilities plus provider/profile/history/checkout-read/decline endpoints                                                                                 | All negative inputs and error variants not exhaustively exercised                                                                          |
| §17, p. 11                 | Required routes, responsive/accessibility/state handling                                 | Required routes plus profile; native keyboard controls, loading/errors/confirmations, duplicate-submit protection, reduced motion                                     | Mobile checkout checked; comprehensive keyboard/a11y and cross-browser audit outstanding                                                   |
| §18, pp. 11–12             | Validation, secrets, signatures, intentional CORS, abuse/audit controls                  | Zod, normalization, safe text rendering, RLS/grants, HMAC, rate limits, Helmet, request IDs, booking events                                                           | In-memory rate limiting needs a shared store for multiple API replicas; rate/security penetration testing not done                         |
| §19, p. 12                 | Bounded queries, pagination, indexes, database metrics, scale notes                      | API pagination/date bounds, joined booking data, aggregate view/RPC, documented scale trade-offs                                                                      | No load test. Public configuration caching remains intentionally conservative to avoid stale availability/configuration                    |
| §20, p. 12                 | Structured logs, booking/billing/notification audit                                      | Request IDs/server logs and database event/log tables; verified booking events and mock delivery                                                                      | No managed monitoring/alert dashboards configured                                                                                          |
| §21, pp. 12–13             | Optional AI scheduling/risk/follow-ups                                                   | Not implemented                                                                                                                                                       | Optional bonus; not required for the core assessment                                                                                       |
| §22, p. 13; §25, pp. 14–15 | Automated unit/integration/E2E tests                                                     | Targeted API/DB and browser verification performed as listed above; detailed manual test list exists                                                                  | No committed automated regression/CI suite; prior request explicitly excluded test files. Temporary checks do not replace this deliverable |
| §23, pp. 13–14             | Deployment/environment examples/clean build                                              | Vercel frontend, Render Node API, Supabase, environment templates, SPA rewrite, production build                                                                      | New release and SQL patch pending; independent clean-checkout build/migration reproduction not performed                                   |
| §24, p. 14                 | Repository/README/setup/architecture/limitations                                         | Required folders, lockfiles, examples, migration, seed utilities, architecture/API/workflow/deployment/test-list docs                                                 | Commit history/reviewer access are owner-managed; this task did not push changes                                                           |
| §§25–27, pp. 14–15         | Deliverables/rubric/planned phases                                                       | Core implementation and documentation exist; demo data seeded; meaningful targeted checks now run                                                                     | Automated test deliverable and release operations remain; no artificial 100% rubric score claimed                                          |
| §28, p. 16                 | Sixteen acceptance criteria                                                              | All 16 have identifiable source implementation paths; traceability below                                                                                              | Source-path coverage is not full runtime verification                                                                                      |
| §29, p. 16                 | Bonus challenges                                                                         | Multiple providers/hours/capabilities, dated holidays, mock webhook grace states                                                                                      | Waitlist, recurrence rules, provider-specific timezones, iCal, secure customer self-service and AI not implemented                         |
| §30, pp. 16–17             | Submission checklist                                                                     | Existing live site, Supabase/Auth, core flows, docs, examples, RLS/concurrency implementation                                                                         | Finish release, SQL patch, reviewer access, regression suite, and remaining verification                                                   |

## 4. PDF acceptance criteria 79–94

| Criterion                         | Source path                                                 | Verification in this update                                                                                                          |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 79. Register/create tenant        | Supabase Auth, Onboarding, `/businesses`, `create_business` | Existing login verified; timezone form checked. Fresh signup/tenant mutation not run; shared-membership limit fix requires SQL patch |
| 80. Configure slug/publish        | Settings, unique slug, public route                         | Existing published pages loaded; slug editing not mutated                                                                            |
| 81. Create duration/price service | Services UI/API/constraints                                 | Existing services verified; 90-minute offering checked; fresh service creation not exercised                                         |
| 82. Configure hours               | Availability UI/API and hours tables                        | Hours UI read and seeded holiday checked; editing every schedule mode not exercised                                                  |
| 83. Show valid slots              | SQL availability RPC/public flow                            | Verified slots, 90-minute duration, holiday exclusion                                                                                |
| 84. Complete public booking       | Public booking API/transaction                              | Verified real demo booking creation                                                                                                  |
| 85. Revalidate before insert      | `create_booking` → `available_slots`                        | Verified competing request conflict                                                                                                  |
| 86. Prevent double-booking        | Transaction lock + exclusion constraint                     | Verified exactly one winner from simultaneous slot requests                                                                          |
| 87. Show booking in dashboard     | Detail/list/calendar API/UI                                 | Verified tenant booking detail and existing production pages                                                                         |
| 88. Cancel/reschedule             | Detail actions/`change_booking`                             | Verified reschedule/version increment/cancel/released slot                                                                           |
| 89. CRM/history                   | Tenant email upsert/metrics/client pages                    | Verified linkage, deduplication and completed-only value                                                                             |
| 90. Generate reminder             | Transactional enqueue/mock adapter                          | Verified confirmation/reminder rows and scoped delivery idempotency                                                                  |
| 91. Gate by subscription          | `has_access`, premium middleware, write RLS                 | Verified cancelled gate, successful demo activation and cancellation                                                                 |
| 92. RLS isolation                 | Membership policies/column grants/FKs                       | Verified foreign client reads empty and foreign service writes rejected                                                              |
| 93. Document deployment           | Deployment guide/config/examples                            | Existing site works; new release steps documented, not executed                                                                      |
| 94. Clean reviewer reproduction   | README/lockfiles/migrations/examples                        | Source reviewed; independent clean-room reproduction not executed                                                                    |

**Measured source traceability: 16/16 = 100% of acceptance criteria have a source path.** This is not “100% of the entire PDF perfectly done.” Verification is deliberately reported per criterion rather than giving a misleading production-readiness percentage.

## 5. What is not fully complete, why, and how to finish

### Required release work

1. **Incremental SQL patch not applied:** application service-role credentials cannot execute arbitrary schema DDL through Supabase's data API. Open the intended project's SQL Editor and run `Backend/supabase/migrations/002_booking_conflict.sql` once. It replaces functions only; do not rerun `001_initial.sql` over populated tables. Then verify stale simultaneous updates produce one success and one 409.
2. **New UI/API not deployed:** local changes passed targeted checks, but this task did not push or operate hosting dashboards. Deploy both frontend and backend together using section 6; old backend releases do not have `/profile` or the new checkout/history routes.
3. **Cron execution unverified:** confirm the Render Cron Job's schedule, `API_URL`, and matching `CRON_SECRET`; inspect a real run. The mock worker is deliberately global, so it was not run during demo-only checks. A documented simulation is permitted by §14.

### Literal PDF differences and remaining engineering work

- **Admin subscription management:** §6.3 combines Owner/Admin and permits managing subscriptions; the current app intentionally restricts financial actions to owners. This was preserved from the existing role workflow. For literal parity, grant both roles billing in the Express guard, the `complete_checkout` SQL membership check, and Billing/Profile UI, then test allowed admin actions and denied foreign-tenant actions. Do not change only the UI or proxy an admin action as an owner's identity.
- **Committed automated test deliverable:** §22 and §25 expect unit/integration/critical E2E tests. The earlier instruction was to build without test files; this update performs the newly requested verification using temporary runners. To fulfill the repository deliverable, add a maintained suite and CI against an isolated Supabase test project, including concurrency, RLS across all tables, DST, reminder crash/retry, signature/replay, and clean migration checks.
- **Fresh signup/reproduction:** existing demo credentials and tenant workflows work, but signup email confirmation and a new reviewer setup were not exercised. Use a controlled mailbox to test signup/reset and run the documented setup in a new checkout/test database.
- **Google OAuth:** the buttons/callback and setup instructions exist. Verify the configured provider and redirects with a real linked Google account; fictional demo accounts cannot verify a Google round trip.
- **Production scale/monitoring:** indexes/pagination/bounded queries and trade-offs are present, but no capacity benchmark or managed alerts were configured. Add load measurements, shared rate limiting for replicas, connection/queue monitoring, and appropriate provider throughput controls before claiming production-scale readiness.
- **Additional optional/bonus scope:** AI tools, waitlists, recurring exception rules, provider-specific timezone configuration, calendar exports, and customer self-service links are not implemented because the PDF labels them optional/bonus. Add each as a separate feature using the same tenant boundary and authoritative scheduling engine; their absence does not block the core assessment.
- **Real payments and real messages:** intentionally absent. The PDF permits simulation/mock adapters and you explicitly requested no real payment integration. No real financial gateway is required to finish the agreed scope.

## 6. Exact steps to release this update

1. In Supabase SQL Editor apply **`002_booking_conflict.sql`**. No data reset is required. Preserve `001_initial.sql` for fresh installations only; fresh installations can apply migrations in numeric order.
2. From project root review the changes and publish the intended files:

   ```powershell
   Set-Location 'J:\TECH STARTUP GOAL\Multi tenant booking saas'
   git status --short
   git diff
   git add .gitignore Backend/package.json Backend/scripts/seed-rich.js Backend/src Backend/supabase/migrations/001_initial.sql Backend/supabase/migrations/002_booking_conflict.sql Frontend/src docs README.md SETUP_AND_DEPLOYMENT.md DEMO_WORKFLOW_GUIDE.md
   git diff --cached --stat
   git commit -m "Improve timezone selection, account profiles and simulated checkout"
   git push
   ```

3. Keep secrets and local login/verification files ignored. Confirm the branch being pushed is the one configured for production; otherwise merge to the configured production branch without force-pushing.
4. Deploy the latest backend commit on Render, with Root Directory `Backend`, build `npm ci`, start `npm start`. Keep `APP_URL=https://multi-tenant-appointment-booking-sa.vercel.app` and `TRUST_PROXY=1`.
5. Deploy the latest frontend commit on Vercel, with Root Directory `Frontend`, build `npm run build`, output `dist`, and `VITE_API_URL=https://steadly-api.onrender.com/api`.
6. Wait for both releases to finish. Hard-refresh the site. Check `/api/health/ready`, sign in, open My profile, and verify the new billing/history routes do not return 404.
7. Repeat the short release checklist below using demo data. Do not activate real payment services.

## 7. Short post-deployment checklist

1. Add Business → search/select Kolkata, New York and UTC; selected values remain after clearing the search. After the SQL patch, your four granted demo memberships do not consume your actual business-creation allowance.
2. Owner → My profile → change name/bio/personal timezone → save → refresh. Header name updates; business schedules keep their own timezone.
3. Admin → My profile → confirm admin role and only permitted workspace memberships. Billing retains its current read-only restriction unless you explicitly adopt the PDF parity change above.
4. Billing → start → select declined demo method → review → confirm → see decline → retry with approved demo method.
5. Approved payment → processing animation → success receipt → refresh → download → return to Billing and confirm active period.
6. Switch to a different tenant while viewing a checkout. A foreign checkout must not be displayed; return to Billing to start that tenant's own session.
7. Open an expired session → no pay button; start a new session. Returning from checkout abandons the pending session; it becomes unusable after expiry without changing the subscription.
8. Bookings → combine status/provider/date filters, clear them, and use pagination.
9. Open the same booking in two tabs → change it in one → update the stale second tab → 409/refresh guidance; no overwritten state.
10. Confirm the original real workspace and other tenants' private data remain isolated.

Use `DEMO_WORKFLOW_GUIDE.md` for the longer tour and `docs/TEST_CASES.md` for remaining negative/boundary cases. This audit is the current source of truth; the original completion tables describe an earlier delivery snapshot.
