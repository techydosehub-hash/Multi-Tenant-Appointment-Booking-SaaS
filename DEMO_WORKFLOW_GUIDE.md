# Steadly: live demo data and step-by-step workflow checks

Prepared on **7 October 2026**. All demo times use **Asia/Kolkata**. These records have already been inserted into your connected Supabase database. They are not browser-only mock data.

**Latest update:** the initial URL/CORS issue described in section 1 is now resolved and the existing production pages work. Treat that section as recovery reference. The latest profile/timezone/payment implementation, targeted verification, pending SQL patch, and complete release instructions are in [docs/PDF_REQUIREMENTS_AUDIT.md](docs/PDF_REQUIREMENTS_AUDIT.md). Targeted checks have added a small amount of labelled QA history, so the tables below remain the original seed baseline rather than current live totals.

## 1. Fix these two deployment settings first

The database seed succeeded. However, inspecting your deployed website showed a real deployment configuration problem:

- The frontend calls `https://steadly-api.onrender.com/me`. The server route is `/api/me`.
- The Render CORS response allows `https://multi-tenant-appointment-booking-sa.vercel.app/`, with a trailing slash. The browser origin has no trailing slash, so the browser rejects the request.
- As a result, email authentication can succeed but the dashboard displays **Failed to fetch**. This also prevents the booking pages from reading their services. Creating more database rows cannot fix this browser connection problem.

### 1A. Correct Render

1. Open your Render dashboard and select the **steadly-api** web service.
2. Open **Environment**.
3. Set this exact value, without a trailing slash:

   ```dotenv
   APP_URL=https://multi-tenant-appointment-booking-sa.vercel.app
   ```

