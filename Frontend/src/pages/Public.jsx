import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  Users,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../context";
import { api, supabase, configured, authRedirectError } from "../lib";
import { Brand, Field, ErrorBox, Loading } from "../ui";
export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#features">Why Steadly</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="actions">
          <Link className="quiet-link" to="/login">
            Log in
          </Link>
          <Link className="btn small" to="/signup">
            Start your workspace <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> LESS ADMIN. MORE POSSIBILITY.
            </div>
            <h1>
              Good work
              <br />
              deserves a<br />
              <em>clear calendar.</em>
            </h1>
            <p>
              One calm place for your appointments, your clients, and the
              business you’re building.
            </p>
            <div className="actions">
              <Link className="btn" to="/signup">
                Make room for better work <ArrowRight size={18} />
              </Link>
            </div>
            <div className="hero-footnote">
              <Check size={15} /> 14-day trial <span>·</span> No card required{" "}
              <span>·</span> Set up in minutes
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-caption">A LITTLE LOOK AT A LIGHTER DAY</div>
            <div className="preview-window">
              <div className="preview-header">
                <span className="mini-logo">s.</span>
                <span>The daily edit</span>
                <span className="badge confirmed">Illustrative preview</span>
              </div>
              <div className="preview-title">
                <div>
                  <small>YOUR DAY, AT A GLANCE</small>
                  <h2>Room to do your best.</h2>
                </div>
                <CalendarDays size={26} />
              </div>
              <div className="preview-days">
                {["M", "T", "W", "T", "F"].map((d, i) => (
                  <div key={i} className={i === 2 ? "selected" : ""}>
                    <small>{d}</small>
                    <strong>{12 + i}</strong>
                  </div>
                ))}
              </div>
              <div className="preview-appointment">
                <time>09:00</time>
                <div>
                  <strong>A fresh start</strong>
                  <span>Consultation · 45 min</span>
                </div>
                <span className="appointment-dot" />
              </div>
              <div className="preview-appointment">
                <time>10:30</time>
                <div>
                  <strong>A little time for you</strong>
                  <span>Signature appointment · 60 min</span>
                </div>
                <span className="appointment-dot" />
              </div>
              <div className="preview-gap">11:30 — A little breathing room</div>
              <div className="preview-appointment">
                <time>13:00</time>
                <div>
                  <strong>Back to what you love</strong>
                  <span>Follow-up · 30 min</span>
                </div>
                <span className="appointment-dot" />
              </div>
            </div>
            <div className="floating-note">
              <span>
                <Check size={20} />
              </span>
              <div>
                <strong>Consider it taken care of.</strong>
                <small>Bookings, reminders, and the details.</small>
              </div>
            </div>
          </div>
        </section>
        <div className="audience-strip">
          <span>MADE FOR PEOPLE WHO WORK WITH PEOPLE</span>
          <p>
            Studios <i>✳</i> Salons <i>✳</i> Consultants <i>✳</i> Clinics{" "}
            <i>✳</i> Independents
          </p>
        </div>
        <section className="landing-section" id="features">
          <span className="eyebrow">THE ESSENTIALS, THOUGHT THROUGH</span>
          <h2>Everything in its right place.</h2>
          <div className="feature-grid">
            {[
              [
                CalendarDays,
                "A calendar that makes sense",
                "Working hours, provider schedules, and protected appointment slots. Built around the way you work.",
              ],
              [
                Users,
                "Remember the person",
                "Contact details, private notes, appointment history, and lifetime value in one considered client record.",
              ],
              [
                Clock,
                "The follow-through, handled",
                "Confirmation and reminder jobs keep every booking accounted for, with a clear delivery record.",
              ],
            ].map(([Icon, title, desc]) => (
              <article key={title}>
                <Icon size={26} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="how-section" id="how">
          <div>
            <span className="eyebrow">FROM SETUP TO YOUR FIRST BOOKING</span>
            <h2>
              A simpler way
              <br />
              to fill your day.
            </h2>
            <p>
              You take care of your craft.
              <br />
              We’ll make space for the rest.
            </p>
          </div>
          <div>
            {[
              [
                "01",
                "Make it yours",
                "Add your business, services, and the people behind them.",
              ],
              [
                "02",
                "Set your rhythm",
                "Choose working hours and block out the time you need.",
              ],
              [
                "03",
                "Share your link",
                "Give clients a straightforward way to find their next appointment.",
              ],
            ].map(([n, t, d]) => (
              <article key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="pricing-section" id="pricing">
          <div>
            <span className="eyebrow">ONE PLAN. ALL THE ESSENTIALS.</span>
            <h2>
              Small overhead.
              <br />
              More headspace.
            </h2>
            <p>
              Start with a 14-day trial. The assessment edition uses simulated
              billing and notifications.
            </p>
          </div>
          <div className="price-card">
            <span className="eyebrow">STUDIO MONTHLY</span>
            <h3>
              $19 <small>/ month</small>
            </h3>
            <ul>
              {[
                "Services & provider scheduling",
                "Public booking page",
                "Client records & booking history",
                "Reminder jobs & delivery records",
                "Tenant-isolated workspace",
              ].map((x) => (
                <li key={x}>
                  <Check size={16} />
                  {x}
                </li>
              ))}
            </ul>
            <Link className="btn full" to="/signup">
              Start your workspace <ArrowRight size={17} />
            </Link>
            <small>Simulation only. No money is charged.</small>
          </div>
        </section>
        <section className="closing">
          <ShieldCheck size={25} />
          <h2>Your business. Your own space.</h2>
          <p>
            Every workspace is protected by database-level tenant access rules.
          </p>
          <Link className="btn" to="/signup">
            Let’s make room <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Considered scheduling for independent businesses.</span>
        <span>© {new Date().getFullYear()} Steadly</span>
      </footer>
    </div>
  );
}
export function Auth({ signup = false }) {
  const { session } = useApp(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [email, setEmail] = useState("");
  if (session) return <Navigate to="/dashboard" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!configured)
        throw new Error(
          "Add the Supabase environment variables before signing in.",
        );
      const f = new FormData(e.currentTarget);
      const credentials = { email, password: f.get("password") };
      const { data, error } = signup
        ? await supabase.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: `${location.origin}/dashboard` },
          })
        : await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (signup && !data.session)
        setMessage(
          "Check your email to confirm your account, then sign in to create your business.",
        );
      else navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function forgot() {
    setBusy(true);
    setError("");
    try {
      if (!supabase) throw new Error("Configure Supabase first");
      if (!email) throw new Error("Enter your email address first");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage(
        "If that account exists, a password reset link is on its way.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function continueWithGoogle() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!configured)
        throw new Error("Configure Supabase before continuing with Google.");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
      // Supabase redirects the browser to Google. Both signup and login use this flow.
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE MORE ROOM</span>
          <h1>
            Your next chapter,
            <br />
            <em>well scheduled.</em>
          </h1>
          <p>A quieter way to run the business you care about.</p>
        </div>
        <small>Appointments. Clients. Possibility.</small>
      </div>
      <div className="auth-form">
        <Link to="/" className="quiet-link">
          ← Back to Steadly
        </Link>
        <h1>{signup ? "Make yourself at home." : "Welcome back."}</h1>
        <p>
          {signup
            ? "Create your account. Your workspace comes next."
            : "A clear view of your day is waiting."}
        </p>
        <ErrorBox error={error} />
        {message && (
          <div className="alert" role="status">
            {message}
          </div>
        )}
        <button
          type="button"
          className="btn subtle full google-button"
          disabled={busy}
          onClick={continueWithGoogle}
        >
          <span className="google-mark" aria-hidden="true">
            G
          </span>
          Continue with Google
        </button>
        <div className="auth-divider">
          <span>or continue with email</span>
        </div>
        <form onSubmit={submit}>
          <Field
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          <button className="btn full" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        {!signup && (
          <button className="text-btn" onClick={forgot} disabled={busy}>
            Forgot your password?
          </button>
        )}
        <p className="auth-alternate">
          {signup ? "Already have a workspace?" : "New around here?"}{" "}
          <Link to={signup ? "/login" : "/signup"}>
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(authRedirectError);
  useEffect(() => {
    let active = true;
    async function finish() {
      try {
        if (authRedirectError) return;
        if (!supabase) throw new Error("Configure Supabase before signing in.");
        // This SPA uses the SDK's default browser flow: it consumes the callback hash
        // during initialization. getSession awaits that initialization; no second exchange.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session)
          throw new Error(
            "No sign-in session was received. Check the Google provider and allowed redirect URLs in Supabase, then try again.",
          );
        if (active) navigate("/dashboard", { replace: true });
      } catch (error) {
        if (active) setError(error.message);
      }
    }
    finish();
    return () => {
      active = false;
    };
  }, [navigate]);
  return (
    <div className="narrow">
      <Brand />
      {error ? (
        <>
          <h1>Let’s try that again.</h1>
          <ErrorBox error={error} />
          <Link className="btn" to="/login" replace>
            Back to sign in
          </Link>
        </>
      ) : (
        <Loading />
      )}
    </div>
  );
}
export function Onboarding() {
  const { session, loading, refresh, setBusinessId } = useApp(),
    navigate = useNavigate();
  const [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget);
      const created = await api("/businesses", {
        method: "POST",
        body: { name, slug, timezone: f.get("timezone") },
      });
      setBusinessId(created.id);
      await refresh();
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow onboarding">
      <Brand />
      <span className="eyebrow">YOUR BUSINESS STARTS HERE</span>
      <h1>Let’s make it yours.</h1>
      <p>
        Choose a name and a public address. You can fine-tune your workspace
        anytime.
      </p>
      <ErrorBox error={error} />
      <form onSubmit={submit}>
        <Field
          label="Business name"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSlug(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
            );
          }}
        />
        <Field
          label="Booking page slug"
          required
          minLength={3}
          maxLength={64}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <small>Your link: /booking/{slug || "your-business"}</small>
        <Field
          label="Business timezone"
          name="timezone"
          defaultValue="Asia/Kolkata"
          required
          list="timezones"
        />
        <datalist id="timezones">
          {Intl.supportedValuesOf("timeZone").map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button className="btn full" disabled={busy}>
          {busy ? "Creating workspace…" : "Create workspace"}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="muted">
        Includes a 14-day trial. Billing and notifications are simulated.
      </p>
    </div>
  );
}
export function ResetPassword() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: new FormData(e.currentTarget).get("password"),
      });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <Brand />
      <h1>A fresh start.</h1>
      <ErrorBox error={error} />
      {done ? (
        <>
          <p>Password updated.</p>
          <Link className="btn" to="/dashboard">
            Open workspace
          </Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <Field
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button className="btn" disabled={busy}>
            Update password
          </button>
        </form>
      )}
    </div>
  );
}
