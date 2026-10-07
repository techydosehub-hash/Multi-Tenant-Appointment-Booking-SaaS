# Detailed test-case list — not executed

**Execution status for every case below: NOT RUN.** No executable tests were created, no browser workflow was exercised, and no requests were made to the live Supabase project during implementation. This is a plan for future verification, as explicitly requested.

## Preparation for a later test run

Use an isolated Supabase project with the migration applied. Create Owner A / Business A and Owner B / Business B with different Auth user IDs. Configure Business A in `Asia/Kolkata`, one 30-minute and one 90-minute service, and two active assigned providers. Configure Business B independently. Keep fresh bearer tokens for each owner and the anon key available for direct RLS checks. Use only disposable client details.

For DST cases, create an additional business in `America/New_York`, enable the relevant Sunday, and use a date inside the 90-day horizon or a controlled test clock in a future test harness. Do not alter a production clock or database to exercise these cases.

Suggested future layers: UI/E2E for user journeys, API integration for authorization and error contracts, database integration for RLS/transactions/concurrency, and unit tests for pure validation/signature logic. No testing framework is installed or implied by this document.

## A. Authentication and onboarding

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| AUTH-01 | P0 / E2E | Register a new valid email/password; confirm email; sign in | Session established; onboarding opens |
| AUTH-02 | P0 / E2E | Sign in with an incorrect password | Clear error; no dashboard access |
| AUTH-03 | P1 / E2E | With email confirmation enabled, register but do not confirm | Check-email message; no tenant created without a session |
| AUTH-04 | P0 / API | Call a private endpoint without a bearer token | 401 JSON error with correlation ID |
| AUTH-05 | P0 / API | Send malformed, expired, or revoked bearer token | 401; no private rows returned |
| AUTH-06 | P1 / E2E | Refresh a signed-in dashboard route | Session restored and membership reloaded |
| AUTH-07 | P1 / E2E | Sign out, then open a private route | Redirect to login; old workspace data not rendered |
| AUTH-08 | P1 / E2E | Request password reset; follow link; save new password | Supabase recovery flow updates password; new credentials work |
| AUTH-09 | P0 / DB | Create a business with a valid signed-in user | Business, owner membership, trial, and seven hours rows created atomically |
| AUTH-10 | P1 / API | Create a duplicate slug or invalid slug | 409 for duplicate; 400 for invalid syntax; no orphan membership/trial |
| AUTH-11 | P1 / API | Supply an invalid IANA timezone | Rejected with 400; no tenant created |
| AUTH-12 | P1 / E2E | Create a second business using Add another business | New workspace selected; switcher lists both memberships |
| AUTH-13 | P1 / DB | Attempt a sixth business for one account | Quota error; no partial business |
| AUTH-14 | P0 / DB | Try supplying a different owner ID or mutating owner_user_id via Data API | Rejected; owner derives from auth.uid() |

## B. Tenant isolation and permissions

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| RLS-01 | P0 / API | Owner A requests clients with Business B in X-Business-Id | 403; no B data |
| RLS-02 | P0 / DB | Using A's JWT and Supabase Data API, select B's clients/bookings | No unauthorized rows |
| RLS-03 | P0 / DB | Using A's JWT, insert/update/delete B's services, hours, or blocks | RLS rejects or affects zero rows |
| RLS-04 | P0 / DB | Query child events, reminder jobs, logs, or mappings belonging to B | No unauthorized child records |
| RLS-05 | P0 / DB | A creates a provider-service mapping using B's provider/service ID | Composite tenant FK / RLS rejects |
| RLS-06 | P0 / API | A attempts to reschedule or change B's booking using A's tenant header | Not found/denied; B booking unchanged |
| RLS-07 | P0 / DB | Anonymous client selects clients, memberships, bookings, subscriptions, or logs directly | Access denied; no private data |
| RLS-08 | P0 / DB | Anonymous or authenticated browser calls trusted create_booking/change_booking/job/billing RPC | Function execution denied |
| RLS-09 | P0 / DB | A inserts/updates membership role or user_id directly | Denied; no privilege escalation |
| RLS-10 | P0 / DB | A edits subscription status/current_period_end directly | Write denied |
| RLS-11 | P0 / DB | A mutates booking price/status/version or booking_events directly | Write denied |
| RLS-12 | P1 / DB | User who owns A and B tries moving existing configuration from A to B | Immutable tenant trigger rejects movement |
| RLS-13 | P0 / API | Inspect public profile, service, availability, and booking response fields | No internal notes, contacts of other clients, occupancy IDs, subscription details, or private block reasons |
| RLS-14 | P1 / E2E | Switch from A to B while A's request is in flight | Old response ignored; B workspace displays only B records |
| RLS-15 | P0 / DB | A edits only an own client note, then tries altering its business_id/email | Note succeeds when subscribed; protected columns denied |
| RLS-16 | P1 / API | Provision admin membership and attempt billing mutations | Operational access allowed; owner-only billing mutation denied |

