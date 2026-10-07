import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  LockKeyhole,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useApp } from "../context";
import { formatDate, money } from "../lib";
import {
  Badge,
  ConfirmButton,
  ErrorBox,
  Loading,
  PageTitle,
  Pagination,
  useResource,
} from "../ui";

function Checkout({ id, onClose, onPaid }) {
  const { request, business } = useApp();
  const resource = useResource(
    () => request(`/billing/checkout/${id}`),
    [request, id],
  );
  const [step, setStep] = useState("method"),
    [method, setMethod] = useState("approved"),
    [error, setError] = useState(null),
    [seconds, setSeconds] = useState(null);
  const active = useRef(true),
    paying = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!resource.data) return;
    const tick = () =>
      setSeconds(
        Math.max(
          0,
          Math.ceil((new Date(resource.data.expires_at) - Date.now()) / 1000),
        ),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resource.data]);
  async function pay() {
    if (paying.current) return;
    paying.current = true;
    setError(null);
    setStep("processing");
    try {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      if (!active.current) return;
      if (method === "declined") {
        await request(`/billing/checkout/${id}/decline`, { method: "POST" });
        if (active.current) setStep("declined");
      } else {
        await request(`/billing/checkout/${id}/complete`, { method: "POST" });
        if (active.current) {
          setStep("receipt");
          resource.reload();
          onPaid();
        }
      }
    } catch (e) {
      if (active.current) {
        setError(e);
        setStep("review");
        resource.reload();
      }
    } finally {
      paying.current = false;
    }
  }
  function downloadReceipt() {
    const receipt = [
      `STEADLY — SIMULATED RECEIPT`,
      `No money charged. Not a tax invoice.`,
      `Reference: SIM-${id}`,
      `Business: ${business.name}`,
      `Plan: ${resource.data.plan}`,
      `Amount: ${money(resource.data.amount, resource.data.currency)}`,
      `Status: completed`,
      `Checkout created: ${resource.data.created_at}`,
      `Subscription: one month from activation`,
      ``,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([receipt], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `steadly-demo-receipt-${id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  if (resource.loading && step !== "receipt")
    return (
      <section className="panel padded section-gap">
        <Loading />
      </section>
    );
  if (resource.error)
    return (
      <section className="panel padded section-gap">
        <ErrorBox error={resource.error} />
        <button className="btn subtle" onClick={onClose}>
          Back to billing
        </button>
      </section>
    );
  const session = resource.data;
  if (!session) return <Loading />;
  const complete = step === "receipt" || session.status === "completed";
  const expired = !complete && (session.expired || seconds === 0);
  return (
    <section
      className="checkout panel section-gap"
      aria-label="Simulated payment checkout"
    >
      <header className="checkout-header">
        <div>
          <span className="eyebrow">STEADLY CHECKOUT</span>
          <h2>
            {complete
              ? "Your demo payment receipt."
              : "A clearer month starts here."}
          </h2>
        </div>
        <span className="badge">Demo mode</span>
      </header>
      <div className="checkout-steps" aria-label="Checkout progress">
        {["Payment method", "Review", "Receipt"].map((label, i) => (
          <span
            key={label}
            className={
              complete || i === 0 || (i === 1 && step !== "method")
                ? "active"
                : ""
            }
          >
            <b>{complete ? <Check size={13} /> : i + 1}</b>
            {label}
          </span>
        ))}
      </div>
      <ErrorBox error={error} />
      {complete ? (
        <div className="payment-result" role="status">
          <CheckCircle2 size={62} className="payment-success" />
          <h2>Payment simulation successful</h2>
          <p>
            Your checkout is complete. No money was charged. Current
            subscription access is shown in Billing.
          </p>
          <dl>
            <dt>Business</dt>
            <dd>{business.name}</dd>
            <dt>Plan</dt>
            <dd>{session.plan}</dd>
            <dt>Demo amount</dt>
            <dd>{money(session.amount, session.currency)}</dd>
            <dt>Receipt</dt>
            <dd className="receipt-reference">SIM-{id}</dd>
          </dl>
          <div className="actions wrap">
            <button className="btn" onClick={onClose}>
              Return to billing
            </button>
            <button className="btn subtle" onClick={downloadReceipt}>
              <Download size={16} /> Download receipt
            </button>
          </div>
        </div>
      ) : step === "processing" ? (
        <div className="payment-result" role="status" aria-live="polite">
          <div className="payment-orbit">
            <LockKeyhole size={30} />
            <LoaderCircle size={72} className="spin" />
          </div>
          <h2>Processing your demo payment…</h2>
          <p>Checking the checkout and activating your subscription.</p>
          <small>
            Please keep this page open. No financial information is transmitted.
          </small>
        </div>
      ) : expired ? (
        <div className="payment-result">
          <XCircle size={46} />
          <h2>This checkout has expired.</h2>
          <p>
            Return to billing to start a new 30-minute checkout. Your
            subscription was not changed by this expired session.
          </p>
          <button className="btn" onClick={onClose}>
            Back to billing
          </button>
        </div>
      ) : step === "declined" ? (
        <div className="payment-result" role="alert">
          <XCircle size={52} className="payment-declined" />
          <h2>Demo payment declined</h2>
          <p>
            This is the selected simulation outcome. Your subscription was not
            changed, and you can retry this checkout.
          </p>
          <button
            className="btn"
            onClick={() => {
              setMethod("approved");
              setStep("method");
            }}
          >
            Choose another demo method
          </button>
          <button className="btn subtle" onClick={onClose}>
            Cancel checkout
          </button>
        </div>
      ) : (
        <div className="checkout-columns">
          <div>
            {step === "method" ? (
              <>
                <h3>Choose a demo payment method</h3>
                <p className="muted">
                  Use a preconfigured demo method. Do not enter real card or
                  bank details.
                </p>
                <div className="payment-methods">
                  {[
                    [
                      "approved",
                      "Demo card",
                      "Approved · ending 4242",
                      CreditCard,
                    ],
                    [
                      "bank",
                      "Demo bank transfer",
                      "Approved · sandbox account",
                      ShieldCheck,
                    ],
                    [
                      "declined",
                      "Declined demo card",
                      "Exercise a payment failure and retry",
                      XCircle,
                    ],
                  ].map(([value, title, detail, Icon]) => (
                    <label
                      key={value}
                      className={`payment-method ${method === value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="demo-payment-method"
                        value={value}
                        checked={method === value}
                        onChange={() => setMethod(value)}
                      />
                      <Icon size={23} />
                      <span>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <button className="btn full" onClick={() => setStep("review")}>
                  Review subscription
                </button>
              </>
            ) : (
              <>
                <h3>Review your subscription</h3>
                <dl>
                  <dt>Workspace</dt>
                  <dd>{business.name}</dd>
                  <dt>Payment method</dt>
                  <dd>
                    {method === "bank"
                      ? "Demo bank transfer"
                      : method === "declined"
                        ? "Declined demo card"
                        : "Demo card ending 4242"}
                  </dd>
                  <dt>Billing period</dt>
                  <dd>One month from activation</dd>
                  <dt>Renewal</dt>
                  <dd>Manual in simulation mode</dd>
                </dl>
                <p className="fine-print">
                  Confirming starts a new one-month period immediately. There is
                  no automatic renewal or real charge.
                </p>
                <button className="btn full" onClick={pay}>
                  <LockKeyhole size={16} /> Confirm demo payment ·{" "}
                  {money(session.amount, session.currency)}
                </button>
                <button className="text-btn" onClick={() => setStep("method")}>
                  Change payment method
                </button>
              </>
            )}
          </div>
          <aside className="order-summary">
            <ReceiptText size={25} />
            <h3>Order summary</h3>
            <p>{session.plan}</p>
            <div className="order-line">
              <span>Monthly subscription</span>
              <strong>{money(session.amount, session.currency)}</strong>
            </div>
            <div className="order-line total">
              <span>Demo total</span>
              <strong>{money(session.amount, session.currency)}</strong>
            </div>
            <small>No real taxes or payment are collected.</small>
            <p className="fine-print">
              Checkout expires in{" "}
              {seconds === null
                ? "…"
                : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
            </p>
          </aside>
        </div>
      )}
      {!complete &&
        step !== "processing" &&
        !expired &&
        step !== "declined" && (
          <button className="text-btn" onClick={onClose}>
            Cancel and return to billing
          </button>
        )}
    </section>
  );
}

