import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Play, RotateCcw, X, ArrowRight } from "lucide-react";
import { useApp } from "./context";
import { api, supabase } from "./lib";
import { Modal, ErrorBox } from "./ui";

const steps = [
  ["", "Your daily overview", "Today's appointments, upcoming bookings, completed revenue and client totals give you a quick picture of your business.", "Open any appointment to see its details."],
  ["calendar", "Your calendar", "See appointments by day, week or month, in your business timezone. Provider filters help you focus on one person's schedule.", "Switch calendar views and select an appointment."],
  ["bookings", "Manage appointments", "Search and filter bookings, create an appointment, reschedule, confirm pending requests, cancel, or record completed and no-show visits.", "Try rescheduling a future appointment. Changes stay in this private demo."],
  ["clients", "Know your clients", "Each client has a booking history, completed spend and notes. Public bookings automatically link to the right client record.", "Open a client and edit their fictional notes."],
  ["services", "Your service menu", "Define prices and durations, and archive services you no longer offer. Only active services appear on the public booking page.", "Add a sample service or archive an existing one."],
  ["providers", "Your team", "Create providers and assign the services each can deliver. Bookings only offer providers who match the selected service.", "Open a provider and review their service assignments."],
  ["schedule", "Control availability", "Business hours, provider hours and blocked periods determine available slots. Existing bookings prevent overlapping appointments.", "Add a provider break, then compare public availability."],
  ["notifications", "Follow the reminders", "View confirmation and reminder delivery records. Notifications are simulated; no actual emails or SMS messages are sent by these booking workflows.", "Inspect the sample delivery history."],
  ["settings", "Set up your business", "Change business details, timezone, booking approval and notification preferences. These settings apply only to this demo workspace.", "Try approval mode or a different timezone."],
  ["billing", "Explore simulated payments", "Review the subscription and receipts. Checkout includes approved and declined demo methods, processing animation and retry. No money is charged.", "Create a checkout and try both outcomes. Billing remains accessible if you cancel the demo subscription."],
  ["profile", "Your profile and access", "View an example personal profile and the owner role. In demo mode, profile edits are saved separately from your actual account.", "Try editing the sample name. Account password reset is disabled in the demo."],
  ["public", "The customer experience", "Customers choose a service, provider and available time, then enter contact details to request a booking. This page belongs to your private demo business.", "Use an example.com email and fictional details to book a free slot."],
];
export function DemoButton() {
  return <button type="button" className="btn subtle" onClick={() => window.dispatchEvent(new Event("steadly-demo-open"))}><Play size={16} /> Try demo</button>;
}
export default function DemoExperience() {
  const { session, loading, demo, guest, business, businessId, setBusinessId, refresh, notify } = useApp();
  const navigate = useNavigate(), location = useLocation();
  const [invite, setInvite] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const [tour, setTour] = useState(null), [complete, setComplete] = useState(false), [confirmExit, setConfirmExit] = useState(false);
  const active = Boolean(demo?.active);
  const key = `steadly_demo_intro_v1:${session?.user.id || "visitor"}`;
  const eligible = !/^\/(booking\/|auth\/|reset-password)/.test(location.pathname);
  useEffect(() => {
    const open = () => { setError(null); active ? setTour(0) : setInvite(true); };
    window.addEventListener("steadly-demo-open", open);
    return () => window.removeEventListener("steadly-demo-open", open);
  }, [active]);
  useEffect(() => {
    if (!loading && eligible && !active && !localStorage.getItem(key)) setInvite(true);
  }, [loading, eligible, active, key]);
  useEffect(() => {
    if (!active || tour === null || !business?.slug) return;
    const route = steps[tour][0];
    navigate(route === "public" ? `/booking/${business.slug}` : `/dashboard${route ? "/" + route : ""}`);
  }, [tour, active, business?.slug, navigate]);
  useEffect(() => {
    if (tour === null || !active) return;
    const node = document.querySelector(`[data-tour="${steps[tour][0] || "overview"}"]`);
    node?.classList.add("tour-highlight");
    return () => node?.classList.remove("tour-highlight");
  }, [tour, active, location.pathname]);
  useEffect(() => { if (!active) { setTour(null); setComplete(false); setConfirmExit(false); } }, [active]);
  function dismiss() { localStorage.setItem(key, "seen"); setInvite(false); }
  async function start() {
    setBusy(true); setError(null);
    try {
      localStorage.setItem(key, "seen");
      if (session) await api("/demo/start", { method: "POST", body: { return_business_id: businessId || null } });
      else {
        const result = await api("/demo/guest", { method: "POST", body: {} });
        const login = await supabase.auth.setSession(result.session);
        if (login.error) throw login.error;
        localStorage.setItem(`steadly_demo_intro_v1:${login.data.user.id}`, "seen");
      }
      if (!await refresh()) throw new Error("Your demo is ready, but we couldn't reconnect. Please retry.");
      setInvite(false); setTour(0); navigate("/dashboard");
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function exit() {
    setBusy(true); setError(null);
    try {
      const result = await api("/demo/exit", { method: "POST", body: {} });
      setTour(null); setComplete(false); setConfirmExit(false);
      if (guest || result.guest) {
        localStorage.setItem("steadly_demo_intro_v1:visitor", "seen");
        const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
        if (logoutError) throw logoutError;
        navigate("/signup");
      } else {
        setBusinessId(result.return_business_id || "");
        if (!await refresh()) throw new Error("Demo hidden, but we couldn't reload your workspace. Please retry the connection.");
        navigate("/dashboard");
      }
      notify("Demo hidden. Your real business data is unchanged.");
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  function finish() { setTour(null); setComplete(true); navigate("/dashboard"); }
  return <>
    {(eligible || active) && <div className={`demo-controls ${active ? "active" : ""}`}>
      {active ? <><span>Private demo</span><button type="button" onClick={() => setTour(0)}><Play size={15} /> Walkthrough</button><button type="button" onClick={() => { setError(null); setConfirmExit(true); }}><RotateCcw size={15} /> Reset demo</button></> : <DemoButton />}
    </div>}
    {invite && !active && <Modal title="Get to know Steadly" onClose={busy ? () => {} : dismiss}>
      <p>Start with a private demo to see how everything fits together. You'll find a full calendar, clients, services, a team, and sample payments, with a short guided walkthrough.</p>
      <p className="fine-print">No signup is needed. Every visitor gets their own workspace. Your real business records stay separate.</p>
      <ErrorBox error={error} /><div className="actions"><button className="btn" disabled={busy || !supabase} onClick={start}>{busy ? "Preparing your private demo…" : "Start demo & walkthrough"}<ArrowRight size={16} /></button><button className="btn subtle" disabled={busy} onClick={dismiss}>Maybe later</button></div>
    </Modal>}
    {active && tour !== null && <section className="demo-tour" role="region" aria-label="Guided walkthrough" aria-live="polite">
      <div className="demo-tour-heading"><span className="eyebrow">WALKTHROUGH · {tour + 1} / {steps.length}</span><button type="button" aria-label="Finish walkthrough early" onClick={finish}><X size={18} /></button></div>
      <h2>{steps[tour][1]}</h2><p>{steps[tour][2]}</p><p className="demo-tour-tip">Try it: {steps[tour][3]}</p>
      <div className="demo-progress" aria-hidden="true"><span style={{ width: `${(tour + 1) / steps.length * 100}%` }} /></div>
      <div className="actions"><button className="btn subtle" disabled={tour === 0} onClick={() => setTour(tour - 1)}>Back</button><button className="btn" onClick={() => tour === steps.length - 1 ? finish() : setTour(tour + 1)}>{tour === steps.length - 1 ? "Finish walkthrough" : "Next feature"}<ArrowRight size={16} /></button></div>
    </section>}
    {(complete || confirmExit) && active && <Modal title={complete ? "You're ready to explore" : "Return to your own workspace?"} onClose={busy ? () => {} : () => { setComplete(false); setConfirmExit(false); }}>
      <p>Keep exploring freely. Whenever you're ready, click <strong>Reset demo</strong> to hide all sample records and return to your own workspace{guest ? " by creating an account or signing in" : ""}.</p>
      <p className="fine-print">Reset hides the demo; it doesn't delete your real data or erase your demo edits. You can reopen your private demo later from this browser's account. Guest demos stay tied to their guest session.</p>
      <ErrorBox error={error} /><div className="actions"><button className="btn" disabled={busy} onClick={() => { setComplete(false); setConfirmExit(false); }}>Keep exploring</button><button className="btn subtle" disabled={busy} onClick={exit}>{busy ? "Returning…" : "Reset demo now"}</button></div>
    </Modal>}
  </>;
}
