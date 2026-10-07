import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, UserRound } from "lucide-react";
import { useApp } from "../context";
import { api, formatDate, supabase } from "../lib";
import { Badge, ErrorBox, Field, Loading, PageTitle, useResource } from "../ui";
import TimezoneSelect from "../TimezoneSelect";

export default function Profile() {
  const { refresh, notify, memberships, businessId, setBusinessId, role } =
    useApp();
  const resource = useResource(() => api("/profile"), []);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [resetSent, setResetSent] = useState(false);
  async function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/profile", {
        method: "PATCH",
        body: Object.fromEntries(
          ["full_name", "phone", "bio", "timezone"].map((k) => [
            k,
            form.get(k),
          ]),
        ),
      });
      await refresh();
      resource.reload();
      notify("Your profile has been saved");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        resource.data.email,
        { redirectTo: `${location.origin}/reset-password` },
      );
      if (error) throw error;
      setResetSent(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorBox error={resource.error} />;
  const p = resource.data;
  return (
    <>
      <PageTitle
        title="Your space within the workspace."
        description="Your personal details, account security, and business access."
      />
      <ErrorBox error={error} />
      <div className="detail-grid">
        <section className="panel padded">
          <div className="profile-summary">
            <span className="profile-avatar">
              <UserRound size={30} />
            </span>
            <div>
              <h2>{p.full_name || "Your profile"}</h2>
              <p>{p.email}</p>
              <Badge status={role} />
            </div>
          </div>
          <form onSubmit={save} key={JSON.stringify(p)}>
            <Field
              label="Full name"
              name="full_name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={p.full_name}
              autoComplete="name"
            />
            <Field
              label="Personal contact phone"
              name="phone"
              type="tel"
              maxLength={30}
              defaultValue={p.phone}
              autoComplete="tel"
            />
            <Field label="About you">
              <textarea
                name="bio"
                maxLength={500}
                rows={3}
                defaultValue={p.bio}
              />
            </Field>
            <TimezoneSelect
              label="Personal timezone"
              defaultValue={p.timezone}
            />
            <p className="fine-print">
              Your personal timezone does not change a business schedule. Edit
              the business timezone in Settings.
            </p>
            <button className="btn" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </form>
        </section>
        <section className="panel padded">
          <ShieldCheck size={27} />
          <h2>Account & security</h2>
          <dl>
            <dt>Email</dt>
            <dd>{p.email}</dd>
            <dt>Member since</dt>
            <dd>{formatDate(p.created_at, p.timezone, "dd LLL yyyy")}</dd>
            <dt>Sign-in methods</dt>
            <dd>{p.providers.join(", ") || "Supabase Auth"}</dd>
            <dt>Current role</dt>
            <dd>
              {role === "owner" ? "Business owner" : "Business administrator"}
            </dd>
          </dl>
          <p className="fine-print">
            Roles are assigned per business. Editing this profile cannot change
            your permissions. Email changes are not enabled here.
          </p>
          {resetSent && (
            <p role="status" className="alert">
              Check your email for the password reset link.
            </p>
          )}
          <button
            className="btn subtle"
            disabled={busy || resetSent}
            onClick={resetPassword}
          >
            Send password reset email
          </button>
        </section>
      </div>
      <section className="panel padded section-gap">
        <h2>Your business access</h2>
        <p>Each role applies only to the named workspace.</p>
        <div className="membership-list">
          {memberships.map((m) => (
            <div key={m.business_id}>
              <div>
                <strong>{m.businesses.name}</strong>
                <small>
                  {m.businesses.timezone} ·{" "}
                  {m.role === "owner"
                    ? "Owner · operations and billing"
                    : "Admin · operations; billing read-only"}
                </small>
              </div>
              <Badge status={m.role} />
              {m.business_id === businessId ? (
                <span className="muted">Current workspace</span>
              ) : (
                <button
                  className="btn subtle"
                  onClick={() => {
                    setBusinessId(m.business_id);
                    notify("Workspace switched");
                  }}
                >
                  Switch workspace
                </button>
              )}
            </div>
          ))}
        </div>
        <Link className="quiet-link" to="/dashboard/settings">
          Open business settings →
        </Link>
      </section>
    </>
  );
}
