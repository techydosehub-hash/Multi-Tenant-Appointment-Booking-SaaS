# Private demo: deployment and presentation guide

Implemented locally on 8 October 2026. This guide describes the new visitor demo, not the older four shared sample workspaces. The public Vercel and Render deployments only receive these changes after you push and redeploy.

## 1. What the visitor sees

1. The demo is available only after signing in or creating an account. Nothing demo-related appears on the landing, login or signup pages. On the dashboard, the first visit offers **Start demo & walkthrough**. **Maybe later** dismisses the suggestion. The **Try demo** button remains available at the bottom-right of every dashboard screen.
2. Start from your signed-in account. Preparation can take several seconds while fictional data is saved to Supabase. Do not close the tab while preparing.
3. Every account receives its own private `[DEMO] Your Studio` workspace. Accounts reuse their own private demo; they never sign into a shared demo account. Unauthenticated guest demo creation was removed: `POST /demo/guest` returns 403 and legacy guest identities are rejected by `POST /demo/start`.
4. Follow the 12-step walkthrough. Each step opens a real page, explains its purpose, and suggests an action. Back/Next navigate the tour; the close button finishes early. You can use the page while the walkthrough is visible.
5. At the end, a message explains **Reset demo**. Keep exploring, replay the **Walkthrough**, or reset at any time using the controls at the bottom of the screen.
6. Reset hides the sample workspace. Existing users return to their previous accessible real workspace, or onboarding if they have none. Reset does not delete real records and does not erase the private demo's edits.

The suggestion is remembered separately for each account. It does not open on normal public customer booking pages, OAuth callbacks, or password-reset pages, and it never appears before sign-in. Refreshing an active demo retains its data and session. Any legacy guest session created before this change can still reset out of its demo (and is then signed out to signup), but no new guest demo can be started.

## 2. Data saved for each new demo

| Example | Count / behavior |
| --- | --- |
| Business | 1 private tenant with INR pricing and Asia/Kolkata timezone |
| Providers | 4 fictional team members |
| Services | 6, including 1 archived example |
| Service assignments | 20 active provider/service assignments |
| Clients | 40 fictional clients using example.com emails |
| Appointments | 184 across 12 preceding days, today, and 10 following days |
| Status examples | Pending, confirmed, cancelled, completed, no-show |
| Scheduling | 7 business-hour rows, 28 provider-hour rows, 1 provider break |
| Booking history | 184 creation events |
| Notifications | 184 sample confirmations and 184 simulated delivery logs |
| Subscription | Active simulated subscription, initially valid for a year |
| Billing | 1 completed sample checkout and 1 simulated billing event |
| Profile | Fictional profile, saved separately from actual Auth profile fields |

Appointment dates are anchored to the demo's creation date. Reopening preserves edits and original dates instead of silently moving bookings or reseeding. For a fresh presentation months later, use a different signed-in account. Actual payments and booking notifications remain simulated, as before.

## 3. How tenancy and reset work

- The server verifies signed-in users with Supabase Auth. It derives demo ownership from the verified user ID, never from a client-supplied owner ID.
- Each demo has its own business, member, client, provider, service, booking and billing IDs. RLS protects ordinary operations exactly as it protects real tenants.
- Provisioning uses the backend service-role key, which remains in Render's server environment. Only fictional locally defined fixtures are inserted; no existing client data is cloned.
- Supabase **app_metadata** stores the demo ID, active state, previous real workspace and fictional profile. Users cannot edit app_metadata through the normal Auth profile API. Editable user_metadata does not control ownership or permissions.
- `/me` exposes only the private demo while active, and hides that membership while inactive. The four old shared demo workspaces remain in the database but their shared owner grants no longer clutter the primary account's normal workspace dropdown. Dedicated original fixture owners and the admin retain their original sample access for role demonstrations.
- During demo mode the API rejects requests targeting real workspaces, including financial changes. Profile edits affect only the fictional demo profile. Password-reset controls are disabled in demo mode.
- Reset changes the active flag and restores the previous accessible workspace; it does not perform destructive database operations. Sample records remain stored for signed-in users to reopen.
- Provisioning retries use deterministic IDs and insert missing records without overwriting edits. A per-user in-process lock coalesces simultaneous start requests. The demo becomes active only after seeding completes. Database unique constraints protect IDs across backend instances; a partial seed resumes on the next start.
- The public booking page is intentionally public, just like a real business page. Someone with its unique link can create a booking there, but cannot read private client records or management screens.

## 4. Release these changes