## C. Service, provider, and schedule configuration

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| CFG-01 | P0 / E2E | Add/edit a service with valid price and duration | Saved values visible; price displayed in correct currency |
| CFG-02 | P1 / API | Submit duration 0, 481, fractional duration, negative price, or fractional minor units | 400; invalid record not stored |
| CFG-03 | P1 / E2E | Deactivate a service with existing appointments | Service disappears publicly; historical appointments remain |
| CFG-04 | P0 / E2E | Add provider and assign service | Provider becomes eligible for that service |
| CFG-05 | P0 / API | Request slots before assigning a service to any provider | Empty slots, no invented resource |
| CFG-06 | P1 / E2E | Remove provider capability or deactivate provider | New slots disappear; existing appointments retained |
| CFG-07 | P0 / E2E | Save all seven business days, disable Sunday | Sunday has no slots; other enabled days respect window |
| CFG-08 | P1 / API | Send duplicate/missing weekdays or invalid 09:99 time | 400; seven-row update not partially applied |
| CFG-09 | P1 / API | Set end before or equal to start | Rejected, including disabled rows |
| CFG-10 | P0 / E2E | Provider window is narrower than business hours | Available interval equals intersection |
| CFG-11 | P0 / E2E | Provider window is wider than business hours | Cannot book outside business window |
| CFG-12 | P1 / E2E | Disable a provider day, then reset overrides | Disabled day has no slots; reset falls back to business hours |
| CFG-13 | P0 / E2E | Add business-wide and provider-only blocks | All/provider-specific overlapping slots disappear respectively |
| CFG-14 | P1 / E2E | Remove a block | Otherwise eligible slots return |
| CFG-15 | P1 / E2E | Pause business profile | Public page unavailable; private history retained |
| CFG-16 | P1 / API | Change currency after first booking | Rejected; historical values retain currency meaning |

## D. Availability engine

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| SLOT-01 | P0 / DB | 09:00–17:00 hours, 30-minute service, no conflicts | Starts on quarter hours; final start at 16:30 |
| SLOT-02 | P0 / DB | Same hours with 90-minute service | No start later than 15:30; entire 90 minutes protected |
| SLOT-03 | P0 / DB | Existing 10:00–10:30 booking; request adjacent slots | 09:30–10:00 and 10:30–11:00 permitted; intersecting slots excluded |
| SLOT-04 | P0 / DB | Block 10:10–10:20 | Any duration intersecting block rejected, even if start is earlier |
| SLOT-05 | P0 / DB | Existing pending booking | Time excluded just like confirmed booking |
| SLOT-06 | P0 / DB | Cancel existing booking | Slot becomes available if still future and otherwise eligible |
| SLOT-07 | P0 / DB | Book provider A; inspect provider B at same time | B remains available if capable and working |
| SLOT-08 | P1 / API | Ask for yesterday, a past time today, or beyond 90 days | No bookable past/out-of-horizon slots |
| SLOT-09 | P1 / E2E | Browser timezone differs from business timezone | Display and requested date consistently use business timezone |
| SLOT-10 | P0 / DB | Enable spring-forward local hours around missing times | Nonexistent wall-clock starts absent; full duration stays in valid working hours |
| SLOT-11 | P0 / DB | Enable fall-back repeated local hour | Distinct UTC timestamps returned; UI shows distinguishing offsets |
| SLOT-12 | P1 / DB | Service spans DST offset transition | Actual elapsed duration correct; all elapsed minutes satisfy local hours |
| SLOT-13 | P1 / API | Malformed UUID or impossible date string | 400; no database internals exposed |
| SLOT-14 | P1 / DB | No provider-hours row for a weekday | Business hours used; missing override does not imply closure |

