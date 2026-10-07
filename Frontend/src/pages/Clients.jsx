import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../context";
import { formatDate, money, query } from "../lib";
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  Pagination,
  useResource,
} from "../ui";
import { BookingTable } from "./Bookings";
export function Clients() {
  const { request, business } = useApp();
  const [search, setSearch] = useState(""),
    [input, setInput] = useState(""),
    [page, setPage] = useState(1);
  const r = useResource(
    () => request(`/clients?${query({ search, page })}`),
    [request, search, page],
  );
  return (
    <>
      <PageTitle
        title="People, not just appointments."
        description="The familiar faces and new connections behind your business."
      />
      <form
        className="toolbar search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(input);
          setPage(1);
        }}
      >
        <input
          aria-label="Search clients"
          placeholder="Search name, email, or phone…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={100}
        />
        <button className="btn subtle">Search clients</button>
      </form>
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
                        <th>Client</th>
                        <th>Contact</th>
                        <th>Appointments</th>
                        <th>Lifetime value</th>
                        <th>Next visit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.data.items.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <Link to={`/dashboard/clients/${c.id}`}>
                              <strong>{c.name} ↗</strong>
                            </Link>
                          </td>
                          <td>
                            {c.email}
                            <small>{c.phone}</small>
                          </td>
                          <td>{c.booking_count}</td>
                          <td>{money(c.lifetime_value, business.currency)}</td>
                          <td>
                            {formatDate(c.next_appointment, business.timezone)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="Your next connection starts here">
                  Clients are added automatically when they make a booking.
                </Empty>
              )}
              <Pagination page={page} total={r.data.total} onChange={setPage} />
            </>
          )
        )}
      </section>
    </>
  );
}
export function ClientDetail() {
  const { id } = useParams(),
    { request, business, notify } = useApp();
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const r = useResource(() => request(`/clients/${id}`), [request, id]),
    history = useResource(
      () => request(`/bookings?${query({ client_id: id, page })}`),
      [request, id, page],
    );
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request(`/clients/${id}`, {
        method: "PATCH",
        body: { notes: new FormData(e.currentTarget).get("notes") },
      });
      notify("Private notes saved");
      r.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} />;
  const c = r.data;
  return (
    <>
      <Link className="quiet-link" to="/dashboard/clients">
        ← All clients
      </Link>
      <PageTitle
        eyebrow="CLIENT PROFILE"
        title={c.name}
        description={`${c.email} · ${c.phone}`}
      />
      <div className="metrics three">
        <article className="metric">
          <span>Lifetime value · completed bookings</span>
          <strong>{money(c.lifetime_value, business.currency)}</strong>
        </article>
        <article className="metric">
          <span>Last completed appointment</span>
          <strong className="date-value">
            {formatDate(c.last_appointment, business.timezone)}
          </strong>
        </article>
        <article className="metric">
          <span>Next appointment</span>
          <strong className="date-value">
            {formatDate(c.next_appointment, business.timezone)}
          </strong>
        </article>
      </div>
      <section className="panel padded">
        <h2>The details worth remembering</h2>
        <p className="muted">
          Private business notes. Never visible on the public booking page.
        </p>
        <ErrorBox error={error} />
        <form key={c.notes} onSubmit={save}>
          <Field label="Internal notes">
            <textarea
              name="notes"
              defaultValue={c.notes}
              rows={4}
              maxLength={10000}
            />
          </Field>
          <button className="btn" disabled={busy}>
            {busy ? "Saving…" : "Save notes"}
          </button>
        </form>
      </section>
      <section className="panel section-gap">
        <div className="panel-heading">
          <h2>Appointment history</h2>
          <span>{c.booking_count} total visits booked</span>
        </div>
        <ErrorBox error={history.error} />
        {history.loading ? (
          <Loading />
        ) : (
          history.data && (
            <>
              <BookingTable items={history.data.items} />
              <Pagination
                page={page}
                total={history.data.total}
                onChange={setPage}
              />
            </>
          )
        )}
      </section>
    </>
  );
}
