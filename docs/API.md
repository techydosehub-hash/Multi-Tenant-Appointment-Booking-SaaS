# API reference

Base URL: `http://localhost:3001/api` locally. All dates representing instants use ISO 8601 with an explicit offset. Appointment prices are integer minor units. JSON request bodies are limited to 32 KB.

## Response and authorization contract

Success:

```json
{ "data": { "id": "..." } }
```

Failure:

```json
{
  "error": {
    "code": "HTTP_401",
    "message": "Please sign in",
    "request_id": "..."
  }
}
```

Private requests require `Authorization: Bearer SUPABASE_ACCESS_TOKEN`. Tenant routes also require `X-Business-Id: BUSINESS_UUID`, which is checked against membership; supplying a header does not confer access.

### Private visitor demo

| Route | Authentication | Behavior |
| --- | --- | --- |
| `POST /demo/guest` | None | Always returns `403` with "Sign in or create an account to try the demo." Unauthenticated guest demos were removed; the demo is available only to signed-in accounts through `POST /demo/start`. |
| `POST /demo/start` | Verified user JWT | Body `{ "return_business_id": "optional UUID or null" }`. Seeds/resumes this user's separate demo; validates return-workspace membership. Rejects legacy guest identities with `403`. No business header required. |
| `POST /demo/exit` | Verified user JWT | Empty body. Hides the demo without deleting it. Returns `guest` and `return_business_id`. Guest clients must sign out; regular clients refresh `/me`. |
| `GET /me` | Verified user JWT | Includes `demo` and `guest`. Active demos expose only their own demo membership and a fictional profile. Inactive demos are hidden. Older shared owner grants are hidden from the primary account; dedicated fixture owners/admins retain their original sample access. |
| `GET/PATCH /profile` | Verified user JWT | While demo is active, reads/edits the fictional profile in server-owned demo metadata, leaving actual Auth user profile fields unchanged. |

Demo mode rejects tenant API requests that target real workspaces. Guest users cannot create real businesses through the API; migration `003_private_demo_allowance.sql` also protects the underlying SQL RPC and excludes personal demos from the five-business allowance. Ordinary RLS still applies to the visitor's tenant. Signed-in demo activation is account-wide; another tab must refresh to see the mode change. Reset is a visibility/session transition, not revocation of a signed-in owner's direct RLS access or deletion of records. Public booking links retain their usual public booking behavior.

`GET /me`, `GET/PATCH /profile`, and `POST /businesses` require authentication but not a selected business. Profile metadata is personal presentation data, never authorization. Billing reads require membership; billing writes/checkout detail require owner membership but do not require an active subscription. Other private endpoints require premium access.

| Status    | Meaning                                                                            |
| --------- | ---------------------------------------------------------------------------------- |
| 200 / 201 | Successful read/update or creation                                                 |
| 400       | Validation, invalid transition, or domain constraint                               |
| 401       | Missing/invalid authentication or scheduler/webhook credentials                    |
| 402       | Subscription does not allow premium API access                                     |
| 403       | Membership, ownership, or database authorization denied                            |
| 404       | Missing/unavailable record                                                         |
| 409       | Slot conflict, duplicate record, or stale booking version                          |
| 429       | Rate limit exceeded                                                                |
| 500       | Unexpected error; inspect correlation ID in server logs                            |
| 503       | Required database schema or database connection unavailable; follow setup recovery |

## Public and system endpoints

| Method | Path                                    | Input / behavior                                                                                            |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                               | Process health and configured simulation labels; not a database readiness probe                             |
| GET    | `/health/ready`                         | Read-only membership relationship and CRM-view metadata availability; 503 if required schema is unavailable |
| GET    | `/public/businesses/:slug`              | Safe public business, services, providers, and capability mappings                                          |
| GET    | `/public/businesses/:slug/services`     | Active service projections                                                                                  |
| GET    | `/public/businesses/:slug/availability` | `service_id`, `date=YYYY-MM-DD`, optional `provider_id`                                                     |
| POST   | `/public/businesses/:slug/bookings`     | Validated booking payload below                                                                             |
| GET    | `/jobs/reminders`                       | Requires `Authorization: Bearer CRON_SECRET`; processes up to 50 jobs                                       |
| POST   | `/billing/webhook`                      | Raw signed simulated lifecycle event; no user auth                                                          |

Booking payload:

```json
{
  "service_id": "SERVICE_UUID",
  "provider_id": "PROVIDER_UUID",
  "starts_at": "2026-10-12T04:30:00.000Z",
  "name": "Jordan Lee",
  "email": "jordan@example.com",
  "phone": "+919876543210",
  "notes": "First appointment",
  "request_key": "CLIENT_GENERATED_UUID"
}
```

UUID placeholders must be replaced with real UUID values. `starts_at` must exactly match an available slot. `price`, `status`, `business_id`, and `ends_at` are not accepted from the client; they are derived server-side. Use the same request key only when retrying the same payload.

## Authentication, tenancy, and profile