1. Review the changed source files and this guide. Keep `.env`, `.env.demo`, local manifests and private access documents out of Git.
2. In **Supabase → SQL Editor**, apply `Backend/supabase/migrations/002_booking_conflict.sql` if you have not already applied it. Do not rerun `001_initial.sql` on the existing database.
3. Apply **`Backend/supabase/migrations/003_private_demo_allowance.sql`**. This prevents guest accounts from directly creating real workspaces through the SQL RPC and excludes a private demo from a normal user's five-business allowance. It replaces one function and preserves existing records, grants and RLS. No new table is required by this demo feature.
4. Ensure Supabase Email/password sign-in is enabled. The app already uses it for normal login; the demo requires it, because unauthenticated guest provisioning was removed. `POST /api/demo/guest` returns 403 and `POST /api/demo/start` rejects legacy guest identities.
5. In Render, retain `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep `APP_URL` set to your exact frontend origin: `https://multi-tenant-appointment-booking-sa.vercel.app`. Keep the existing job and billing secrets configured. Do not put the service-role key in any Vercel `VITE_` variable.
6. In Vercel, retain the public Supabase URL/anon key and set `VITE_API_URL=https://steadly-api.onrender.com/api`. Frontend root remains `Frontend`; build command `npm run build`; output directory `dist`. Render root remains `Backend`; install `npm ci`; start `npm start`.
7. From the project root, inspect `git status` and `git diff`. Stage the feature explicitly:

   ```powershell
   git add Backend/src/app.js Backend/src/demo.js Backend/supabase/migrations/003_private_demo_allowance.sql Frontend/src/context.jsx Frontend/src/main.jsx Frontend/src/DemoExperience.jsx Frontend/src/pages/Profile.jsx Frontend/src/pages/Public.jsx Frontend/src/styles.css docs/PRIVATE_DEMO_GUIDE.md docs/API.md README.md
   git commit -m "Add isolated visitor demos and guided walkthrough"
   git push
   ```

8. Wait for Render to finish deploying the backend, then deploy the same commit on Vercel. If either is not configured to deploy automatically, use its dashboard's manual deploy/redeploy action. The frontend and backend must both be updated; the old backend has no demo endpoints.
9. Open the public site in an incognito window. Start the demo and check that sample records appear. If creation fails, inspect Render's request error log with the displayed request reference. Confirm Email sign-in, service-role environment values, database migrations and exact CORS origin.
10. Also sign in with your existing account, start its demo, then Reset. Confirm that your actual business reappears and its records are unchanged.

## 5. Step-by-step presentation

1. Open the deployed site, sign in (or create an account), open the dashboard and choose **Start demo & walkthrough**.
2. Show Overview totals and today's sample appointments. Explain completed revenue is based on completed appointments, not the mock subscription receipt.
3. Show day/week/month Calendar and a provider filter.
4. In Bookings, filter by status, provider and date. Open a future confirmed booking, reschedule to a free slot, then cancel it. Open a pending booking and confirm it. Completed/no-show transitions require an appointment to have ended.
5. Open a client. Review linked history and completed spend; save a fictional note.
6. Add a sample service, give it a duration and price, and assign it to a provider. The archived service is excluded from public choices.
7. Review business/provider hours and a blocked period. Add a break and compare public slots for that provider and date.
8. Show the simulated notification history. New booking/reminder jobs follow the existing mock notification workflow and require the reminder job runner to process queued jobs.
9. In Settings, demonstrate timezone search and approval mode. Changing timezone changes the business's interpretation of scheduling hours; appointment timestamps stay stored in UTC.
10. In Billing, open checkout, choose the declined method, retry with an approved method, and download the simulated receipt. No card details or money are involved. Cancelling the subscription intentionally gates operations; complete a checkout to restore them.
11. In Profile, edit the sample name. Explain owner/admin permissions come from business membership, not editable profile text. This visitor demo runs as owner; admin permissions can be demonstrated separately using the existing admin demo account after starting/exiting its own demo as appropriate.
12. Open the public booking page through the final walkthrough step. Select an active service/provider/free slot, enter fictional example.com contact details and submit. Return to Bookings/Clients to show the persisted record. If approval is enabled, confirm the pending request.
13. Finish the tour, show the reset explanation, then click **Reset demo**. Signed-in users return to their own workspace. Explain the sample data is hidden rather than deleted.

## 6. Verification and operational limits

The frontend production build and backend JavaScript syntax checks passed. Local browser/API checks passed for the signed-in demo flow: all 12 tour steps and completion message, 40 persisted clients/184 appointments after refresh, cross-tenant API denial, direct RLS returning no foreign client rows, mobile overflow check, and Reset back to the real workspace. Earlier checks also covered the since-removed guest flow (signup-free creation, distinct guest tenants, guest Reset/logout); `POST /demo/guest` now returns 403 and legacy guest identities are rejected by `POST /demo/start`.

Automatic approval review blocked additional checks that signed into a stored demo account, without supplying a detailed reason. Signed-in original-workspace restoration and real-profile preservation are implemented but that additional live check was not completed. Perform step 10 of the release instructions and the Profile/Reset checks below yourself. Migration `003` is prepared but not applied remotely by this work. These local results do not prove that the deployed site has the new commit; repeat the release checks after deploying. See the existing `PDF_REQUIREMENTS_AUDIT.md` for the original project requirements and unrelated remaining limitations.

Guest creation was removed entirely: `POST /api/demo/guest` returns 403 without creating anything, so there is no guest creation rate to manage. Signed-in users reuse their private demo from the dashboard.

Any guest Auth identities created before this change and their fictional records are retained after Reset; there is no scheduled guest cleanup or automatic conversion into real accounts in this implementation. Monitor Supabase Auth/database usage. Before high-volume public promotion, add a tenant-scoped retention cleanup job, distributed rate limits and bot protection. Cleanup must delete only verified guest demo tenants and their dependent rows, never real account data. This is a remaining operational enhancement, not something Reset currently does.

The SQL allowance patch must be applied in Supabase manually. Local source changes and checks cannot confirm that patch or either hosting deployment has been released.
