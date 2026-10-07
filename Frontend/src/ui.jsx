import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, LoaderCircle, X } from "lucide-react";
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">s</span>steadly
      <span className="brand-dot">.</span>
    </Link>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={22} className="spin" /> Getting things ready…
    </div>
  );
}
export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      {error.message || error}
      {error.status === 402 && (
        <>
          {" "}
          <Link to="/dashboard/billing">
            Manage subscription <ArrowUpRight size={14} />
          </Link>
        </>
      )}
      {error.requestId && <small>Reference: {error.requestId}</small>}
    </div>
  );
}
export function Empty({ title = "Nothing here yet", children }) {
  return (
    <div className="empty">
      <CalendarDays size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Badge({ status }) {
  return (
    <span className={`badge ${status}`}>{status?.replaceAll("_", " ")}</span>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function PageTitle({ eyebrow, title, description, children }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow || "YOUR WORKSPACE"}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Pagination({ page, total, limit = 25, onChange }) {
  return (
    <div className="pagination">
      <span>
        {total} records · Page {page} of {Math.max(1, Math.ceil(total / limit))}
      </span>
      <div className="actions">
        <button
          className="btn subtle"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="btn subtle"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function Modal({ title, onClose, children }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("button")?.focus();
    const fn = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const controls = dialog.current?.querySelectorAll(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button
            autoFocus
            className="icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function useResource(loader, deps = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState(null),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(loader)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [...deps, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
export function ConfirmButton({ children, onConfirm, ...props }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <button
      {...props}
      onClick={() => {
        if (confirm) {
          setConfirm(false);
          onConfirm();
        } else setConfirm(true);
      }}
      onBlur={() => setConfirm(false)}
    >
      {confirm ? "Click again to confirm" : children}
    </button>
  );
}
