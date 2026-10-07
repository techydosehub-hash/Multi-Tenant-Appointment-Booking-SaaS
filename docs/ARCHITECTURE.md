# Architecture, security decisions, and trade-offs

## Tenant boundary

Personal account profiles live in Supabase Auth metadata and are exposed through authenticated `/profile` routes before tenant subscription gating. The server whitelists editable fields and updates only the JWT-verified user ID. Metadata is presentation data; authorization continues to derive solely from protected membership rows. Personal timezone preferences are independent of business scheduling timezones.

All tenant tables include `business_id`, including child records. Membership derives from `auth.uid()` through a fixed-search-path, security-definer helper. The helper reads the protected membership table without recursive RLS evaluation. Browser roles cannot mutate memberships or ownership.

Private HTTP routes validate a Supabase access token with `auth.getUser()`, verify the requested `X-Business-Id` membership, then make normal reads/writes using that token. RLS independently enforces membership. Composite foreign keys ensure a booking/client/service/provider relation cannot point into another tenant, even when both IDs exist.

Browser roles have read-only access to bookings, audit events, subscriptions, billing events/sessions, reminder jobs, and delivery logs. Sensitive mutations go through trusted server RPCs. Service-role functions are explicitly revoked from `PUBLIC`, `anon`, and `authenticated`. Function search paths are fixed. CRM write privileges are limited to the notes column. Business update privileges exclude ownership/ID/creation columns.

Private SELECT RLS enforces tenant membership regardless of subscription; this retains tenant data ownership. Premium HTTP endpoints and configuration-write RLS additionally enforce subscription access. This is feature gating, not revocation of a tenant's ability to read its own data through Supabase's Data API.

Public endpoints use a server-only client because they need to combine private scheduling occupancy with safe public projections. They resolve the slug first, constrain every query to that business, expose only active configuration and generated slots, and never return private client records, blocked-period reasons, notes, subscriptions, or booking lists.

## Schema and integrity

- `businesses`, `business_members`: tenant profiles and owner/admin identity mappings.
- `services`, `providers`, `provider_services`: offering and resource capability mappings.
- `business_hours`, `provider_hours`, `blocked_periods`: local recurring schedules and absolute exceptions.
- `clients`, `bookings`, `booking_events`: tenant-local CRM, appointment snapshots, and immutable audit records.
- `subscriptions`, `billing_sessions`, `billing_events`: simulated provider identifiers, checkout sessions, replay protection, and access state.
- `reminders`, `notification_logs`: outbox jobs, retries/leases, and delivery audit.

Prices are integer minor units, with two-decimal currencies restricted to INR/USD/EUR/GBP. Booking creation snapshots the service price and duration-derived end time. Later service edits do not rewrite prior appointment values. Rescheduling deliberately uses the service's **current duration**, retaining the booking's original price. Currency changes are prohibited after bookings exist.

Emails normalize to lower-case trimmed strings and are unique per tenant. Phone formatting removes common separators and validates 7–15 digits with an optional leading `+`. Email is the authoritative deduplication key; phone-only merging is deliberately avoided because households can share phone numbers. A client-supplied booking message never overwrites internal CRM notes.

## Availability and concurrency

The API rejects explicitly stale versions before calling the mutation RPC, while the database retains the authoritative locked version check. Incremental migration `002_booking_conflict.sql` expresses that database domain conflict with `PT409`, not a serialization rollback code. It also counts actual business creators for onboarding limits rather than shared memberships. Database requests have a 20-second timeout; changing frontend state cannot bypass the final SQL checks.

`available_slots` is the single database scheduling engine used by public availability, creation, and rescheduling. It considers:

1. Active business/service/provider and provider-service mapping.
2. The requested business-local date and a 90-day booking horizon.
3. Enabled business hours and optional provider override for that weekday.
4. Quarter-hour start times and the entire service duration.
5. Business-wide and provider-specific blocked intervals.
6. Non-cancelled provider appointments; the rescheduled appointment is excluded only after tenant authorization.
7. Current time and business timezone.

Candidate timestamps are generated across the **actual UTC interval of the local day**, then filtered by local clock time. Nonexistent spring-forward times have no timestamp. Repeated fall-back times retain distinct UTC instants and the UI displays offsets in slot labels. Every elapsed minute is checked against working windows, avoiding a duration crossing a DST boundary into closed hours.

Intervals are half-open: `[start, end)`. An appointment ending at 10:00 does not overlap one beginning at 10:00. The database GiST exclusion constraint covers provider ID and timestamp range for every non-cancelled status. This also prevents a status update from unexpectedly reopening capacity.

Creation and rescheduling take a transaction-scoped advisory lock keyed by business, revalidate availability, then persist all changes. Scheduling configuration mutations take the same lock through triggers. Per-business locking is intentionally simple and serializes unrelated providers within one small tenant; a high-throughput edition should partition locks by resource while retaining consistent lock ordering for business-wide edits. The exclusion constraint remains the final double-booking guard.

Creation stores a request UUID and a fingerprint of the booking payload. Reusing that key with the same payload returns the existing minimal booking result; changing the payload with that key is rejected. Rescheduling/status mutations compare an expected version number and record audit metadata. A failed reschedule rolls back without releasing the original time.

Changing schedules does not retroactively cancel appointments. Existing bookings keep their timestamps even after a timezone change. Single daily windows are supported; overnight windows, split shifts, recurring exception rules, and per-provider timezones are not part of the baseline.

## Notification outbox

Jobs are inserted in the same transaction as the appointment mutation. A notification provider failure therefore cannot roll back or erase a successfully committed appointment. Each job is unique by booking, template, channel, and version.

