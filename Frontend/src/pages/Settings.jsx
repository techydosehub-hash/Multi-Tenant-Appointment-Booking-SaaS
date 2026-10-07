import { useState } from "react";
import { DateTime } from "luxon";
import { Plus, Clock, Scissors } from "lucide-react";
import { useApp } from "../context";
import { formatDate, money, query } from "../lib";
import {
  Badge,
  ConfirmButton,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageTitle,
  Pagination,
  useResource,
} from "../ui";
export function Services() {
  const { request, business, notify } = useApp();
  const r = useResource(() => request("/services"), [request]);
  const [editing, setEditing] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await request(`/services${editing.id ? "/" + editing.id : ""}`, {
        method: editing.id ? "PATCH" : "POST",
        body: {
          name: f.get("name"),
          description: f.get("description"),
          duration_minutes: Number(f.get("duration")),
          price: Math.round(Number(f.get("price")) * 100),
          active: f.get("active") === "on",
        },
      });
      notify("Service saved");
      setEditing(null);
      r.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Your craft, on the menu."
        description="Clear services help clients find just what they need."
      >
        <button
          className="btn"
          onClick={() => {
            setError(null);
            setEditing({ active: true, duration_minutes: 30, price: 0 });
          }}
        >
          <Plus size={17} /> Add service
        </button>
      </PageTitle>
      <ErrorBox error={r.error} />
      {r.loading ? (
        <Loading />
      ) : r.data?.length ? (
        <div className="service-grid">
          {r.data.map((s) => (
            <article className="panel service-card" key={s.id}>
              <div className="service-card-top">
                <Scissors size={22} />
                <Badge status={s.active ? "active" : "paused"} />
              </div>
              <h2>{s.name}</h2>
              <p>{s.description || "No description added yet."}</p>
              <div className="service-meta">
                <span>
                  <Clock size={14} /> {s.duration_minutes} min
                </span>
                <strong>{money(s.price, business.currency)}</strong>
              </div>
              <button
                className="btn subtle full"
                onClick={() => {
                  setError(null);
                  setEditing(s);
                }}
              >
                Edit service
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="What do you do best?">
          Add your first service, then assign a provider to make it bookable.
        </Empty>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit service" : "Add a service"}
          onClose={() => !busy && setEditing(null)}
        >
          <ErrorBox error={error} />
          <form onSubmit={save}>
            <Field
              label="Service name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={editing.name}
            />
            <Field label="Description">
              <textarea
                name="description"
                rows={3}
                maxLength={2000}
                defaultValue={editing.description}
              />
            </Field>
            <div className="form-grid">
              <Field
                label="Duration (minutes)"
                name="duration"
                type="number"
                min={5}
                max={480}
                step={1}
                required
                defaultValue={editing.duration_minutes}
              />
              <Field
                label={`Price (${business.currency})`}
                name="price"
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                required
                defaultValue={editing.price / 100}
              />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing.active}
              />{" "}
              Available for booking
            </label>
            <p className="fine-print">
              Archive a service by switching off availability. Existing bookings
              keep their original price and duration.
            </p>
            <button className="btn full" disabled={busy}>
              {busy ? "Saving…" : "Save service"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Providers() {
  const { request, notify } = useApp();
  const r = useResource(async () => {
    const [providers, services, mappings] = await Promise.all([
      request("/providers"),
      request("/services"),
      request("/provider-services"),
    ]);
    return { providers, services, mappings };
  }, [request]);
  const [editing, setEditing] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const f = new FormData(e.currentTarget);
      await request(`/providers${editing.id ? "/" + editing.id : ""}`, {
        method: editing.id ? "PATCH" : "POST",
        body: { name: f.get("name"), active: f.get("active") === "on" },
      });
      setEditing(null);
      r.reload();
      notify("Provider saved");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(provider_id, service_id, enabled) {
    setBusy(true);
    setError(null);
    try {
      await request("/provider-services", {
        method: enabled ? "DELETE" : "POST",
        body: { provider_id, service_id },
      });
      r.reload();
      notify("Service assignment updated");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="The people behind the work."
        description="Providers are bookable resources. Assign their services and set their hours."
      >
        <button
          className="btn"
          onClick={() => {
            setEditing({ active: true });
            setError(null);
          }}
        >
          <Plus size={17} /> Add provider
        </button>
      </PageTitle>
      <ErrorBox error={r.error || error} />
      {r.loading ? (
        <Loading />
      ) : r.data?.providers.length ? (
        <div className="service-grid">
          {r.data.providers.map((p) => (
            <article className="panel padded" key={p.id}>
              <div className="panel-heading compact">
                <h2>{p.name}</h2>
                <Badge status={p.active ? "active" : "paused"} />
              </div>
              <span className="eyebrow">BOOKABLE SERVICES</span>
              <div className="assignments">
                {r.data.services.length ? (
                  r.data.services.map((s) => {
                    const enabled = r.data.mappings.some(
                      (m) => m.provider_id === p.id && m.service_id === s.id,
                    );
                    return (
                      <label className="checkbox" key={s.id}>
                        <input
                          disabled={busy}
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggle(p.id, s.id, enabled)}
                        />
                        {s.name}
                        {!s.active && " (archived)"}
                      </label>
                    );
                  })
                ) : (
                  <p>Add a service first.</p>
                )}
              </div>
              <button
                className="btn subtle full"
                onClick={() => {
                  setEditing(p);
                  setError(null);
                }}
              >
                Edit provider
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="A place for your team">
          Add yourself as a provider if you work independently.
        </Empty>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit provider" : "Add provider"}
          onClose={() => !busy && setEditing(null)}
        >
          <ErrorBox error={error} />
          <form onSubmit={save}>
            <Field
              label="Provider name"
              name="name"
              minLength={2}
              maxLength={120}
              required
              defaultValue={editing.name}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing.active}
              />{" "}
              Active provider
            </label>
            <button className="btn full" disabled={busy}>
              Save provider
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function SettingsPage() {
  const { request, refresh, notify } = useApp();
  const r = useResource(() => request("/business"), [request]);
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      const body = Object.fromEntries(
        [
          "name",
          "slug",
          "description",
          "timezone",
          "currency",
          "phone",
          "email",
          "status",
        ].map((k) => [k, f.get(k)]),
      );
      for (const k of [
        "requires_approval",
        "email_notifications",
        "sms_notifications",
      ])
        body[k] = f.get(k) === "on";
      await request("/business", { method: "PATCH", body });
      await refresh();
      r.reload();
      notify("Business settings saved");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} />;
  const b = r.data;
  return (
    <>
      <PageTitle
        title="A workspace that feels like you."
        description="Your profile, booking preferences, and the details that make it yours."
      />
      <ErrorBox error={error} />
      <form onSubmit={save} className="settings-form">
        <section className="panel padded">
          <h2>Business profile</h2>
          <div className="form-grid">
            <Field
              label="Business name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={b.name}
            />
            <Field
              label="Public booking slug"
              name="slug"
              required
              minLength={3}
              maxLength={64}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={b.slug}
            />
          </div>
          <Field label="A few words about your business">
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={b.description}
            />
          </Field>
          <div className="form-grid">
            <Field
              label="Public email"
              name="email"
              type="email"
              defaultValue={b.email}
            />
            <Field
              label="Public phone"
              name="phone"
              maxLength={30}
              defaultValue={b.phone}
            />
            <Field
              label="Timezone"
              name="timezone"
              required
              defaultValue={b.timezone}
              list="zones"
            />
            <datalist id="zones">
              {Intl.supportedValuesOf("timeZone").map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Field label="Business currency">
              <select name="currency" defaultValue={b.currency}>
                {["INR", "USD", "EUR", "GBP"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="fine-print">
            Currency is fixed after the first booking to keep historical values
            consistent. Timezone changes affect future availability; existing
            appointments keep their absolute time.
          </p>
        </section>
        <section className="panel padded">
          <h2>Booking preferences</h2>
          <Field label="Booking page visibility">
            <select name="status" defaultValue={b.status}>
              <option value="active">Published — accepting bookings</option>
              <option value="paused">Paused — public page unavailable</option>
            </select>
          </Field>
          <label className="checkbox">
            <input
              name="requires_approval"
              type="checkbox"
              defaultChecked={b.requires_approval}
            />{" "}
            Review requests before confirming appointments
          </label>
          <label className="checkbox">
            <input
              name="email_notifications"
              type="checkbox"
              defaultChecked={b.email_notifications}
            />{" "}
            Record email confirmations and reminders
          </label>
          <label className="checkbox">
            <input
              name="sms_notifications"
              type="checkbox"
              defaultChecked={b.sms_notifications}
            />{" "}
            Record SMS confirmations and reminders
          </label>
          <p className="fine-print">
            Notifications use the mock adapter. No real messages are sent.
            Preference changes affect new jobs; queued jobs are rechecked before
            delivery.
          </p>
        </section>
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
    </>
  );
}
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function Schedule() {
  const { request, business, notify } = useApp();
  const [provider, setProvider] = useState(""),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const r = useResource(async () => {
    const [schedule, providers] = await Promise.all([
      request("/schedule"),
      request("/providers"),
    ]);
    return { ...schedule, providers };
  }, [request]);
  async function saveHours(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await request("/schedule/hours", {
        method: "PUT",
        body: {
          provider_id: provider || null,
          hours: days.map((_, i) => ({
            day_of_week: i,
            start_time: f.get(`start${i}`),
            end_time: f.get(`end${i}`),
            enabled: f.get(`enabled${i}`) === "on",
          })),
        },
      });
      notify("Working hours saved");
      r.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await request(`/schedule/providers/${provider}`, { method: "DELETE" });
      r.reload();
      notify("Provider now follows business hours");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function addBlock(e) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      let start = DateTime.fromISO(f.get("starts_at"), {
          zone: business.timezone,
        }),
        end = DateTime.fromISO(f.get("ends_at"), { zone: business.timezone });
      if (
        !start.isValid ||
        !end.isValid ||
        start.toFormat("yyyy-MM-dd'T'HH:mm") !== f.get("starts_at") ||
        end.toFormat("yyyy-MM-dd'T'HH:mm") !== f.get("ends_at")
      )
        throw new Error(
          "Choose a valid local time; this time may fall in a daylight-saving gap.",
        );
      // Resolve a repeated wall-clock hour deterministically to its earlier instant.
      start = start
        .getPossibleOffsets()
        .sort((a, b) => a.toMillis() - b.toMillis())[0];
      end = end
        .getPossibleOffsets()
        .sort((a, b) => a.toMillis() - b.toMillis())[0];
      await request("/schedule/blocks", {
        method: "POST",
        body: {
          provider_id: f.get("provider_id") || null,
          starts_at: start.toUTC().toISO(),
          ends_at: end.toUTC().toISO(),
          reason: f.get("reason"),
        },
      });
      form.reset();
      r.reload();
      notify("Time blocked");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function removeBlock(id) {
    setBusy(true);
    setError(null);
    try {
      await request(`/schedule/blocks/${id}`, { method: "DELETE" });
      r.reload();
      notify("Blocked period removed");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} />;
  const overrides = r.data.provider_hours.filter(
    (h) => h.provider_id === provider,
  );
  const hours = provider
    ? days.map(
        (_, i) =>
          overrides.find((h) => h.day_of_week === i) ||
          r.data.business_hours.find((h) => h.day_of_week === i),
      )
    : r.data.business_hours;
  return (
    <>
      <PageTitle
        title="Set your rhythm."
        description={`Working hours and time away, in ${business.timezone}. Slots begin every 15 minutes.`}
      />
      <ErrorBox error={error} />
      <div className="detail-grid">
        <section className="panel padded">
          <h2>Weekly working hours</h2>
          <Field label="Schedule for">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="">Default business hours</option>
              {r.data.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="fine-print">
            Provider hours are intersected with business hours. No override
            means business hours apply. Overnight schedules must be split across
            days and are not supported by this single-window editor.
          </p>
          <form key={provider + JSON.stringify(hours)} onSubmit={saveHours}>
            <div className="hours-list">
              {days.map((day, i) => {
                const h = hours.find((h) => h?.day_of_week === i);
                return (
                  <div className="hours-row" key={day}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        name={`enabled${i}`}
                        defaultChecked={h?.enabled ?? false}
                      />
                      {day}
                    </label>
                    <input
                      aria-label={`${day} opening time`}
                      type="time"
                      name={`start${i}`}
                      defaultValue={h?.start_time?.slice(0, 5) || "09:00"}
                      required
                    />
                    <span>to</span>
                    <input
                      aria-label={`${day} closing time`}
                      type="time"
                      name={`end${i}`}
                      defaultValue={h?.end_time?.slice(0, 5) || "17:00"}
                      required
                    />
                  </div>
                );
              })}
            </div>
            <div className="actions wrap">
              <button className="btn" disabled={busy}>
                Save hours
              </button>
              {provider && (
                <button
                  type="button"
                  className="btn subtle"
                  disabled={busy}
                  onClick={reset}
                >
                  Use business hours
                </button>
              )}
            </div>
          </form>
        </section>
        <section className="panel padded">
          <h2>Protect a little time</h2>
          <p className="muted">
            A lunch break, a holiday, or a day to yourself.
          </p>
          <form onSubmit={addBlock}>
            <Field label="Block time for">
              <select name="provider_id">
                <option value="">Entire business</option>
                {r.data.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={`From (${business.timezone})`}
              name="starts_at"
              type="datetime-local"
              required
            />
            <Field
              label="Until"
              name="ends_at"
              type="datetime-local"
              required
            />
            <Field
              label="Reason (private)"
              name="reason"
              maxLength={250}
              placeholder="Lunch break, annual leave…"
            />
            <button className="btn" disabled={busy}>
              Add blocked period
            </button>
          </form>
          <p className="fine-print">
            Existing bookings are retained when you change hours or add a block.
            Review and reschedule affected appointments separately. For repeated
            DST times, the earlier offset is used by this editor.
          </p>
        </section>
      </div>
      <section className="panel section-gap">
        <div className="panel-heading">
          <h2>Time away</h2>
        </div>
        {r.data.blocked_periods.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Provider</th>
                  <th>From</th>
                  <th>Until</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.data.blocked_periods.map((b) => (
                  <tr key={b.id}>
                    <td>{b.reason || "Unavailable"}</td>
                    <td>
                      {r.data.providers.find((p) => p.id === b.provider_id)
                        ?.name || "Entire business"}
                    </td>
                    <td>{formatDate(b.starts_at, business.timezone)}</td>
                    <td>{formatDate(b.ends_at, business.timezone)}</td>
                    <td>
                      <ConfirmButton
                        className="btn subtle small"
                        disabled={busy}
                        onConfirm={() => removeBlock(b.id)}
                      >
                        Remove
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No time blocked">
            Add a period above to keep it free from new bookings.
          </Empty>
        )}
      </section>
    </>
  );
}
export function Notifications() {
  const { request, business } = useApp();
  const [page, setPage] = useState(1),
    [tab, setTab] = useState("jobs");
  const r = useResource(
    () =>
      request(
        `/${tab === "jobs" ? "notifications" : "notification-logs"}?${query({ page })}`,
      ),
    [request, page, tab],
  );
  return (
    <>
      <PageTitle
        title="The follow-through."
        description="Confirmation and reminder activity. Mock delivery is recorded here; real messages are not sent."
      />
      <div className="toolbar">
        <div className="segmented">
          {["jobs", "attempts"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox error={r.error} />
      <section className="panel">
        {r.loading ? (
          <Loading />
        ) : (
          r.data && (
            <>
              {r.data.items.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Template</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>
                          {tab === "jobs" ? "Scheduled for" : "Recorded at"}
                        </th>
                        <th>
                          {tab === "jobs" ? "Attempts" : "Provider reference"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.data.items.map((n) => (
                        <tr key={n.id}>
                          <td>{n.template}</td>
                          <td>{n.channel}</td>
                          <td>
                            <Badge status={n.status} />
                            {(n.last_error || n.error) && (
                              <small>{n.last_error || n.error}</small>
                            )}
                          </td>
                          <td>
                            {formatDate(
                              n.scheduled_for || n.created_at,
                              business.timezone,
                            )}
                          </td>
                          <td>
                            {tab === "jobs"
                              ? n.attempts
                              : n.provider_message_id || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="All quiet for now">
                  Notification jobs appear when appointments are booked or
                  changed.
                </Empty>
              )}
              <Pagination page={page} total={r.data.total} onChange={setPage} />
            </>
          )
        )}
      </section>
      <p className="fine-print">
        A protected scheduler processes up to 50 due jobs per run. Reminders are
        scheduled 24 hours before the appointment, or immediately when booked
        within 24 hours.
      </p>
    </>
  );
}
