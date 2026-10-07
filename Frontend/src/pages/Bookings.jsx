import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DateTime } from "luxon";
import {
  ArrowUpRight,
  CalendarDays,
  Users,
  Wallet,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useApp } from "../context";
import { formatDate, localDate, money, query } from "../lib";
import {
  Badge,
  ConfirmButton,
  Empty,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  Pagination,
  useResource,
} from "../ui";
export function BookingTable({ items }) {
  const { business } = useApp();
  if (!items.length)
    return (
      <Empty title="A little breathing room">
        Appointments will appear here when a client books.
      </Empty>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Appointment</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id}>
              <td>
                <strong>{b.clients?.name}</strong>
                <small>{b.clients?.email}</small>
              </td>
              <td>
                <strong>{b.services?.name}</strong>
                <small>{formatDate(b.starts_at, business.timezone)}</small>
              </td>
              <td>{b.providers?.name}</td>
              <td>
                <Badge status={b.status} />
              </td>
              <td>{money(b.price, business.currency)}</td>
              <td>
                <Link
                  className="icon-btn"
                  aria-label={`Open booking for ${b.clients?.name}`}
                  to={`/dashboard/bookings/${b.id}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Overview() {
  const { business, request } = useApp();
  const today = DateTime.now().setZone(business.timezone).startOf("day");
  const metrics = useResource(() => request("/dashboard"), [request]),
    bookings = useResource(
      () =>
        request(
          `/bookings?${query({ from: today.toUTC().toISO(), to: today.plus({ days: 1 }).toUTC().toISO(), limit: 10 })}`,
        ),
      [request, today.toISODate()],
    );
  return (
    <>
      <PageTitle
        eyebrow={today.toFormat("cccc, dd LLLL yyyy").toUpperCase()}
        title="A clear view of your day."
        description="The appointments, people, and little details that matter."
      >
        <a
          className="btn"
          href={`/booking/${business.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          Open booking page <ArrowUpRight size={16} />
        </a>
      </PageTitle>
      <ErrorBox error={metrics.error} />
      {metrics.loading ? (
        <Loading />
      ) : (
        metrics.data && (
          <div className="metrics">
            {[
              [CalendarDays, "Today’s appointments", metrics.data.today],
              [TrendingUp, "Upcoming · 7 days", metrics.data.upcoming],
              [
                Wallet,
                "Completed revenue",
                money(metrics.data.revenue, business.currency),
              ],
              [Users, "Your clients", metrics.data.clients],
            ].map(([Icon, label, value]) => (
              <article className="metric" key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={17} />
                </div>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        )
      )}
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>On the calendar today</h2>
              <p>All times in {business.timezone}</p>
            </div>
            <Link className="quiet-link" to="/dashboard/calendar">
              Full calendar ↗
            </Link>
          </div>
          <ErrorBox error={bookings.error} />
          {bookings.loading ? (
            <Loading />
          ) : (
            bookings.data && <BookingTable items={bookings.data.items} />
          )}
        </section>
        <aside className="panel welcome-card">
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2>
            A good day
            <br />
            starts here.
          </h2>
          <p>
            Give your clients a simple path to your next available appointment.
          </p>
          <Link to="/dashboard/services">
            01 <span>Add your services</span> ↗
          </Link>
          <Link to="/dashboard/providers">
            02 <span>Connect your providers</span> ↗
          </Link>
          <Link to="/dashboard/schedule">
            03 <span>Set your availability</span> ↗
          </Link>
          <div className="rate-stat">
            <strong>{metrics.data?.no_show_rate || 0}%</strong>
            <span>
              Lifetime no-show rate
              <br />
              <small>No-shows / completed + no-shows</small>
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
export function Bookings() {
  const { request } = useApp();
  const [page, setPage] = useState(1),
    [status, setStatus] = useState("");
  const r = useResource(
    () => request(`/bookings?${query({ page, status })}`),
    [request, page, status],
  );
  return (
    <>
      <PageTitle
        title="Every appointment, accounted for."
        description="Follow your bookings from first hello to the next visit."
      />
      <div className="toolbar">
        <Field label="Filter by status">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {["pending", "confirmed", "completed", "cancelled", "no_show"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </Field>
      </div>
      <ErrorBox error={r.error} />
      <section className="panel">
        {r.loading ? (
          <Loading />
        ) : (
          r.data && (
            <>
              <BookingTable items={r.data.items} />
              <Pagination page={page} total={r.data.total} onChange={setPage} />
            </>
          )
        )}
      </section>
    </>
  );
}
export function Calendar() {
  const { business, request } = useApp();
  const [date, setDate] = useState(localDate(business.timezone)),
    [view, setView] = useState("week"),
    [provider, setProvider] = useState(""),
    [page, setPage] = useState(1);
  const day = DateTime.fromISO(date, { zone: business.timezone }),
    start = view === "day" ? day.startOf("day") : day.startOf(view),
    end = start.plus(
      view === "day"
        ? { days: 1 }
        : view === "week"
          ? { weeks: 1 }
          : { months: 1 },
    );
  const r = useResource(
    () =>
      request(
        `/bookings?${query({ from: start.toUTC().toISO(), to: end.toUTC().toISO(), provider_id: provider, page, limit: 100 })}`,
      ),
    [request, date, view, provider, page],
  );
  const ps = useResource(() => request("/providers"), [request]);
  const days = Array.from(
    { length: Math.round(end.diff(start, "days").days) },
    (_, i) => start.plus({ days: i }),
  );
  function move(n) {
    setDate(
      day
        .plus(
          view === "day"
            ? { days: n }
            : view === "week"
              ? { weeks: n }
              : { months: n },
        )
        .toISODate(),
    );
    setPage(1);
  }
  return (
    <>
      <PageTitle
        title="Make space for a good day."
        description={`Your calendar, in ${business.timezone}.`}
      >
        <div className="segmented">
          {["day", "week", "month"].map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => {
                setView(v);
                setPage(1);
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </PageTitle>
      <div className="calendar-toolbar">
        <div className="actions">
          <button
            className="icon-btn"
            aria-label="Previous period"
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </button>
          <h2>
            {start.toFormat("dd LLL")} —{" "}
            {end.minus({ days: 1 }).toFormat("dd LLL yyyy")}
          </h2>
          <button
            className="icon-btn"
            aria-label="Next period"
            onClick={() => move(1)}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="actions">
          <input
            aria-label="Calendar date"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setPage(1);
              }
            }}
          />
          <select
            aria-label="Provider filter"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All providers</option>
            {ps.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ErrorBox error={r.error} />
      {r.loading ? (
        <Loading />
      ) : (
        r.data && (
          <>
            <div className={`calendar-grid ${view}`}>
              {view === "month" &&
                Array.from({ length: start.weekday - 1 }, (_, i) => (
                  <div className="calendar-blank" key={`blank-${i}`} />
                ))}
              {days.map((d) => {
                const items = r.data.items.filter(
                  (b) =>
                    DateTime.fromISO(b.starts_at)
                      .setZone(business.timezone)
                      .toISODate() === d.toISODate(),
                );
                return (
                  <section
                    className={`calendar-day ${d.toISODate() === localDate(business.timezone) ? "today" : ""}`}
                    key={d.toISODate()}
                  >
                    <header>
                      <span>{d.toFormat("ccc")}</span>
                      <strong>{d.day}</strong>
                    </header>
                    {items.length ? (
                      items.map((b) => (
                        <Link
                          key={b.id}
                          className={`calendar-event ${b.status}`}
                          to={`/dashboard/bookings/${b.id}`}
                        >
                          <time>
                            {formatDate(
                              b.starts_at,
                              business.timezone,
                              "h:mm a",
                            )}
                          </time>
                          <strong>{b.clients?.name}</strong>
                          <span>{b.services?.name}</span>
                          <small>
                            {b.providers?.name} · {b.status.replace("_", " ")}
                          </small>
                        </Link>
                      ))
                    ) : (
                      <p className="calendar-empty">No appointments</p>
                    )}
                  </section>
                );
              })}
            </div>
            {r.data.total > 100 && (
              <>
                <p className="muted">
                  Showing this page’s appointments. Use pagination to see the
                  rest of this period.
                </p>
                <Pagination
                  page={page}
                  limit={100}
                  total={r.data.total}
                  onChange={setPage}
                />
              </>
            )}
          </>
        )
      )}
    </>
  );
}
export function BookingDetail() {
  const { id } = useParams(),
    { request, business, notify } = useApp();
  const r = useResource(() => request(`/bookings/${id}`), [request, id]);
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [rescheduling, setRescheduling] = useState(false),
    [date, setDate] = useState(localDate(business.timezone)),
    [slot, setSlot] = useState(null),
    [provider, setProvider] = useState("");
  const slots = useResource(
    () =>
      rescheduling
        ? request(
            `/bookings/${id}/availability?${query({ date, provider_id: provider })}`,
          )
        : Promise.resolve([]),
    [request, id, date, rescheduling, provider],
  );
  const providers = useResource(() => request("/providers"), [request]);
  async function action(status) {
    setBusy(true);
    setError(null);
    try {
      await request(`/bookings/${id}`, {
        method: "PATCH",
        body: { status, version: r.data.booking.version },
      });
      notify("Appointment updated");
      r.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function reschedule() {
    setBusy(true);
    setError(null);
    try {
      await request(`/bookings/${id}/reschedule`, {
        method: "POST",
        body: {
          starts_at: slot.starts_at,
          provider_id: slot.provider_id,
          version: r.data.booking.version,
        },
      });
      notify("Appointment rescheduled");
      setRescheduling(false);
      setSlot(null);
      r.reload();
    } catch (e) {
      setError(e);
      slots.reload();
      setSlot(null);
    } finally {
      setBusy(false);
    }
  }
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} />;
  const b = r.data.booking,
    terminal = ["cancelled", "completed", "no_show"].includes(b.status);
  return (
    <>
      <Link className="quiet-link" to="/dashboard/bookings">
        ← All bookings
      </Link>
      <PageTitle
        eyebrow="APPOINTMENT DETAILS"
        title={b.services.name}
        description={`Reference ${b.id}`}
      >
        <Badge status={b.status} />
      </PageTitle>
      <ErrorBox error={error} />
      <div className="detail-grid">
        <section className="panel padded">
          <h2>{formatDate(b.starts_at, business.timezone)}</h2>
          <p>
            {formatDate(b.ends_at, business.timezone, "h:mm a")} finish ·{" "}
            {business.timezone}
          </p>
          <dl>
            <dt>Client</dt>
            <dd>
              <Link to={`/dashboard/clients/${b.client_id}`}>
                {b.clients.name} ↗
              </Link>
            </dd>
            <dt>Email</dt>
            <dd>{b.clients.email}</dd>
            <dt>Phone</dt>
            <dd>{b.clients.phone}</dd>
            <dt>Provider</dt>
            <dd>{b.providers.name}</dd>
            <dt>Booking value</dt>
            <dd>{money(b.price, business.currency)}</dd>
            <dt>Client message</dt>
            <dd className="preserve">
              {b.customer_notes || "No additional notes"}
            </dd>
          </dl>
          {!terminal && (
            <div className="actions wrap">
              {b.status === "pending" && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => action("confirmed")}
                >
                  Confirm appointment
                </button>
              )}
              {b.status === "confirmed" && (
                <>
                  <ConfirmButton
                    className="btn"
                    disabled={busy || new Date(b.ends_at) > new Date()}
                    onConfirm={() => action("completed")}
                  >
                    Mark completed
                  </ConfirmButton>
                  <ConfirmButton
                    className="btn subtle"
                    disabled={busy || new Date(b.ends_at) > new Date()}
                    onConfirm={() => action("no_show")}
                  >
                    Mark no-show
                  </ConfirmButton>
                </>
              )}
              <button
                className="btn subtle"
                disabled={busy || new Date(b.starts_at) <= new Date()}
                onClick={() => {
                  setRescheduling(!rescheduling);
                  setSlot(null);
                }}
              >
                Reschedule
              </button>
              <ConfirmButton
                className="btn danger"
                disabled={busy}
                onConfirm={() => action("cancelled")}
              >
                Cancel booking
              </ConfirmButton>
            </div>
          )}
          {!terminal && (
            <p className="fine-print">
              Completion and no-show actions become available after the
              appointment ends.
            </p>
          )}
        </section>
        <section className="panel padded">
          <h2>Appointment history</h2>
          <div className="timeline">
            {r.data.events.map((e) => (
              <article key={e.id}>
                <span className="timeline-dot" />
                <strong>{e.event_type.replace("_", " ")}</strong>
                <small>{formatDate(e.created_at, business.timezone)}</small>
                {e.metadata.previous_starts_at && (
                  <p>
                    Previous:{" "}
                    {formatDate(
                      e.metadata.previous_starts_at,
                      business.timezone,
                    )}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
      {rescheduling && (
        <section className="panel padded section-gap">
          <h2>Choose a new time</h2>
          <div className="form-grid">
            <Field
              label="Date"
              type="date"
              min={localDate(business.timezone)}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlot(null);
              }}
            />
            <Field label="Provider">
              <select
                value={provider || b.provider_id}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setSlot(null);
                }}
              >
                {providers.data
                  ?.filter((p) => p.active)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <ErrorBox error={slots.error} />
          {slots.loading ? (
            <Loading />
          ) : slots.data?.length ? (
            <div className="slots">
              {slots.data.map((s) => (
                <button
                  key={s.starts_at + s.provider_id}
                  className={`slot ${slot?.starts_at === s.starts_at ? "selected" : ""}`}
                  onClick={() => setSlot(s)}
                >
                  {formatDate(s.starts_at, business.timezone, "h:mm a ZZ")}
                </button>
              ))}
            </div>
          ) : (
            <Empty title="No available times">
              Try another date or a provider assigned to this service.
            </Empty>
          )}
          <button
            className="btn"
            disabled={!slot || busy || slots.loading}
            onClick={reschedule}
          >
            Confirm new time
          </button>
        </section>
      )}
    </>
  );
}
