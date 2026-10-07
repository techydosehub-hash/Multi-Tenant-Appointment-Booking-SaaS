import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Accept the API origin or the full /api base without producing broken routes.
const configuredApi = (
  import.meta.env.VITE_API_URL || "http://localhost:3001/api"
)
  .trim()
  .replace(/\/+$/, "");
const apiBase = configuredApi.endsWith("/api")
  ? configuredApi
  : `${configuredApi}/api`;
const callbackParams = new URLSearchParams(window.location.search);
const callbackHash = new URLSearchParams(window.location.hash.slice(1));
export const authRedirectError =
  callbackParams.get("error") || callbackHash.get("error")
    ? "Google sign-in was cancelled or could not be completed. Please try again."
    : null;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
export async function api(
  path,
  { method = "GET", body, businessId, signal } = {},
) {
  const session = supabase
    ? (await supabase.auth.getSession()).data.session
    : null;
  const response = await fetch(`${apiBase}${path}`, {
    method,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(businessId ? { "X-Business-Id": businessId } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "The API did not return JSON. Check the backend URL and server.",
    );
  }
  if (!response.ok) {
    const e = new Error(payload.error?.message || "Request failed");
    e.status = response.status;
    e.requestId = payload.error?.request_id;
    throw e;
  }
  return payload.data;
}
export const money = (minor, currency = "INR") =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((minor || 0) / 100);
export const localDate = (zone = "Asia/Kolkata") =>
  DateTime.now().setZone(zone).toISODate();
export const formatDate = (
  iso,
  zone = "Asia/Kolkata",
  format = "dd LLL yyyy, h:mm a",
) => (iso ? DateTime.fromISO(iso).setZone(zone).toFormat(format) : "—");
export const query = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== undefined && v !== null,
    ),
  ).toString();