| Method | Path          | Input / behavior                                                                   |
| ------ | ------------- | ---------------------------------------------------------------------------------- |
| GET    | `/me`         | Current user ID/email and accessible business memberships                          |
| GET    | `/profile`    | Current authenticated user's editable personal profile and account information     |
| PATCH  | `/profile`    | `{full_name, phone, bio, timezone}`; own verified user only; no role/email changes |
| POST   | `/businesses` | `{name, slug, timezone}`; transactional onboarding                                 |
| GET    | `/business`   | Selected tenant profile                                                            |
| PATCH  | `/business`   | Full editable profile object                                                       |
| GET    | `/dashboard`  | Defined aggregate dashboard metrics                                                |

Editable profile fields: `name`, `slug`, `description`, `timezone`, `currency`, `phone`, `email`, `status` (`active`/`paused`), `requires_approval`, `email_notifications`, `sms_notifications`.

Additional billing endpoints: `GET /billing/history?page=1&limit=10` returns paginated tenant checkout sessions; `GET /billing/checkout/:id` returns a tenant/owner-checked session with server-defined plan/amount/expiry; `POST /billing/checkout/:id/decline` records an idempotent simulated decline without changing the subscription. The existing completion RPC activates an approved demo subscription atomically. Receipt contents are derived from completed sessions; no financial details are accepted.

## Services, providers, and schedules

| Method        | Path                      | Input / behavior                                                        |
| ------------- | ------------------------- | ----------------------------------------------------------------------- |
| GET / POST    | `/services`               | List or create `{name, description, duration_minutes, price, active}`   |
| PATCH         | `/services/:id`           | Partial editable service object; deactivate instead of deleting history |
| GET / POST    | `/providers`              | List or create `{name, active}`                                         |
| PATCH         | `/providers/:id`          | Partial editable provider object                                        |
| GET           | `/provider-services`      | Capability mappings                                                     |
| POST / DELETE | `/provider-services`      | `{provider_id, service_id}` to assign/remove capability                 |
| GET           | `/schedule`               | Business hours, provider hours, and blocked periods                     |
| PUT           | `/schedule/hours`         | `{provider_id: UUID or null, hours: [seven daily records]}`             |
| DELETE        | `/schedule/providers/:id` | Remove overrides; follow business hours                                 |
| POST          | `/schedule/blocks`        | `{provider_id: UUID or null, starts_at, ends_at, reason}`               |
| DELETE        | `/schedule/blocks/:id`    | Remove tenant-owned block                                               |

Each hours row contains `day_of_week` (Sunday=0 through Saturday=6), `start_time` (`HH:mm`), `end_time`, and `enabled`. Include each weekday exactly once. End must be after start even on disabled days. Provider hours intersect with business hours. Changing hours or blocks does not modify existing bookings.

## Bookings and CRM

| Method | Path                         | Input / behavior                                                                 |
| ------ | ---------------------------- | -------------------------------------------------------------------------------- |
| GET    | `/bookings`                  | `page`, `limit`, optional `from`, `to`, `status`, `provider_id`, `client_id`     |
| GET    | `/bookings/:id`              | Booking, joined client/service/provider fields, and audit events                 |
| PATCH  | `/bookings/:id`              | `{status, version}`                                                              |
| GET    | `/bookings/:id/availability` | `date`, optional `provider_id`; excludes the current booking after authorization |
| POST   | `/bookings/:id/reschedule`   | `{starts_at, provider_id, version}`                                              |
| GET    | `/clients`                   | `search`, `page`, `limit`; includes aggregated metrics                           |
| GET    | `/clients/:id`               | Tenant client and metrics                                                        |
| PATCH  | `/clients/:id`               | `{notes}` only; private business notes                                           |
| GET    | `/notifications`             | Paginated jobs, including retry/error state                                      |
| GET    | `/notification-logs`         | Paginated delivery attempts                                                      |

List responses with pagination: `{items, total, page, limit}` for bookings/clients; notification responses contain `{items, total}`. Default limit 25, maximum 100. Combined booking `from`/`to` ranges must be increasing and at most 93 days. Bounds are inclusive start/exclusive end. If no date range is supplied, bookings are sorted newest first; calendar ranges sort ascending.

## Billing

| Method | Path                             | Input / behavior                                                          |
| ------ | -------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/billing`                       | Subscription, mode, monthly plan price and currency                       |
| POST   | `/billing/checkout`              | Owner only; creates expiring session and internal checkout URL            |
| POST   | `/billing/checkout/:id/complete` | Owner only; activates a simulated month; session completion is idempotent |
| POST   | `/billing/cancel`                | Owner only; immediate cancellation and audit event                        |

Simulated webhook body:

```json
{
  "id": "sim_event_unique_identifier",
  "business_id": "BUSINESS_UUID",
  "status": "active",
  "current_period_end": "2026-11-07T12:00:00.000Z",
  "created_at": "2026-10-07T12:00:00.000Z"
}
```

Headers: `X-Billing-Timestamp` as Unix seconds and `X-Billing-Signature` as hex HMAC-SHA256 of `${timestamp}.${rawBody}`, using the server webhook secret. Timestamp must be within five minutes; JSON parsing occurs only after signature verification. Unique event IDs provide replay idempotency; older event times do not overwrite newer subscription state. The supplied simulator constructs the signature correctly. This protocol is intentionally a simulation, not Stripe's webhook protocol.
