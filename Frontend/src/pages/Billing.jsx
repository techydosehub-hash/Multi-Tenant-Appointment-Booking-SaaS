import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, CreditCard } from "lucide-react";
import { useApp } from "../context";
import { formatDate } from "../lib";
import {
  Badge,
  ConfirmButton,
  ErrorBox,
  Loading,
  PageTitle,
  useResource,
} from "../ui";
export default function Billing() {
  const { request, business, role, notify } = useApp();
  const r = useResource(() => request("/billing"), [request]);
  const [params, setParams] = useSearchParams(),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const checkout = params.get("checkout");
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const data = await request("/billing/checkout", { method: "POST" });
      setParams({ checkout: data.id });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    setBusy(true);
    setError(null);
    try {
      await request(`/billing/checkout/${checkout}/complete`, {
        method: "POST",
      });
      setParams({});
      r.reload();
      notify("Simulated subscription activated for one month");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await request("/billing/cancel", { method: "POST" });
      r.reload();
      notify("Subscription cancelled");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} />;
  const s = r.data.subscription;
  return (
    <>
      <PageTitle
        title="A little investment in a calmer day."
        description="Your workspace subscription, with everything in one place."
      />
      <ErrorBox error={error} />
      <div className="alert">
        Assessment simulation: no card details, no payment collection, and no
        real charges.
      </div>
      <div className="detail-grid">
        <section className="panel padded billing-card">
          <CreditCard size={28} />
          <div className="panel-heading compact">
            <h2>Studio Monthly</h2>
            <Badge status={s.status} />
          </div>
          <div className="billing-price">
            $19 <small>USD / month</small>
          </div>
          <ul className="check-list">
            {[
              "Public booking page",
              "Services and provider availability",
              "Calendar and booking management",
              "Client CRM and private notes",
              "Confirmation and reminder jobs",
            ].map((t) => (
              <li key={t}>
                <Check size={16} />
                {t}
              </li>
            ))}
          </ul>
          <p>
            Current period ends:{" "}
            <strong>
              {formatDate(s.current_period_end, business.timezone)}
            </strong>
          </p>
          {role === "owner" ? (
            <div className="actions wrap">
              <button className="btn" disabled={busy} onClick={start}>
                {s.status === "active"
                  ? "Renew / restart simulation"
                  : "Start monthly subscription"}
              </button>
              {s.status !== "cancelled" && (
                <ConfirmButton
                  className="btn danger"
                  disabled={busy}
                  onConfirm={cancel}
                >
                  Cancel subscription
                </ConfirmButton>
              )}
            </div>
          ) : (
            <p className="muted">Ask the business owner to manage billing.</p>
          )}
        </section>
        <section className="panel padded">
          <span className="eyebrow">CLEAR TERMS, NO SURPRISES</span>
          <h2>How access works</h2>
          <dl>
            <dt>Trial</dt>
            <dd>14 days of full dashboard access.</dd>
            <dt>Active</dt>
            <dd>Full access until the current period expires.</dd>
            <dt>Past due</dt>
            <dd>Three days of grace after the period end.</dd>
            <dt>Cancelled / incomplete</dt>
            <dd>
              Premium dashboard access stops immediately. Billing remains
              accessible.
            </dd>
            <dt>Public appointments</dt>
            <dd>
              Published booking pages continue accepting appointments so
              customers are not disrupted. Pause your page before cancelling if
              needed.
            </dd>
          </dl>
          <p className="fine-print">
            The simulation does not automatically charge or renew. Use checkout
            to begin a new one-month period. Signed webhook simulation is
            documented for lifecycle exercises.
          </p>
        </section>
      </div>
      {checkout && role === "owner" && (
        <section className="panel padded section-gap">
          <span className="eyebrow">SIMULATED CHECKOUT</span>
          <h2>Ready for a clearer month?</h2>
          <p>
            Activate Studio Monthly for this business. This starts a one-month
            simulated subscription period immediately.
          </p>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={complete}>
              {busy ? "Activating…" : "Confirm simulated subscription"}
            </button>
            <button
              className="btn subtle"
              disabled={busy}
              onClick={() => setParams({})}
            >
              Go back
            </button>
          </div>
        </section>
      )}
    </>
  );
}