## E. Booking lifecycle and concurrency

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| BOOK-01 | P0 / E2E | Complete service → date/time → details → submit | Booking reference, timestamp, status, price and provider shown |
| BOOK-02 | P0 / DB | Create booking with approval enabled | Pending row, CRM client, audit event, confirmation/reminder jobs committed |
| BOOK-03 | P0 / DB | Create booking with approval disabled | Confirmed row and associated records committed |
| BOOK-04 | P0 / API | Manipulate submitted price/status/ends_at/business_id | Strict schema rejects extra fields; derived values cannot be overridden |
| BOOK-05 | P0 / API | Send same request key and identical body twice | Same booking returned; no duplicate client/job/event |
| BOOK-06 | P0 / API | Reuse request key with different contact/time payload | Domain error; no second appointment |
| BOOK-07 | P0 / concurrency | Submit two distinct keys simultaneously for same provider/time | At most one appointment succeeds; loser receives 409 |
| BOOK-08 | P0 / concurrency | Simultaneously submit partially overlapping 90-minute appointments | At most one overlapping appointment commits |
| BOOK-09 | P0 / concurrency | Create a block or disable hours while booking same period | Tenant lock serializes operations; a booking committing after changed configuration respects it |
| BOOK-10 | P0 / DB | Force booking insert failure after client upsert | Entire function transaction rolls back; no partial customer/job/event changes |
| BOOK-11 | P0 / E2E | Confirm pending appointment | Confirmed, version incremented, event recorded, jobs updated |
| BOOK-12 | P0 / E2E | Cancel future appointment | Cancelled, slot released, queued obsolete jobs skipped, cancellation job queued |
| BOOK-13 | P0 / E2E | Reschedule to valid same-provider time | Old slot released only after new time commits; audit records old/new time |
| BOOK-14 | P0 / E2E | Reschedule to another capable provider | New resource and time reserved; prior resource released |
| BOOK-15 | P0 / API | Reschedule into occupied/blocked time | 409; original appointment unchanged |
| BOOK-16 | P0 / concurrency | Two admins update same displayed booking version | First commits; second gets stale-version 409 |
| BOOK-17 | P0 / API | Complete/no-show before appointment end | Rejected; status unchanged |
| BOOK-18 | P0 / E2E | After end, mark confirmed appointment completed or no-show | Terminal state stored, metrics updated, audit appended |
| BOOK-19 | P0 / API | Reopen/reschedule a terminal booking or skip pending directly to completed | Invalid transition rejected |
| BOOK-20 | P1 / API | Reschedule appointment whose original start is already past | Rejected |
| BOOK-21 | P1 / DB | Change service duration/price after booking, then reschedule | Existing snapshot initially unchanged; reschedule uses current duration and original booking price |
| BOOK-22 | P1 / E2E | Simulate network failure after successful commit and retry unchanged form | Same request key returns prior booking, not a conflict/new row |

## F. Calendar, CRM, and metrics

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| CRM-01 | P0 / E2E | Book twice with mixed-case forms of one email in same tenant | One client record; both bookings in history |
| CRM-02 | P0 / DB | Same email books in tenants A and B | Separate client records, histories, and notes |
| CRM-03 | P1 / E2E | Search full/partial name, email, phone | Matching tenant clients only; empty state for none |
| CRM-04 | P0 / E2E | Save internal note; make another public booking with a message | Note preserved; public message stored only on appointment |
| CRM-05 | P0 / DB | Client has completed 10000 + 20000, cancelled 50000, no-show 30000 | Lifetime value 30000 minor units |
| CRM-06 | P1 / DB | Completed past visits and multiple future pending/confirmed visits | Latest completed and nearest active future timestamps correct |
| CRM-07 | P1 / DB | No eligible last/next visit | Null returned and em dash displayed |
| CRM-08 | P1 / E2E | Create more than 25 client/booking rows | Pagination stable; counts accurate; no unbounded browser history load |
| CAL-01 | P0 / E2E | Switch day/week/month; navigate periods and pick provider | Correct bounded range and provider filter, business-local grouping |
| CAL-02 | P1 / E2E | Calendar period contains more than 100 appointments | Pagination and explanatory notice show; all pages accessible |
| CAL-03 | P1 / E2E | Click appointment in every calendar view | Correct detail page and actions |
| CAL-04 | P1 / DB | Appointment starts near UTC/local midnight | Counted/grouped on correct business-local day |
| METRIC-01 | P0 / DB | Compare overview with known status/price fixture | Defined today, seven-day active, completed revenue, client count formulas match |
| METRIC-02 | P1 / DB | 3 completed, 1 no-show, other pending/cancelled rows | No-show rate 25%; zero when completed+no-show count is zero |

## G. Reminder jobs and notification failures

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| JOB-01 | P0 / API | Invoke job without/wrong bearer secret | 401; no claims or deliveries |
| JOB-02 | P0 / DB | Book more than 24 hours ahead with email enabled | Confirmation due now; reminder scheduled start minus 24h |
| JOB-03 | P1 / DB | Book less than 24 hours ahead | Reminder due immediately; no reminder after start |
| JOB-04 | P0 / integration | Run scheduler twice for same eligible jobs | One simulated delivery per job; sent jobs not reclaimed |
| JOB-05 | P0 / concurrency | Run two workers simultaneously | Disjoint active claims; no duplicate mock logs |
| JOB-06 | P0 / concurrency | Cancel/reschedule after claim and before delivery | Stale version skipped; old reminder not logged as delivered |
| JOB-07 | P1 / integration | Disable notification channel after enqueue | Delivery recheck skips that channel |
| JOB-08 | P0 / integration | Inject adapter failure in a future test harness | Failed attempt logged; booking unchanged; next due time delayed five minutes |
| JOB-09 | P1 / integration | Repeat failures three times | Retry count bounded; job remains failed, no fourth claim |
| JOB-10 | P1 / integration | Stop a worker after claim; allow lease to expire | Another worker reclaims with new token; old token cannot finalize |
| JOB-11 | P1 / DB | More than 50 jobs due | Exactly bounded batch claimed; remaining jobs retained |
| JOB-12 | P1 / E2E | Inspect Notifications jobs and attempts tabs | Mock delivery clearly labelled; status/time/error fields visible, pagination works |