4. Confirm `TRUST_PROXY=1`, `BILLING_MODE=simulation`, and `NOTIFICATION_MODE=mock`.
5. Keep the existing Supabase URL, anon key, service-role key, cron secret, and billing webhook secret. Do not copy the service-role key into Vercel's frontend variables.
6. Save the environment change and deploy/restart the service. Wait for it to be live.
7. Open [API health](https://steadly-api.onrender.com/api/health) and [database readiness](https://steadly-api.onrender.com/api/health/ready). Both should return JSON with an `ok`/`ready` status.

Render explains saving variables and deploying them in its [environment configuration documentation](https://render.com/docs/configure-environment-variables).

### 1B. Correct Vercel

1. Open the Vercel project serving your deployed frontend.
2. Open **Settings → Environment Variables**.
3. Set this exact value in the **Production** environment:

   ```dotenv
   VITE_API_URL=https://steadly-api.onrender.com/api
   ```

4. Keep `VITE_SUPABASE_URL=https://qubtwpwdljjoweeasdhn.supabase.co` and your existing anon key.
5. Open **Deployments** and redeploy the production deployment after saving. Vite embeds these variables at build time; refreshing an old deployment does not update them. [Vercel environment variable documentation](https://vercel.com/docs/environment-variables)
6. Hard-refresh the site with **Ctrl+Shift+R**.
7. Sign in again. In browser developer tools → Network, the membership request must now go to `https://steadly-api.onrender.com/api/me` and return HTTP 200.

These hosting dashboard changes have **not** been made from this workspace. Complete 1A and 1B before the workflows below.

### 1C. Publish the defensive code improvements

The local code now also accepts an API origin without `/api` and normalizes Render's `APP_URL` to its origin. This makes these formatting mistakes less likely in future deployments. The seed utility never runs during server startup.

From **project root**, review and publish these specific changes:

```powershell
Set-Location 'J:\TECH STARTUP GOAL\Multi tenant booking saas'
git status --short
git diff
git add .gitignore Backend/package.json Backend/scripts/seed-rich.js Backend/src/config.js Frontend/src/lib.js DEMO_WORKFLOW_GUIDE.md README.md SETUP_AND_DEPLOYMENT.md
git diff --cached --stat
git commit -m "Add persistent demo workspaces and normalize deployment URLs"
git push
```

Use your repository's existing checked-out branch. If it is not the production branch, merge these changes into the branch configured in Render/Vercel. Do not force-push. Git commands above are steps for you; no commit or push has been performed by this task.

If auto-deploy is enabled, wait for both hosting deployments to finish. Otherwise select a manual deployment of the latest commit. Render documents this in [Deploying on Render](https://render.com/docs/deploys).

**Do not rerun `001_initial.sql` to view this data. Your migrated database already contains it.**

## 2. What has actually been saved

Your real **TechyDose Hub** workspace was left unchanged. Its service, provider, client, booking, reminder, and notification-log counts remain zero, matching the inventory before seeding.

Your existing account now has **five memberships**: TechyDose Hub plus four separate demo workspaces. Demo appointments do not consume your real workspace's booking slots.

| Saved item                                |           Per demo workspace | Total across four demos |
| ----------------------------------------- | ---------------------------: | ----------------------: |
| Appointments                              |                          250 |               **1,000** |
| Customers, contact details, private notes |                           60 |                 **240** |
| Services                                  | 6: five active, one archived |                      24 |
| Providers                                 | 5: four active, one archived |                      20 |
| Provider/service assignments              |                           18 |                      72 |
| Business weekly hours                     |                            7 |                      28 |
| Provider weekly overrides                 |                           28 |                     112 |
| Blocked periods                           |                            5 |                      20 |
| Booking audit events                      |                          433 |                   1,732 |
| Confirmation/reminder records             |                        1,000 |                   4,000 |
| Mock notification delivery logs           |                          740 |                   2,960 |
| Subscription records                      |                            1 |                       4 |
| Mock checkout sessions                    |                            4 |                      16 |
| Billing event fixtures                    |                            2 |                       8 |

Five confirmed demo Auth accounts were created: four owners and one admin. All customer emails and phone numbers are fictional. No welcome emails, real SMS messages, or payments were sent or charged by the seeding utility. Imported delivery logs explicitly identify themselves with `demo_fixture_` message IDs; they are sample history, not proof of real delivery.

### Workspace purposes and public links

| Workspace                   | Seeded subscription                             | Approval | Public booking page                                                                                       |
| --------------------------- | ----------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| [DEMO] Oak & Form Studio    | Active through 6 November 2026, 23:00 IST       | Off      | [Open salon bookings](https://multi-tenant-appointment-booking-sa.vercel.app/booking/demo-oak-form)       |
| [DEMO] Fieldwork Consulting | Trial through 21 October 2026, 23:00 IST        | On       | [Open consulting bookings](https://multi-tenant-appointment-booking-sa.vercel.app/booking/demo-fieldwork) |
| [DEMO] Northstar Wellness   | Past due; grace until 9 October 2026, 23:00 IST | Off      | [Open wellness bookings](https://multi-tenant-appointment-booking-sa.vercel.app/booking/demo-northstar)   |
| [DEMO] Horizon Photo Studio | Cancelled; dashboard gated                      | Off      | [Open photography bookings](https://multi-tenant-appointment-booking-sa.vercel.app/booking/demo-horizon)  |

Past-due grace is three days after the current period end. The underlying Northstar period ended on 6 October, 23:00 IST. Its demo access will naturally change as time passes. The subscription simulation does not automatically renew.

Each workspace has 160 historical appointments, eight ended appointments on 7 October, 80 upcoming appointments including cancellations, and two confirmed appointments on 6 October reserved for practicing completion/no-show. Upcoming dates and today's dashboard counts change with the current date; sample bookings are not automatically shifted forward.

### Seeded appointment statuses

| Workspace  | Completed | No-show | Cancelled | Confirmed | Pending |
| ---------- | --------: | ------: | --------: | --------: | ------: |
| Oak & Form |       130 |      17 |        29 |        60 |      14 |
| Fieldwork  |       130 |      17 |        29 |         2 |      72 |
| Northstar  |       130 |      17 |        29 |        60 |      14 |
| Horizon    |       130 |      17 |        29 |        60 |      14 |

## 3. Access the demos from your existing account

1. Complete the deployment correction in section 1.
2. Open [login](https://multi-tenant-appointment-booking-sa.vercel.app/login) and use your normal account.
3. Reload the dashboard so it retrieves the updated memberships.
4. Use the **WORKSPACE** dropdown in the sidebar, labelled **Select business**.
5. Select **[DEMO] Oak & Form Studio** first. You have owner access in every demo.
6. Switch between the demos. The selected business changes the tenant header sent to the API; services, clients, calendar, and settings should change together.
7. If you select Horizon, a subscription attention message is expected. Open **Billing** to restore its demo subscription, or switch back to Oak.

The original database function counted all five memberships against the creation limit. The new incremental SQL patch changes that to count only businesses actually created by your account, so granted demo memberships do not consume your allowance. Apply `002_booking_conflict.sql` before creating another business. The four demos already exist; you do not need to recreate them.

### Separate role accounts

Passwords are in the ignored local file **`DEMO_ACCESS.local.md`** in project root. It also lists the login emails. You do not need these passwords when using the demos through your own account.

| Role account      | Email                                      | Intended access                                     |
| ----------------- | ------------------------------------------ | --------------------------------------------------- |
| Oak owner         | `demo.oak.owner@steadly.example.com`       | Oak only, including billing                         |
| Fieldwork owner   | `demo.fieldwork.owner@steadly.example.com` | Fieldwork only                                      |
| Northstar owner   | `demo.northstar.owner@steadly.example.com` | Northstar only                                      |
| Horizon owner     | `demo.horizon.owner@steadly.example.com`   | Horizon only; billing accessible while gated        |
| Operational admin | `demo.admin@steadly.example.com`           | Oak only; operational management, billing read-only |

Use separate browser profiles/private windows for role checks. Providers are scheduling resources, not login accounts. Public customers do not need a login or a customer dashboard in this implementation. There is no implemented super-admin portal.

## 4. Recommended order for checking the whole system

Run these manually after deploying the current changes. At the original seeding delivery, only fixture imports and read-only inspection had been performed. The later update now includes targeted demo-only booking, rescheduling, cancellation, lifecycle, mock-delivery, and payment checks; their exact evidence and unverified cases are documented in the current PDF audit. The global reminder processor was not invoked.

### A. Overview, booking list, and calendar

1. Select Oak and open **Overview**.
2. Initially expect **60 clients**, completed revenue **₹152,600**, and a no-show rate of **11.6%** where displayed. On 7 October the overview has eight same-day appointments. The upcoming-seven-day total is time-dependent; it was 21 when read.
3. Open **Bookings**. Confirm pagination and each status filter: pending, confirmed, cancelled, completed, no-show.
4. Filter by provider, then clear it. Confirm only that provider's bookings remain while filtered.
5. Open **Calendar**. Change month/week/day views, move backward to historical dates and forward to upcoming dates, and filter by provider.
6. Open one calendar appointment. Its time, service, provider, customer, amount, and status should match the booking detail page.
7. Remember that the calendar loads up to 100 appointments per page; use pagination if the selected period has more.

Expected: historical and future data survives refreshing and switching browsers because it comes from Supabase.

### B. Public customer booking without approval

1. In a separate browser window open the Oak booking link from section 2.
2. Confirm five active service cards. The archived bridal service must not appear.
3. Select **Classic haircut**, then **Find a time**.
4. Choose a future Monday–Saturday and a provider. Avoid 17 October, the seeded business holiday. Times use Asia/Kolkata.
5. Select an available slot, continue to details, and use fictional data:

   ```text
   Name: Manual Demo Customer
   Email: manual.demo.customer@example.com
   Phone: +15555550101
   Notes: Manual workflow check in demo workspace only
   ```

6. Submit once. Expect a confirmation reference and **confirmed** status because approval is disabled.
7. Return to the owner dashboard, reload Bookings, and locate the appointment using its reference/date/customer.
8. Open Clients and search the email. The new customer should exist in Oak. Its private notes are separate from the customer's booking message.
9. Open Notifications. Confirmation and 24-hour reminder jobs should be queued for enabled channels.
10. To prove persistence, reload and optionally check the corresponding Supabase `bookings` and `clients` rows filtered to Oak's business ID.

Expected: one real database booking in the demo workspace, the correct provider/service duration and price, and no change to TechyDose Hub.

### C. Approval workflow

1. Open Fieldwork's public booking page in a separate window.
2. Choose **Strategy introduction**, a future slot, and fictional contact details.
3. Submit. Expect **pending**, rather than confirmed.
4. In the owner dashboard switch to Fieldwork → Bookings → pending.
5. Open the new appointment and click **Confirm appointment**.
6. Reload and verify confirmed status plus the new audit event.
7. Repeat with another appointment and cancel it instead of confirming.

Expected: new Fieldwork bookings require approval. Existing fixture statuses represent imported history; use a new public booking to exercise the real transition.

### D. Reschedule and cancel

1. Select a future, non-terminal appointment in Oak or Fieldwork.
2. Open its details and note the original date, time, provider, and reference.
3. Click **Reschedule**, choose a future date and eligible provider, and select an available slot.
4. Confirm the reschedule and reload.
5. The booking reference should remain the same, the time/provider should update, and an audit event should appear. The booking version increments.
6. Check the public booking page: the old time is free if no other booking/block occupies it, while the new time is unavailable for that provider.
7. Cancel the appointment, accepting the UI confirmation if shown.
8. It stays visible with cancelled status and an audit trail. Its slot becomes available again if otherwise eligible.
9. Check Notifications: old-version queued jobs should be skipped and the new-version rescheduling/cancellation jobs should be recorded.

Expected: terminal appointments cannot be rescheduled. Rescheduling is available only before the original appointment starts.

### E. Complete an appointment and mark a no-show now

Two past **confirmed** appointments were deliberately imported for each tenant. Use Oak first so no subscription change is needed.

1. Select Oak. Open [completion practice appointment](https://multi-tenant-appointment-booking-sa.vercel.app/dashboard/bookings/44dc03db-29d6-5680-a641-9230218ffb89).
2. It is a Classic haircut on **6 October 2026 at 11:00 IST**, with notes identifying the practice purpose.
3. Click **Mark completed** and confirm. Reload. Expect completed status, an audit event, and an additional **₹500** in completed revenue: initial ₹152,600 becomes ₹153,100.
4. Open [no-show practice appointment](https://multi-tenant-appointment-booking-sa.vercel.app/dashboard/bookings/ad7ef951-2844-50b5-a1ea-81a2631c1e77).
5. It is the 6 October **15:00 IST** practice appointment. Click **Mark no-show** and confirm.
6. Reload Overview and the client's CRM detail. No-show counts/rate change, while completed revenue does not increase for the no-show.
7. Open any genuinely future confirmed booking and confirm that completion/no-show controls are disabled until its end time.

Expected: both transitions can be exercised immediately using ended appointments. Once used, they remain terminal; rerunning the seed does not reset them.

### F. CRM, search, notes, and repeat customers

1. In Oak open **Clients**. Expect 60 initially, plus any new unique customers from your manual bookings.
2. Search `demo.customer001@example.com`, a customer name, or a fictional phone number.
3. Open the client. Inspect booking history, completed spend, visits, no-shows, and private notes.
4. Change the private notes, save, and reload. Confirm the saved text remains.
5. Book again through Oak's public page with that same email. Confirm the customer is reused rather than duplicated within Oak.
6. Switch to Fieldwork and find `demo.customer001@example.com`. It is a separate tenant-owned client row, with different service amounts/history.
7. Confirm dashboard revenue includes only completed appointment prices. Cancelled, pending, confirmed, and no-show appointments contribute no completed revenue.

Expected: customer identity is unique by business + email; notes and history stay in the chosen tenant.

### G. Services, provider eligibility, and archived records

1. In Oak open **Services**. Inspect six records, including the archived service.
2. Add a temporary service named **Manual Demo Service**, duration 30 minutes, price ₹250, active.
3. Open **Providers**, choose a provider, and assign the new service using its service controls.
4. Reload the public page. The new active service should appear, with only eligible providers available for it.
5. Unassign the service from that provider, then reload the public flow. That provider must no longer offer it.
6. Archive the temporary service after checking. Historical bookings remain; the service disappears from new public selections.
7. Check that Oak's archived stylist is absent from the public provider selector.
8. Select the fourth active provider, Noah Fernandes. He initially offers only Classic haircut and Beard design; he should not be eligible for Colour consultation.

Expected: active flags control new bookings. Provider/service assignments control eligibility independently of provider working hours.

### H. Working hours, provider overrides, and time blocks

1. Open **Availability** in Oak. Business hours are Monday–Saturday **09:00–19:00**, Sunday closed.
2. Select **Anika Rao** in **Schedule for**. Her override is **10:00–17:30**. A slot must fit its full service duration inside both the business and provider window.
3. Select **Rohan Malhotra** and inspect Saturday: it is disabled.
4. On Oak's public page choose **9 October 2026**, Maya Kapoor, and Classic haircut. Maya's **13:00–14:00** lunch block must remove overlapping slots.
5. Choose **14 October**, Anika Rao. Her **14:00–16:00** maintenance block must remove overlapping slots.
6. Choose **17 October** with any eligible provider. The whole-business holiday should return no slots.
7. Choose **11 October**, Sunday. It is closed by weekly hours; the seeded morning-leave block on that date does not independently prove leave filtering because the business is already closed.
8. For a clean custom-block check, choose a future open weekday with visible slots, add a block for one provider, reload the public page, and confirm only overlapping slots for that provider disappear.
9. Remove the temporary block and check availability returns unless bookings occupy those times.
10. Modify hours only in a demo workspace. Save and reload. **Use business hours** removes a provider's overrides so it follows the business schedule.

Expected: slots start every 15 minutes, respect the entire appointment duration, and exclude blocks, existing non-cancelled appointments, ineligible/archived providers, past starts, and closed days. These four fixtures use one timezone; other timezones/DST need separate manual setup from the general test list.

### I. Admin role and tenant isolation

1. Use a separate browser profile to sign in with the admin account from `DEMO_ACCESS.local.md`.
2. Expect only Oak in the workspace dropdown.
3. Verify the admin can inspect bookings, clients, services, providers, schedules, notifications, and settings.
4. Open Billing. It should show **Ask the business owner to manage billing**, without owner checkout/cancellation controls.
5. For an optional API-level permission check using that admin's session, an attempted owner billing mutation must return HTTP 403. Do not use a service-role key for this check; it bypasses tenant RLS.
6. Sign in with the dedicated Oak owner in another profile. It should also see only Oak.
7. A copied Fieldwork booking/client URL must not reveal Fieldwork data to the Oak-only account. Changing a tenant header to Fieldwork must be denied.
8. Use your real account for legitimate switching across all four demos. It is intentionally a member of each, so visibility across those demos is not a tenant leak.

Expected: owner can manage billing, admin cannot. Both can manage operational data in their memberships. Scheduling providers and anonymous customers have no staff access.

### J. Billing, access restriction, and restoration

1. With your real account select Horizon. Overview/Bookings should show a subscription attention error. This is expected seed behavior, not missing data.
2. Open Billing: it remains accessible and shows cancelled status.
3. Click **Start monthly subscription**, choose an approved demo payment method, click **Review subscription**, then **Confirm demo payment**. Processing leads to a persistent receipt; return to Billing to inspect the active subscription. The declined demo method exercises failure/retry without a charge.
4. Reload Overview. Horizon's 250 existing appointments and 60 clients become accessible. No card or actual payment is required.
5. Open Horizon's public booking page before/after this change. A published page remains available even with cancelled billing, as specified in this implementation.
6. If you want to restore the cancelled example, use **Cancel subscription** in Horizon and verify the gate returns.
7. Switch to Northstar while still inside its grace period. Access should work while Billing reports past_due. After 9 October 23:00 IST, access should be gated unless you renew.
8. Switch to Fieldwork and inspect its trial; Oak shows active status.

For advanced signed-webhook exercises, use the existing utility from **Backend**, only against a demo UUID, with `BILLING_WEBHOOK_SECRET` matching Render. This changes subscription state:

```powershell
$env:API_URL = 'https://steadly-api.onrender.com/api'
# Example: set Northstar to a past-due period whose three-day grace has expired.
npm run simulate:billing -- d4873689-3433-44ef-a133-5f08ec1b5045 past_due 2026-10-01T17:30:00Z
# Restore a new active simulated period when finished.
npm run simulate:billing -- d4873689-3433-44ef-a133-5f08ec1b5045 active
```

Expected: signature verification, duplicate-event handling, and stale-event handling are implemented, but those mutation cases were not executed by this task. See `docs/TEST_CASES.md` for their manual inputs and expectations.

### K. Notifications, reminder processing, and cron

1. Open Notifications. Inspect the queued, sent, skipped, failed, and simulated delivery history. Seeded failure examples intentionally remain failed after three attempts; they are fictional provider-timeout fixtures.
2. Create a new public demo booking with enabled email/SMS. Its jobs are genuine workflow-generated rows, distinct from imported fixture history.
3. Ensure the deployed Render cron is configured to run `npm run jobs:reminders` from Backend every 15 minutes, with `API_URL=https://steadly-api.onrender.com/api` and the same `CRON_SECRET` as the API service.
4. For a manual processing run, from **Backend**, ensure the local `.env` cron secret matches Render, then run:

   ```powershell
   $env:API_URL = 'https://steadly-api.onrender.com/api'
   npm run jobs:reminders
   ```

5. Reload Notifications. Due jobs should become sent with simulated delivery logs, or skipped when a booking/version/settings state no longer qualifies.
6. Reminders are due 24 hours before the start. A booking less than 24 hours away can have a reminder already due. A far-future reminder correctly remains queued.
7. Cancellation/rescheduling should prevent stale reminder versions from being delivered. A repeated processing run should not redeliver already completed jobs.

The processor is global across the connected project, not restricted to the selected demo workspace. Run it only when you intend to process all due jobs. It was **not invoked** by this task. Notifications remain a database-backed mock; checking an actual inbox/SMS device is not an applicable success criterion.

### L. Settings, pause/resume, and Google sign-in

1. In Oak open Settings. Change its description or a fictional contact value, save, refresh, and check the public page reflects the change.
2. Pause the public page using the business status control. The public page should report unavailable while existing appointments remain in the database.
3. Restore active status after the check.
4. Toggle approval or notification settings only in a demo and make a new booking to inspect the changed behavior. Restore the original values if you want to preserve the baseline examples.
5. The deployed login page already displays **Continue with Google**. Check the signup page too.
6. Google completion needs a real Google account plus the provider configuration, allowed callback, and redirect URLs in Supabase. Follow the Google section of `SETUP_AND_DEPLOYMENT.md`.
7. Completing Google sign-in is a separate manual check. Google cannot authenticate the fictional demo emails. Use your existing linked real Google account if it is configured; another email may create a separate Supabase user without these demo memberships.

## 5. Verify the saved data directly in Supabase

Use Table Editor with a **business_id filter**, or run these read-only SQL queries in SQL Editor. They do not perform workflow actions.

```sql
select id, name, slug, timezone
from public.businesses
where slug in ('demo-oak-form','demo-fieldwork','demo-northstar','demo-horizon')
order by slug;

select b.slug, a.status, count(*) as appointment_count
from public.bookings a
join public.businesses b on b.id = a.business_id
where b.slug in ('demo-oak-form','demo-fieldwork','demo-northstar','demo-horizon')
group by b.slug, a.status
order by b.slug, a.status;

select b.slug, count(c.id) as client_count
from public.businesses b
left join public.clients c on c.business_id = b.id
where b.slug in ('demo-oak-form','demo-fieldwork','demo-northstar','demo-horizon')
group by b.slug
order by b.slug;

select b.slug, s.status, s.current_period_end
from public.subscriptions s
join public.businesses b on b.id = s.business_id
where b.slug in ('demo-oak-form','demo-fieldwork','demo-northstar','demo-horizon')
order by b.slug;
```

The initial counts above will increase or change after your manual workflow exercises. Supabase SQL Editor/service-role access is administrative access; use dedicated role accounts to assess application isolation.

## 6. Completion and limits of verification

| Deliverable                                    |  Completion | Evidence / remaining action                                                                                    |
| ---------------------------------------------- | ----------: | -------------------------------------------------------------------------------------------------------------- |
| Four isolated demo workspaces in live Supabase |        100% | All four persisted; your existing account has membership in each                                               |
| Rich sample dataset                            |        100% | 1,000 bookings, 240 clients, related configuration/audit/notification/billing fixtures counted from Supabase   |
| Local reusable seed utility                    |        100% | `npm run seed:rich` completed; repeat run skipped existing core fixtures and added the practice extension once |
| Step-by-step manual workflow guide             |        100% | This document, plus the existing detailed `docs/TEST_CASES.md`                                                 |
| Local URL handling fixes                       |        100% | Frontend production build and backend syntax checks passed                                                     |
| Production URL configuration correction        |     Pending | You must save the two exact values and redeploy in section 1                                                   |
| All manual workflow cases passed               | Not claimed | Workflow mutations/cron/payment/Google completion were not executed                                            |

Read-only deployment inspection confirmed:

- Dedicated demo email credentials authenticate with Supabase.
- `/api/me`, dashboard, services, providers, assignments, schedules, bookings, CRM, notification queues/logs, and billing returned HTTP 200 for Oak, Fieldwork, and Northstar during its grace period.
- Horizon billing and membership reads worked; its gated dashboard endpoints correctly returned HTTP 402.
- Public metadata returned five active services and four active providers for each demo. Availability returned slots on 8 October and zero slots on the 17 October holiday.
- A dedicated owner reading another demo's clients through its own JWT and database RLS received zero rows.
- The existing account has its original workspace plus four demo memberships. The operational admin has only Oak membership and admin role.
- Browser inspection found the CORS/API-base deployment mistakes. Therefore production dashboard rendering is **not** marked working until section 1 is completed.

The initial completed revenue fixtures are Oak **₹152,600**, Fieldwork **₹454,400**, Northstar **₹201,300**, and Horizon **₹373,000**. All use INR for service amounts; the platform subscription remains a separate simulated $19 USD monthly plan.

## 7. Reuse the seed safely

From **Backend**:

```powershell
npm run seed:rich
```

It uses your existing backend Supabase configuration, creates only the named demo workspaces, and never runs on startup. Keep `Backend/.env.demo` and `Backend/.demo-seed-manifest.json` so it can reuse passwords, anchor dates, and completed-workspace markers. They and `DEMO_ACCESS.local.md` are Git-ignored.

A completed seed preserves later edits: it does not reset manually completed bookings, notes, schedules, or subscription changes, and it does not refresh dates indefinitely. Stable IDs/unique constraints also avoid inserting duplicate fixture rows when resuming a partial seed. The local manifest records the originally seeded counts, not a continuously updated live inventory.

If multiple real business owners exist in a future environment, specify `DEMO_ATTACH_OWNER_ID` explicitly. Automatic owner selection intentionally requires exactly one non-demo owner. Do not run this seed against another project without first deciding which account should receive demo memberships.

Do not delete the local credential file and rerun expecting it to reset existing Auth passwords. Existing demo users are reused. If you lose access details, reset only the relevant demo account password in Supabase and update the local `.env.demo` value.

## 8. Short troubleshooting checklist

| Symptom                                       | Action                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Failed to fetch after login                   | Fix Render APP_URL and Vercel VITE_API_URL, redeploy both as necessary, hard-refresh                           |
| /me gives 404                                 | The frontend API base is missing `/api`; inspect the actual request URL                                        |
| Demo names missing from your dropdown         | Reload/sign in again with the existing TechyDose Hub owner account; confirm `/api/me` returns five memberships |
| Horizon asks for billing                      | Expected cancelled-subscription scenario; activate its simulated subscription or switch workspace              |
| Northstar access stops later                  | Its three-day grace expired; renew its demo subscription                                                       |
| No slots today                                | Today's business hours may have ended; choose a future open day                                                |
| No slots on 17 October                        | Expected seeded holiday                                                                                        |
| Service/provider missing publicly             | Check active status and service eligibility assignments                                                        |
| Completion/no-show disabled                   | Use the two past confirmed practice appointments, or wait until a new appointment ends                         |
| Notifications stay queued                     | Future jobs are not due, or the cron is missing/not configured; inspect cron logs and matching secret          |
| Reminder run returns 401                      | Local/cron CRON_SECRET does not match the deployed Render service                                              |
| Google signup creates an empty workspace list | It is a different Supabase user/email; demo memberships belong to the original account                         |
| PGRST205/PGRST202/503 schema message          | Follow the existing database recovery section; do not recreate populated tables blindly                        |

For the complete first-time GitHub/Render/Vercel/Auth setup, use **`SETUP_AND_DEPLOYMENT.md`**. For exhaustive negative/boundary cases beyond this demo tour, use **`docs/TEST_CASES.md`**.