export default function Billing() {
  const { request, business, role, notify } = useApp();
  const r = useResource(() => request("/billing"), [request]);
  const [params, setParams] = useSearchParams(),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const history = useResource(
    () => request(`/billing/history?page=${page}&limit=10`),
    [request, page],
  );
  const checkout = params.get("checkout");
  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await request("/billing/checkout", { method: "POST" });
      setParams({ checkout: data.id });
      history.reload();
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
        description="Your subscription, payment simulation, and checkout history."
      />
      <ErrorBox error={error} />
      <div className="alert">
        Payment simulation only. Use the provided demo methods; no real
        financial details or money are collected.
      </div>
      {checkout && role === "owner" ? (
        <Checkout
          key={business.id + checkout}
          id={checkout}
          onClose={() => {
            setParams({});
            r.reload();
            history.reload();
          }}
          onPaid={() => {
            history.reload();
            notify("Your simulated subscription is active");
          }}
        />
      ) : (
        <div className="detail-grid">
          <section className="panel padded billing-card">
            <CreditCard size={28} />
            <div className="panel-heading compact">
              <h2>Studio Monthly</h2>
              <Badge status={s.status} />
            </div>
            <div className="billing-price">
              {money(r.data.monthly_price, r.data.currency)}{" "}
              <small>USD / month</small>
            </div>
            <ul className="check-list">
              {[
                "Public booking page",
                "Provider availability and calendar",
                "Booking management and client CRM",
                "Confirmation and reminder jobs",
              ].map((item) => (
                <li key={item}>
                  <Check size={16} />
                  {item}
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
            <span className="eyebrow">CLEAR TERMS</span>
            <h2>How access works</h2>
            <dl>
              <dt>Trial</dt>
              <dd>Full access for 14 days.</dd>
              <dt>Active</dt>
              <dd>Full access until the period ends.</dd>
              <dt>Past due</dt>
              <dd>Three days of grace after the period ends.</dd>
              <dt>Cancelled / incomplete</dt>
              <dd>
                Dashboard operations are gated. Billing and your personal
                profile remain accessible.
              </dd>
              <dt>Public bookings</dt>
              <dd>
                Published pages remain available. Pause a page in Settings
                before cancelling if needed.
              </dd>
            </dl>
            <p className="fine-print">
              Payments and renewals are simulated. Webhook state synchronization
              and signatures are enforced by the backend.
            </p>
          </section>
        </div>
      )}
      <section className="panel padded section-gap">
        <h2>Checkout history & receipts</h2>
        <ErrorBox error={history.error} />
        {history.loading ? (
          <Loading />
        ) : (
          history.data && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Checkout</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Demo amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id.slice(0, 8).toUpperCase()}</td>
                        <td>
                          {formatDate(item.created_at, business.timezone)}
                        </td>
                        <td>
                          <Badge
                            status={
                              item.status === "pending" &&
                              new Date(item.expires_at) < new Date()
                                ? "expired"
                                : item.status
                            }
                          />
                        </td>
                        <td>{money(r.data.monthly_price, r.data.currency)}</td>
                        <td>
                          {role === "owner" && (
                            <button
                              className="btn subtle"
                              onClick={() => setParams({ checkout: item.id })}
                            >
                              {item.status === "completed"
                                ? "View receipt"
                                : "Open checkout"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!history.data.items.length && (
                <p className="muted">Your checkout history will appear here.</p>
              )}
              <Pagination
                page={page}
                total={history.data.total}
                limit={10}
                onChange={setPage}
              />
            </>
          )
        )}
      </section>
    </>
  );
}