## H. Billing, signature verification, and gating

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| BILL-01 | P0 / DB | New tenant created | Trialing state with 14-day period and simulated customer ID |
| BILL-02 | P0 / E2E | Owner starts and confirms simulation | Active month; no payment/card collection |
| BILL-03 | P0 / API | Repeat completion for same session | No additional extension or duplicate activation event |
| BILL-04 | P0 / API | Complete missing, expired, or another tenant's session | Rejected; no subscription mutation |
| BILL-05 | P0 / API | Active/trialing period expired; call premium endpoint | 402; billing endpoint remains available |
| BILL-06 | P0 / API | Past due within and after three-day grace period | Access allowed within grace; denied after |
| BILL-07 | P0 / E2E | Cancel subscription, then open premium screen | Immediate access restriction with link to Billing |
| BILL-08 | P1 / API | Cancelled tenant's published public page receives booking | Public booking remains enabled by documented policy |
| BILL-09 | P0 / API | Send missing/bad webhook signature or changed raw body | 401; no event or subscription changes |
| BILL-10 | P0 / API | Valid signature with timestamp older than five minutes | 401 |
| BILL-11 | P0 / API | Replay valid signed event ID | `duplicate`; no repeated state change |
| BILL-12 | P0 / API | Deliver an older event after a newer one | Event trace retained; latest state not overwritten |
| BILL-13 | P1 / API | Invalid status/body/UUID with valid signature | 400; transaction does not change subscription |
| BILL-14 | P1 / DB | Expired tenant directly writes configuration with own JWT | Subscription-aware write RLS denies; own-data reads still tenant-scoped |

## I. UI, errors, and deployment

| ID | Priority / layer | Steps | Expected result |
|---|---|---|---|
| UX-01 | P1 / E2E | Visit all public and dashboard routes at 375px, 768px, 1440px | Usable layout, scrolling tables, readable forms; no inaccessible controls |
| UX-02 | P1 / E2E | Keyboard-navigate forms, service choices, slots, dialogs | Visible focus; labels present; dialog focus cycles inside; Escape closes |
| UX-03 | P1 / E2E | Slow network, empty dataset, validation failure, backend unavailable | Distinct loading/empty/error states; no false success notification |
| UX-04 | P1 / E2E | Double-click mutation buttons | Submission disabled while pending; booking idempotency remains authoritative |
| UX-05 | P0 / E2E | Submit HTML/script strings in allowed text fields | Rendered as text; no script execution |
| UX-06 | P1 / E2E | Service/provider edit and destructive action | Saved state confirmed; cancel/no-show/completion require second click |
| API-01 | P1 / API | Exceed read and booking rate limits | 429 and useful JSON message |
| API-02 | P1 / API | Submit body above 32 KB | Request rejected; no mutation |
| API-03 | P1 / API | Trigger expected and unexpected errors | Correct status, consistent envelope, request ID, no SQL stack trace |
| API-04 | P1 / inspection | Inspect logs after normal/error calls | No auth token, webhook secret, service-role key, or unnecessary contact data |
| DEPLOY-01 | P0 / build | Install with npm ci and build frontend from clean checkout | Production assets compile with documented Node version |
| DEPLOY-02 | P0 / deployment | Apply migration to a fresh project | All tables/functions/policies created without errors |
| DEPLOY-03 | P0 / deployment | Configure both Vercel projects and open a nested route directly | SPA fallback and API rewrites work |
| DEPLOY-04 | P0 / inspection | Inspect frontend output and served network configuration | Only public Supabase key present; no server/job/webhook secret |
| DEPLOY-05 | P1 / deployment | Run configured cron invocation | Correct authorization header; due jobs processed; unauthenticated endpoint stays protected |
| DEPLOY-06 | P1 / deployment | Test production Auth confirmation/recovery redirects | Return to correct production frontend routes |

## Recording future results

When a test run is separately authorized, record environment, migration version, input fixture, actual output, timestamp, pass/fail, and evidence for each case. Concurrency and tenant-isolation cases require database-backed evidence; screenshots and a successful frontend build alone do not prove them. Do not mark cases passed based only on reading their implementation.
