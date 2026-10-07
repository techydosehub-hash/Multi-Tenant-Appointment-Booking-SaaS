import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DateTime } from "luxon";
import { ArrowLeft, ArrowRight, Check, Clock, Globe } from "lucide-react";
import { api, formatDate, localDate, money, query } from "../lib";
import {
  Brand,
  Loading,
  ErrorBox,
  Empty,
  Field,
  Badge,
  useResource,
} from "../ui";
export default function Booking() {
  const { slug } = useParams();
  const resource = useResource(() => api(`/public/businesses/${slug}`), [slug]);
  if (resource.loading) return <Loading />;
  if (resource.error)
    return (
      <div className="narrow">
        <Brand />
        <ErrorBox error={resource.error} />
      </div>
    );
  return <BookingFlow key={slug} {...resource.data} />;
}
function BookingFlow({ business, services, providers, mappings }) {
  const [step, setStep] = useState(1),
    [serviceId, setServiceId] = useState(""),
    [providerId, setProviderId] = useState(""),
    [date, setDate] = useState(localDate(business.timezone)),
    [slot, setSlot] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [confirmation, setConfirmation] = useState(null);
  const request = useRef({ key: crypto.randomUUID(), fingerprint: "" });
  const service = services.find((s) => s.id === serviceId),
    eligible = providers.filter((p) =>
      mappings.some(
        (m) => m.provider_id === p.id && m.service_id === serviceId,
      ),
    );
  const slots = useResource(
    () =>
      serviceId
        ? api(
            `/public/businesses/${business.slug}/availability?${query({ service_id: serviceId, provider_id: providerId, date })}`,
          )
        : Promise.resolve([]),
    [serviceId, providerId, date],
  );
  async function submit(e) {
    e.preventDefault();
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const f = new FormData(e.currentTarget);
      const body = {
        service_id: serviceId,
        provider_id: slot.provider_id,
        starts_at: slot.starts_at,
        name: f.get("name"),
        email: f.get("email"),
        phone: f.get("phone"),
        notes: f.get("notes"),
      };
      const fingerprint = JSON.stringify(body);
      if (request.current.fingerprint !== fingerprint)
        request.current = { key: crypto.randomUUID(), fingerprint };
      const data = await api(`/public/businesses/${business.slug}/bookings`, {
        method: "POST",
        body: { ...body, request_key: request.current.key },
      });
      setConfirmation(data);
      setStep(4);
    } catch (e) {
      setError(e);
      if (e.status === 409) {
        setSlot(null);
        setStep(2);
        slots.reload();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="booking-page">
      <header className="booking-header">
        <Brand />
        <span>ONLINE APPOINTMENTS</span>
      </header>
      <div className="booking-layout">
        <aside className="booking-business">
          <span className="business-monogram">{business.name.slice(0, 1)}</span>
          <span className="eyebrow">A LITTLE TIME, JUST FOR YOU</span>
          <h1>{business.name}</h1>
          <p>
            {business.description ||
              "Find your service. Choose your time. We’ll take care of the rest."}
          </p>
          <div className="business-contact">
            <span>
              <Globe size={16} />
              {business.timezone}
            </span>
            {business.email && (
              <a href={`mailto:${business.email}`}>{business.email}</a>
            )}
            {business.phone && (
              <a href={`tel:${business.phone}`}>{business.phone}</a>
            )}
          </div>
          {service && (
            <div className="booking-summary">
              <span className="eyebrow">YOUR APPOINTMENT</span>
              <h3>{service.name}</h3>
              <p>
                {service.duration_minutes} minutes ·{" "}
                {money(service.price, business.currency)}
              </p>
              {slot && (
                <>
                  <strong>
                    {formatDate(slot.starts_at, business.timezone)}
                  </strong>
                  <p>with {slot.provider_name}</p>
                </>
              )}
            </div>
          )}
          <small>Powered by Steadly · A considered booking experience</small>
        </aside>
        <main className="booking-form-panel">
          <div className="steps">
            {["Service", "Your time", "Details"].map((label, i) => (
              <span key={label} className={step >= i + 1 ? "active" : ""}>
                <b>{step > i + 1 ? <Check size={13} /> : i + 1}</b>
                {label}
              </span>
            ))}
          </div>
          <ErrorBox error={error} />
          {step === 1 && (
            <>
              <span className="eyebrow">01 / CHOOSE YOUR SERVICE</span>
              <h2>What brings you in?</h2>
              <p className="muted">A little something to look forward to.</p>
              {services.length === 0 ? (
                <Empty title="Bookings are opening soon">
                  This business hasn’t published its services yet.
                </Empty>
              ) : (
                <div className="service-options">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      className={`service-option ${serviceId === s.id ? "selected" : ""}`}
                      onClick={() => {
                        setServiceId(s.id);
                        setProviderId("");
                        setSlot(null);
                      }}
                    >
                      <div>
                        <h3>{s.name}</h3>
                        <p>{s.description}</p>
                        <small>
                          <Clock size={13} />
                          {s.duration_minutes} minutes
                        </small>
                      </div>
                      <div>
                        <strong>{money(s.price, business.currency)}</strong>
                        <span className="radio-indicator">
                          {serviceId === s.id && <Check size={13} />}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn next"
                disabled={!serviceId}
                onClick={() => setStep(2)}
              >
                Find a time <ArrowRight size={17} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button className="text-btn" onClick={() => setStep(1)}>
                <ArrowLeft size={14} /> Back to services
              </button>
              <h2>Make a little room.</h2>
              <p className="muted">
                All times are in {business.timezone}. Book up to 90 days ahead.
              </p>
              <div className="form-grid">
                <Field label="Preferred provider">
                  <select
                    value={providerId}
                    onChange={(e) => {
                      setProviderId(e.target.value);
                      setSlot(null);
                    }}
                  >
                    <option value="">Any available provider</option>
                    {eligible.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Appointment date"
                  type="date"
                  min={localDate(business.timezone)}
                  max={DateTime.now()
                    .setZone(business.timezone)
                    .plus({ days: 90 })
                    .toISODate()}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSlot(null);
                  }}
                />
              </div>
              <ErrorBox error={slots.error} />
              {slots.loading ? (
                <Loading />
              ) : !slots.data?.length ? (
                <Empty title="No available times on this date">
                  Try another date or provider. Closed and fully booked periods
                  cannot be selected.
                </Empty>
              ) : (
                <div className="slots">
                  {slots.data.map((s) => (
                    <button
                      key={s.starts_at + s.provider_id}
                      className={`slot ${slot?.starts_at === s.starts_at && slot?.provider_id === s.provider_id ? "selected" : ""}`}
                      onClick={() => setSlot(s)}
                    >
                      <strong>
                        {formatDate(s.starts_at, business.timezone, "h:mm a")}
                      </strong>
                      <small>
                        {s.provider_name} ·{" "}
                        {formatDate(s.starts_at, business.timezone, "ZZ")}
                      </small>
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn next"
                disabled={!slot || slots.loading}
                onClick={() => setStep(3)}
              >
                Continue <ArrowRight size={17} />
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button className="text-btn" onClick={() => setStep(2)}>
                <ArrowLeft size={14} /> Back to times
              </button>
              <h2>The finishing details.</h2>
              <p className="muted">
                No account needed. Just a way for the business to reach you.
              </p>
              <form onSubmit={submit}>
                <Field
                  label="Your full name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                />
                <div className="form-grid">
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                  <Field
                    label="Phone number"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
                <Field label="Anything we should know? (optional)">
                  <textarea name="notes" rows={3} maxLength={2000} />
                </Field>
                <p className="fine-print">
                  Your details are shared with {business.name} to manage this
                  appointment. The assessment edition records simulated
                  notifications; it does not send real email or SMS.
                </p>
                <button className="btn full" disabled={busy}>
                  {busy
                    ? "Reserving your time…"
                    : business.requires_approval
                      ? "Request appointment"
                      : "Confirm appointment"}
                  <ArrowRight size={17} />
                </button>
              </form>
            </>
          )}
          {step === 4 && (
            <div className="confirmation">
              <div className="success-icon">
                <Check size={32} />
              </div>
              <span className="eyebrow">TIME WELL RESERVED</span>
              <h2>
                {confirmation.status === "pending"
                  ? "Your request is in."
                  : "You’re on the calendar."}
              </h2>
              <p>
                {confirmation.status === "pending"
                  ? "The business will review your appointment request."
                  : "We’re looking forward to seeing you."}
              </p>
              <Badge status={confirmation.status} />
              <div className="confirmation-details">
                <h3>{service.name}</h3>
                <p>{formatDate(confirmation.starts_at, business.timezone)}</p>
                <p>
                  {business.timezone} · {service.duration_minutes} minutes
                </p>
                <p>{money(confirmation.price, business.currency)}</p>
                <small>Reference: {confirmation.id}</small>
              </div>
              <p className="fine-print">
                A confirmation job has been recorded. Contact the business if
                you need to change or cancel your appointment.
              </p>
              <button
                className="btn subtle"
                onClick={() => {
                  setStep(1);
                  setSlot(null);
                  setConfirmation(null);
                  request.current = {
                    key: crypto.randomUUID(),
                    fingerprint: "",
                  };
                  slots.reload();
                }}
              >
                Book another appointment
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