The worker claims due jobs using `SKIP LOCKED`, a five-minute lease, and a maximum of three attempts. It rechecks state/version/preferences under the tenant lock before delivery. For the mock adapter, delivery means inserting a notification log and marking the job sent in the same database transaction. This provides transactional mock idempotency.

For a real provider, exactly-once external delivery cannot be guaranteed by a database flag alone. Add an external adapter that sends `reminder.id` as the provider idempotency key, records provider message IDs, handles delivery callbacks, and treats timeout outcomes carefully. The current implementation does not pretend to send real messages. Confirmation jobs are processed on the next worker run, not synchronously in the browser's booking request.

Preference changes do not backfill missed jobs. Jobs already queued for a now-disabled channel are skipped at delivery. Reminder time is `max(now, appointment_start - 24 hours)` and past-start reminders are skipped.

## Subscription simulation

An owner/admin distinction is supported; only owners change billing. Each business starts with a simulated customer ID and a 14-day trial. Checkout is an explicit two-step flow with an expiring server-side session and idempotent completion. It resets the monthly period to one month from confirmation; it is not prorated and does not collect money.

| State        | Premium access                           |
| ------------ | ---------------------------------------- |
| `trialing`   | Until current period end                 |
| `active`     | Until current period end                 |
| `past_due`   | Until current period end plus three days |
| `cancelled`  | Removed immediately                      |
| `incomplete` | Unavailable                              |

Billing routes remain available when premium routes return 402. Public booking deliberately remains available while the business is published, to avoid disrupting customers. Owners can pause the page before cancelling. Subscription state is never accepted from the ordinary browser checkout body.

The simulated provider supports HMAC-SHA256 webhooks, exact-byte signature verification, five-minute replay timestamp bounds, stored event IDs, and out-of-order event suppression. This is **not Stripe's signature format**. To integrate Stripe later, add its SDK and signature verification on a raw-body endpoint; validate customer/subscription ownership and configured price; map verified events into the same database state machine. Keep the simulator disabled in a paid production product.

## Dashboard and CRM formulas

- **Today's appointments:** all statuses whose start is on the current business-local day. Cancelled rows remain visible and count as scheduled records.
- **Upcoming:** pending/confirmed starts between now and seven days ahead.
- **Revenue:** lifetime sum of completed booking prices only; this is booking value, not verified payment collection.
- **Clients:** count of tenant CRM rows.
- **No-show rate:** `no_show / (completed + no_show) × 100`; zero when the denominator is zero. Pending, confirmed, and cancelled rows are excluded.
- **Client lifetime value:** sum of that client's completed booking prices.
- **Last appointment:** most recent completed start.
- **Next appointment:** earliest future pending/confirmed start.
- **Client appointment count:** all booking statuses.

The CRM security-invoker view performs aggregation inside PostgreSQL, respecting base-table RLS. The dashboard uses one aggregation RPC. Calendar requests use bounded time ranges and up to 100 rows per page. Client and booking list pages default to 25 rows; history is not loaded wholesale into the browser.

## Observability and abuse controls

Every API request receives an `X-Request-Id`. Structured logs include route pattern, method, status, latency, and error code, without access tokens, request bodies, or customer contact information. Errors return a consistent JSON envelope and correlation ID. Booking events, billing events, and notification attempts are persisted.

Helmet headers, 32 KB body limits, validated IDs/date ranges, intentionally configured CORS, safe React text rendering, and rate limits reduce common input risks. CORS is not authorization. Public reads are limited to 90 requests/minute/IP and booking submissions to 10/minute/IP per running process. A distributed store or edge limiter is required to coordinate this across serverless instances. Add CAPTCHA, email verification or abuse scoring for high-risk public deployments.

Supabase Auth supplies account authentication and recovery. The UI stores sessions through Supabase's browser SDK, so an XSS bug would be significant; avoid unsafe HTML rendering and unreviewed scripts. The interface renders notes as text, not HTML.

## Scale: hundreds to thousands of tenants

- Preserve composite tenant indexes and date-range indexes; inspect real query plans before changing them.
- Replace per-process rate limiting with a shared edge/Redis-backed limiter.
- Cache public profile/service configuration using short TTLs and invalidate on edits. Do not cache available slots as an authorization decision.
- Precompute recurring schedule candidate boundaries if minute-based DST checks become a bottleneck.
- Consider per-provider locks instead of tenant locks only with an explicit strategy for business-wide schedule changes.
- Keep SQL aggregation tenant-filtered; for very large histories, maintain incremental summaries or materialized reporting tables.
- Supabase HTTP/PostgREST access avoids maintaining a Node connection pool per serverless invocation. If using direct SQL later, use the platform's transaction pooler and enforce connection budgets.
- Move notification jobs to a dedicated worker fleet/queue if batches exceed cron throughput. Use leases, unique job keys, provider idempotency, and dead-letter visibility.
- Partition/archive high-volume event and notification tables, retaining the required audit trail.
- Add error monitoring, latency metrics, resource limits, backups, and a documented recovery process before production usage.

## Deliberate limitations and deployment status

The database migration, SQL function behavior, RLS, real authentication, concurrency, and cloud deployment remain runtime-unverified. No automated or live tests were executed by request. Vercel project files are supplied but there is no live demo URL or remote repository created.

Optional AI assistants, no-show prediction, follow-up generation, waitlists, iCal, customer self-service tokens, recurring exception editors, provider-specific timezones, invitation UI, and payment collection are not implemented. The PDF labels these as optional/bonus or accepts simulation. Providers have no separate staff login portal. Fonts use Google Fonts with system fallbacks. No analytics or tracking provider is included.
