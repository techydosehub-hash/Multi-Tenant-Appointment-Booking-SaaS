import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { system, result } from "./db.js";
import { env } from "./config.js";

// Server-owned Auth app_metadata tracks the demo; user_metadata never grants access.
// Each user gets a separate, ordinary RLS-protected tenant. Never copy real customer data.
const pending = new Map();
export const legacyDemoIds = new Set([
  "b267b0c1-2253-4c16-84b3-02e3bdcaabfa",
  "63f73960-72d2-4551-b023-aa8082556fb8",
  "d4873689-3433-44ef-a133-5f08ec1b5045",
  "27eaece3-1524-4ae7-bf4b-f610225c5556",
]);
export const demoState = (user) => user.app_metadata?.steadly_demo || null;
export const isGuest = (user) => user.app_metadata?.demo_guest === true;
export const demoProfile = (user) => ({
  id: user.id, email: "visitor@example.com", created_at: user.created_at,
  last_sign_in_at: user.last_sign_in_at, providers: ["demo"],
  full_name: "Demo visitor", phone: "+91 90000 00000", bio: "A fictional profile for exploring Steadly.",
  timezone: "Asia/Kolkata", ...demoState(user)?.profile,
});
export async function saveDemoState(user, state) {
  const { data, error } = await system.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, steadly_demo: state },
  });
  if (error) throw error;
  return data.user;
}
function id(userId, label) {
  const h = createHash("sha256").update(`steadly-private-demo-v1:${userId}:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function insert(table, rows, onConflict = "id") {
  if (rows.length) await result(system.from(table).upsert(rows, { onConflict, ignoreDuplicates: true }));
}
async function provision(user, returnBusinessId) {
  const businessId = id(user.id, "business"), previous = demoState(user);
  let business = await result(system.from("businesses").select("*").eq("id", businessId).maybeSingle());
  if (business && business.owner_user_id !== user.id) throw new Error("Invalid demo ownership");
  if (!business) {
    await insert("businesses", [{ id: businessId, owner_user_id: user.id,
      name: "[DEMO] Your Studio", slug: `demo-${user.id.replaceAll("-", "")}`,
      description: "Your private fictional workspace. Explore freely; no real payments or messages.",
      timezone: "Asia/Kolkata", currency: "INR", email: "studio@example.com", phone: "+91 90000 00001",
      email_notifications: true, sms_notifications: true,
    }]);
    business = await result(system.from("businesses").select("*").eq("id", businessId).single());
  }
  await insert("business_members", [{ business_id: businessId, user_id: user.id, role: "owner" }], "business_id,user_id");
  // A failed/partial seed resumes safely. A ready demo preserves visitors' edits.
  if (!previous?.ready) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(business.created_at));
    const anchor = Date.parse(`${date}T03:30:00Z`);
    const stamp = (days, hours = 0) => new Date(anchor + days * 86400000 + hours * 3600000).toISOString();
    const definitions = [["Classic haircut", 30, 50000], ["Signature styling", 45, 90000], ["Colour consultation", 90, 250000], ["Scalp care", 60, 150000], ["Beard design", 30, 30000], ["Archived bridal styling", 120, 450000]];
    const services = definitions.map(([name, duration_minutes, price], i) => ({ id: id(user.id, `service-${i}`), business_id: businessId, name, description: "Fictional service — prices are examples.", duration_minutes, price, active: i !== 5 }));
    const providers = ["Maya Kapoor", "Rohan Malhotra", "Anika Rao", "Noah Fernandes"].map((name, i) => ({ id: id(user.id, `provider-${i}`), business_id: businessId, name }));
    const names = ["Aditi", "Arjun", "Diya", "Ishaan", "Kavya", "Riya", "Vihaan", "Meera", "Ananya", "Rahul"];
    const clients = Array.from({ length: 40 }, (_, i) => ({ id: id(user.id, `client-${i}`), business_id: businessId, name: `${names[i % 10]} ${["Mehta", "Sharma", "Iyer", "Patel"][Math.floor(i / 10)]}`, email: `demo.client${i + 1}@example.com`, phone: `+91 90000 ${String(i + 100).padStart(5, "0")}`, notes: "Fictional returning client. No real personal information." }));
    await insert("services", services); await insert("providers", providers);
    await insert("provider_services", providers.flatMap(p => services.filter(s => s.active).map(s => ({ business_id: businessId, provider_id: p.id, service_id: s.id }))), "provider_id,service_id");
    await insert("business_hours", Array.from({ length: 7 }, (_, d) => ({ business_id: businessId, day_of_week: d, start_time: "09:00", end_time: "18:00", enabled: true })), "business_id,day_of_week");
    await insert("provider_hours", providers.flatMap(p => Array.from({ length: 7 }, (_, d) => ({ business_id: businessId, provider_id: p.id, day_of_week: d, start_time: "09:00", end_time: "18:00", enabled: true }))), "provider_id,day_of_week");
    await insert("blocked_periods", [{ id: id(user.id, "block"), business_id: businessId, provider_id: providers[0].id, starts_at: stamp(2, 3), ends_at: stamp(2, 4), reason: "Demo lunch break" }]);
    await insert("clients", clients);
    const bookings = [];
    for (let day = -12; day <= 10; day++) for (let i = 0; i < 8; i++) {
      const n = (day + 12) * 8 + i, service = services[n % 5];
      const starts_at = stamp(day, i < 4 ? 0 : 5), past = Date.parse(starts_at) < Date.now();
      bookings.push({ id: id(user.id, `booking-${n}`), business_id: businessId, service_id: service.id,
        provider_id: providers[i % 4].id, client_id: clients[n % 40].id, starts_at,
        ends_at: new Date(Date.parse(starts_at) + service.duration_minutes * 60000).toISOString(),
        status: n % 11 === 0 ? "cancelled" : past ? (n % 9 === 0 ? "no_show" : "completed") : (n % 7 === 0 ? "pending" : "confirmed"),
        price: service.price, source: "admin", request_key: id(user.id, `request-${n}`), request_fingerprint: `private-demo-${n}`, customer_notes: "Fictional demo appointment", created_at: stamp(day - 3),
      });
    }
    await insert("bookings", bookings);
    await insert("booking_events", bookings.map((b, i) => ({ id: id(user.id, `event-${i}`), business_id: businessId, booking_id: b.id, actor_id: user.id, event_type: "created", metadata: { simulated: true }, created_at: b.created_at })));
    const reminders = bookings.map((b, i) => ({ id: id(user.id, `reminder-${i}`), business_id: businessId, booking_id: b.id, channel: "email", template: "confirmation", booking_version: 1, scheduled_for: b.created_at, status: "sent", attempts: 1, sent_at: b.created_at }));
    await insert("reminders", reminders);
    await insert("notification_logs", reminders.map((r, i) => ({ id: id(user.id, `log-${i}`), business_id: businessId, booking_id: r.booking_id, reminder_id: r.id, channel: r.channel, template: r.template, status: "simulated", provider_message_id: `mock_demo_${r.id}`, created_at: r.sent_at })));
    await insert("subscriptions", [{ business_id: businessId, provider_customer_id: `demo_${businessId}`, status: "active", current_period_end: stamp(365) }], "business_id");
    await insert("billing_sessions", [{ id: id(user.id, "checkout"), business_id: businessId, status: "completed", created_at: stamp(-2), expires_at: stamp(-2, 1) }]);
    await insert("billing_events", [{ id: `private_demo_${businessId}`, business_id: businessId, event_type: "simulation.subscription.active", metadata: { simulated: true }, created_at: stamp(-2) }]);
  }
  let returnId = previous?.return_business_id || null;
  if (returnBusinessId && returnBusinessId !== businessId && !legacyDemoIds.has(returnBusinessId)) {
    const member = await result(system.from("business_members").select("business_id").eq("user_id", user.id).eq("business_id", returnBusinessId).maybeSingle());
    if (member) returnId = member.business_id;
  }
  const state = { ...previous, business_id: businessId, active: true, ready: true, return_business_id: returnId };
  await saveDemoState(user, state);
  return state;
}
export async function startDemo(user, returnBusinessId) {
  if (pending.has(user.id)) return pending.get(user.id);
  const job = provision(user, returnBusinessId);
  pending.set(user.id, job);
  try { return await job; } finally { pending.delete(user.id); }
}
export async function createGuestDemo() {
  const password = randomBytes(36).toString("base64url");
  const email = `guest.${randomBytes(16).toString("hex")}@steadly-demo.invalid`;
  const { data, error } = await system.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { demo_guest: true }, user_metadata: { full_name: "Demo visitor" } });
  if (error) throw error;
  const demo = await startDemo(data.user, null);
  // A separate client keeps the global service-role client free of guest session state.
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await auth.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return { demo, session: { access_token: login.data.session.access_token, refresh_token: login.data.session.refresh_token } };
}
