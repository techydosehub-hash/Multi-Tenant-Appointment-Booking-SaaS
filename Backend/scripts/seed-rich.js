import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { system, result, userClient } from "../src/db.js";
import { env } from "../src/config.js";

// Explicit setup utility, never run on startup. It creates ONLY this named demo dataset.
// Stable IDs and ignoreDuplicates preserve later edits when a partial seed is resumed.
const namespace = "steadly-demo-v2";
const marker = `[DEMO:${namespace}]`;
const frontend = (
  process.env.DEMO_APP_URL ||
  "https://multi-tenant-appointment-booking-sa.vercel.app"
).replace(/\/$/, "");
const credentialPath = fileURLToPath(new URL("../.env.demo", import.meta.url));
const manifestPath = fileURLToPath(
  new URL("../.demo-seed-manifest.json", import.meta.url),
);
const accessPath = fileURLToPath(
  new URL("../../DEMO_ACCESS.local.md", import.meta.url),
);
dotenv.config({ path: credentialPath });
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : {
      namespace,
      anchorDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      businesses: [],
    };
if (manifest.namespace !== namespace)
  throw new Error("Unexpected demo manifest namespace");
const persist = () =>
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
persist();

const definitions = [
  {
    key: "oak",
    name: "[DEMO] Oak & Form Studio",
    slug: "demo-oak-form",
    state: "active",
    approval: false,
    description:
      "A fictional salon workspace with returning clients, multiple stylists, archived services and a full appointment history.",
    providers: [
      "Maya Kapoor",
      "Rohan Malhotra",
      "Anika Rao",
      "Noah Fernandes",
      "Archived stylist",
    ],
    services: [
      ["Classic haircut", 30, 50000],
      ["Beard design", 30, 30000],
      ["Signature cut & finish", 45, 90000],
      ["Colour consultation", 90, 250000],
      ["Scalp care session", 60, 150000],
      ["Archived bridal styling", 120, 450000],
    ],
  },
  {
    key: "fieldwork",
    name: "[DEMO] Fieldwork Consulting",
    slug: "demo-fieldwork",
    state: "trialing",
    approval: true,
    description:
      "A fictional consultancy using appointment approval, strategy sessions and long architecture reviews.",
    providers: [
      "Aarav Shah",
      "Priya Menon",
      "Kabir Sethi",
      "Isha Desai",
      "Archived consultant",
    ],
    services: [
      ["Strategy introduction", 30, 150000],
      ["Product discovery", 60, 400000],
      ["Architecture review", 90, 750000],
      ["Design clinic", 45, 250000],
      ["Founder mentoring", 30, 120000],
      ["Archived workshop", 120, 1200000],
    ],
  },
  {
    key: "northstar",
    name: "[DEMO] Northstar Wellness",
    slug: "demo-northstar",
    state: "past_due",
    approval: false,
    description:
      "A fictional wellness practice. All customers and notes are dummy examples; no medical information is stored.",
    providers: [
      "Sana Khanna",
      "Dev Patel",
      "Leena Joseph",
      "Arjun Nair",
      "Archived practitioner",
    ],
    services: [
      ["Wellness consultation", 30, 80000],
      ["Movement session", 45, 120000],
      ["Progress follow-up", 15, 50000],
      ["Movement assessment", 60, 200000],
      ["Recovery session", 90, 300000],
      ["Archived group class", 60, 70000],
    ],
  },
  {
    key: "horizon",
    name: "[DEMO] Horizon Photo Studio",
    slug: "demo-horizon",
    state: "cancelled",
    approval: false,
    description:
      "A fictional photography studio demonstrating an inactive subscription with a published public booking page.",
    providers: [
      "Zoya Ali",
      "Neil D'Souza",
      "Tara Bose",
      "Vikram Singh",
      "Archived photographer",
    ],
    services: [
      ["Portrait session", 60, 350000],
      ["Brand photography", 90, 750000],
      ["Professional headshots", 30, 180000],
      ["Shoot consultation", 30, 0],
      ["Print review", 45, 120000],
      ["Archived event coverage", 180, 2500000],
    ],
  },
];
const firstNames = [
  "Aditi",
  "Arjun",
  "Diya",
  "Ishaan",
  "Kavya",
  "Riya",
  "Vihaan",
  "Meera",
  "Ananya",
  "Rahul",
  "Nisha",
  "Karan",
  "Pooja",
  "Siddharth",
  "Neha",
  "Anil",
  "Sara",
  "Rohan",
  "Tanya",
  "Vivek",
];
const lastNames = [
  "Mehta",
  "Sharma",
  "Iyer",
  "Kapoor",
  "Verma",
  "Rao",
  "Patel",
  "Nair",
  "Desai",
  "Bose",
  "Menon",
  "Singh",
];
const uid = (label) => {
  const raw = createHash("sha256")
    .update(`${namespace}:${label}`)
    .digest("hex")
    .slice(0, 32);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-5${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20)}`;
};
const day = (offset) => {
  const d = new Date(`${manifest.anchorDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (date, hour, minute = 0) =>
  new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  ).toISOString();
const shift = (iso, minutes) =>
  new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const passwordVars = definitions
  .map((d) => `DEMO_${d.key.toUpperCase()}_PASSWORD`)
  .concat("DEMO_ADMIN_PASSWORD");
for (const variable of passwordVars)
  if (!process.env[variable])
    process.env[variable] = `Demo-${randomBytes(18).toString("base64url")}!Aa9`;
writeFileSync(
  credentialPath,
  `# Local-only demo credentials. Do not commit.\n${passwordVars.map((v) => `${v}=${process.env[v]}`).join("\n")}\n`,
);

async function insertRows(table, rows, onConflict = "id") {
  for (let i = 0; i < rows.length; i += 150) {
    await result(
      system
        .from(table)
        .upsert(rows.slice(i, i + 150), { onConflict, ignoreDuplicates: true }),
    );
  }
}
const allUsers = [];
for (let page = 1; ; page++) {
  const { data, error } = await system.auth.admin.listUsers({
    page,
    perPage: 100,
  });
  if (error) throw error;
  allUsers.push(...data.users);
  if (data.users.length < 100) break;
}
async function account(email, password) {
  const existing = allUsers.find((u) => u.email?.toLowerCase() === email);
  if (existing) return existing;
  const { data, error } = await system.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Steadly Demo Account", demo_seed: namespace },
  });
  if (error) throw error;
  allUsers.push(data.user);
  return data.user;
}
const realBusinesses = await result(
  system
    .from("businesses")
    .select("id,owner_user_id,name,slug")
    .not("slug", "like", "demo-%"),
);
const realOwners = [...new Set(realBusinesses.map((b) => b.owner_user_id))];
const attachOwner =
  process.env.DEMO_ATTACH_OWNER_ID ||
  (realOwners.length === 1 ? realOwners[0] : null);
if (!attachOwner || !allUsers.some((u) => u.id === attachOwner))
  throw new Error(
    "Set DEMO_ATTACH_OWNER_ID to the existing account UUID; automatic selection requires exactly one real business owner",
  );
manifest.attachedOwnerId = attachOwner;
const adminEmail = "demo.admin@steadly.example.com";
const admin = await account(adminEmail, process.env.DEMO_ADMIN_PASSWORD);

for (let tenantIndex = 0; tenantIndex < definitions.length; tenantIndex++) {
  const def = definitions[tenantIndex];
  const ownerEmail = `demo.${def.key}.owner@steadly.example.com`;
  const owner = await account(
    ownerEmail,
    process.env[`DEMO_${def.key.toUpperCase()}_PASSWORD`],
  );
  let business = await result(
    system.from("businesses").select("*").eq("slug", def.slug).maybeSingle(),
  );
  const newlyCreated = !business;
  if (!business) {
    const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.signInWithPassword({
      email: ownerEmail,
      password: process.env[`DEMO_${def.key.toUpperCase()}_PASSWORD`],
    });
    if (error) throw error;
    const db = userClient(data.session.access_token);
    const businessId = await result(
      db.rpc("create_business", {
        p_name: def.name,
        p_slug: def.slug,
        p_timezone: "Asia/Kolkata",
      }),
    );
    business = await result(
      system.from("businesses").select("*").eq("id", businessId).single(),
    );
    await auth.auth.signOut();
  }
  if (business.owner_user_id !== owner.id)
    throw new Error(
      `Refusing to change ${def.slug}: it belongs to another owner`,
    );
  let entry = manifest.businesses.find((b) => b.slug === def.slug);
  if (!entry) {
    entry = {
      slug: def.slug,
      id: business.id,
      ownerEmail,
      ownerId: owner.id,
      state: def.state,
      complete: false,
    };
    manifest.businesses.push(entry);
    persist();
  }
  // Setup is changed only before the first completed seed; subsequent runs preserve edits.
  if (!entry.complete) {
    await result(
      system
        .from("businesses")
        .update({
          description: `${marker} ${def.description}`,
          email: `contact.${def.key}@steadly.example.com`,
          phone: `+15550100${String(tenantIndex + 1).padStart(3, "0")}`,
          requires_approval: def.approval,
          email_notifications: true,
          sms_notifications: true,
        })
        .eq("id", business.id),
    );
    await result(
      system.from("business_hours").upsert(
        Array.from({ length: 7 }, (_, dow) => ({
          business_id: business.id,
          day_of_week: dow,
          start_time: "09:00",
          end_time: "19:00",
          enabled: dow !== 0,
        })),
        { onConflict: "business_id,day_of_week" },
      ),
    );
  }
  await insertRows(
    "business_members",
    [
      {
        id: uid(`${def.key}:member:existing`),
        business_id: business.id,
        user_id: attachOwner,
        role: "owner",
      },
      ...(tenantIndex === 0
        ? [
            {
              id: uid(`${def.key}:member:admin`),
              business_id: business.id,
              user_id: admin.id,
              role: "admin",
            },
          ]
        : []),
    ],
    "business_id,user_id",
  );
  if (entry.complete) {
    console.log(
      JSON.stringify({
        event: "demo_seed_already_complete",
        business: def.name,
        business_id: business.id,
      }),
    );
    continue;
  }

  const services = def.services.map(([name, duration_minutes, price], i) => ({
    id: uid(`${def.key}:service:${i}`),
    business_id: business.id,
    name,
    description: `${marker} Fictional ${name.toLowerCase()} offering for workflow exploration.`,
    duration_minutes,
    price,
    active: i < 5,
  }));
  const providers = def.providers.map((name, i) => ({
    id: uid(`${def.key}:provider:${i}`),
    business_id: business.id,
    name,
    active: i < 4,
  }));
  await insertRows("services", services);
  await insertRows("providers", providers);
  const mappings = providers.flatMap((p, pi) =>
    services
      .filter((s, si) => (pi < 3 ? si < 5 : pi === 3 ? si < 2 : si === 5))
      .map((s) => ({
        business_id: business.id,
        provider_id: p.id,
        service_id: s.id,
      })),
  );
  await insertRows("provider_services", mappings, "provider_id,service_id");
  const providerHours = providers
    .filter((p) => p.active)
    .flatMap((p, pi) =>
      Array.from({ length: 7 }, (_, dow) => ({
        id: uid(`${def.key}:hours:${pi}:${dow}`),
        business_id: business.id,
        provider_id: p.id,
        day_of_week: dow,
        start_time: pi === 2 ? "10:00" : pi === 3 ? "11:00" : "09:00",
        end_time: pi === 2 ? "17:30" : "19:00",
        enabled: dow !== 0 && !(pi === 1 && dow === 6),
      })),
    );
  await insertRows("provider_hours", providerHours, "provider_id,day_of_week");
  const blocks = [
    {
      id: uid(`${def.key}:block:lunch`),
      business_id: business.id,
      provider_id: providers[0].id,
      starts_at: at(day(2), 13),
      ends_at: at(day(2), 14),
      reason: `${marker} Provider lunch break`,
    },
    {
      id: uid(`${def.key}:block:leave`),
      business_id: business.id,
      provider_id: providers[1].id,
      starts_at: at(day(4), 9),
      ends_at: at(day(4), 12),
      reason: `${marker} Morning leave`,
    },
    {
      id: uid(`${def.key}:block:holiday`),
      business_id: business.id,
      provider_id: null,
      starts_at: at(day(10), 9),
      ends_at: at(day(10), 19),
      reason: `${marker} Whole-business holiday`,
    },
    {
      id: uid(`${def.key}:block:maintenance`),
      business_id: business.id,
      provider_id: providers[2].id,
      starts_at: at(day(7), 14),
      ends_at: at(day(7), 16),
      reason: `${marker} Resource maintenance`,
    },
    {
      id: uid(`${def.key}:block:past`),
      business_id: business.id,
      provider_id: null,
      starts_at: at(day(-65), 9),
      ends_at: at(day(-65), 19),
      reason: `${marker} Historical closure`,
    },
  ];
  await insertRows("blocked_periods", blocks);
  const clients = Array.from({ length: 60 }, (_, i) => ({
    id: uid(`${def.key}:client:${i}`),
    business_id: business.id,
    name: `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) * 3 + (i % 3)]}`,
    email: `demo.customer${String(i + 1).padStart(3, "0")}@example.com`,
    phone: `+155502${String(tenantIndex).padStart(2, "0")}${String(i + 1).padStart(4, "0")}`,
    notes: `${marker} ${["Prefers morning appointments.", "Returning customer; prefers the same provider.", "First consultation completed; schedule a follow-up.", "Prefers a quiet appointment; contact details are fictional.", "Interested in a longer session next visit."][i % 5]} This is fictional sample data.`,
    created_at: at(day(-90 + (i % 25)), 8),
  }));
  await insertRows("clients", clients);
  const bookings = [];
  function appointment(key, date, hour, pi, si, ci, status, type) {
    const starts_at = at(date, hour),
      ends_at = shift(starts_at, services[si].duration_minutes);
    bookings.push({
      id: uid(`${def.key}:booking:${key}`),
      business_id: business.id,
      service_id: services[si].id,
      provider_id: providers[pi].id,
      client_id: clients[ci % clients.length].id,
      starts_at,
      ends_at,
      status,
      price: services[si].price,
      source: "admin",
      customer_notes: `${marker} ${type}. Fictional sample appointment.`,
      request_key: uid(`${def.key}:request:${key}`),
      request_fingerprint: createHash("md5")
        .update(`${namespace}:${def.key}:${key}`)
        .digest("hex"),
      version:
        key.startsWith("future") && Number(key.split(":")[1]) % 13 === 0
          ? 2
          : 1,
      created_at:
        type === "Upcoming appointment"
          ? at(day(-1), 8)
          : shift(starts_at, -7200),
    });
  }
  const historicDays = [];
  for (let offset = -60; offset < 0; offset++)
    if (weekday(day(offset)) !== 0) historicDays.push(day(offset));
  for (let i = 0; i < 160; i++) {
    const date = historicDays[Math.floor(i / 4)];
    let pi = i % 3;
    if (pi === 1 && weekday(date) === 6) pi = 0;
    const status =
      i % 10 === 0 ? "no_show" : i % 7 === 0 ? "cancelled" : "completed";
    appointment(
      `history:${i}`,
      date,
      [10, 12, 14, 16][i % 4],
      pi,
      i % 5,
      i,
      status,
      "Historical appointment",
    );
  }
  // Eight same-day fixtures give the overview a populated business-local day.
  for (let i = 0; i < 8; i++) {
    const hour = [9, 11, 13, 15][Math.floor(i / 2)];
    const starts = at(day(0), hour),
      finish = shift(starts, 30);
    if (new Date(finish) < new Date())
      appointment(
        `today:${i}`,
        day(0),
        hour,
        i % 2,
        i % 2,
        i + 40,
        i === 7 ? "cancelled" : i === 6 ? "no_show" : "completed",
        "Today's historical appointment",
      );
  }
  let futureCount = 0;
  for (let offset = 0; offset <= 45 && futureCount < 80; offset++) {
    const date = day(offset),
      dow = weekday(date);
    if (dow === 0) continue;
    for (const hour of [10, 12, 14, 16]) {
      if (futureCount >= 80) break;
      let pi = futureCount % 3;
      if (pi === 1 && dow === 6) pi = 0;
      const si = futureCount % 5,
        starts_at = at(date, hour),
        ends_at = shift(starts_at, services[si].duration_minutes);
      if (new Date(starts_at) <= new Date()) continue;
      if (
        blocks.some(
          (b) =>
            (!b.provider_id || b.provider_id === providers[pi].id) &&
            b.starts_at < ends_at &&
            b.ends_at > starts_at,
        )
      )
        continue;
      const status =
        futureCount % 11 === 0
          ? "cancelled"
          : def.approval || futureCount % 5 === 0
            ? "pending"
            : "confirmed";
      appointment(
        `future:${futureCount}`,
        date,
        hour,
        pi,
        si,
        futureCount + 20,
        status,
        "Upcoming appointment",
      );
      futureCount++;
    }
  }
  if (futureCount !== 80)
    throw new Error("Could not generate expected number of upcoming fixtures");
  // Historical import cannot use the public endpoint, which correctly rejects past times.
  // These fixture inserts still obey foreign keys, tenant keys and the overlap constraint.
  await insertRows("bookings", bookings);
  const events = bookings.flatMap((b) => {
    const rows = [
      {
        id: uid(`${b.id}:event:created`),
        business_id: business.id,
        booking_id: b.id,
        event_type: "created",
        actor_id: owner.id,
        metadata: {
          demo_seed: namespace,
          source: "seed_import",
          imported_status: b.status,
        },
        created_at: b.created_at,
      },
    ];
    if (["completed", "cancelled", "no_show"].includes(b.status))
      rows.push({
        id: uid(`${b.id}:event:status`),
        business_id: business.id,
        booking_id: b.id,
        event_type: b.status,
        actor_id: owner.id,
        metadata: {
          demo_seed: namespace,
          previous_status: "confirmed",
          version: b.version,
        },
        created_at:
          b.status === "cancelled"
            ? shift(b.starts_at, -60)
            : shift(b.ends_at, 15),
      });
    if (b.version === 2)
      rows.push({
        id: uid(`${b.id}:event:reschedule`),
        business_id: business.id,
        booking_id: b.id,
        event_type: "rescheduled",
        actor_id: owner.id,
        metadata: {
          demo_seed: namespace,
          previous_starts_at: shift(b.starts_at, -1440),
          starts_at: b.starts_at,
          version: 2,
        },
        created_at: shift(b.created_at, 30),
      });
    return rows;
  });
  await insertRows("booking_events", events);
  const reminders = [],
    logs = [];
  bookings.forEach((b, bi) => {
    const past = new Date(b.ends_at) <= new Date();
    for (const channel of ["email", "sms"])
      for (const template of ["confirmation", "reminder"]) {
        const id = uid(`${b.id}:job:${channel}:${template}`);
        const due =
          template === "confirmation"
            ? b.created_at
            : shift(b.starts_at, -1440);
        const isFailed =
          past &&
          b.status !== "cancelled" &&
          bi % 37 === 0 &&
          template === "reminder" &&
          channel === "sms";
        const status =
          b.status === "cancelled"
            ? "skipped"
            : isFailed
              ? "failed"
              : past || template === "confirmation"
                ? "sent"
                : "queued";
        const sent_at = status === "sent" ? due : null;
        reminders.push({
          id,
          business_id: business.id,
          booking_id: b.id,
          channel,
          template,
          booking_version: b.version,
          scheduled_for: due,
          status,
          attempts: status === "sent" ? 1 : isFailed ? 3 : 0,
          sent_at,
          last_error: isFailed
            ? "Demo adapter timeout (fixture; no actual provider call)"
            : null,
        });
        if (status === "sent" || isFailed)
          logs.push({
            id: uid(`${id}:log`),
            business_id: business.id,
            booking_id: b.id,
            reminder_id: id,
            channel,
            template,
            status: isFailed ? "failed" : "simulated",
            provider_message_id: isFailed ? null : `demo_fixture_${id}`,
            error: isFailed ? "Imported fictional provider failure" : null,
            created_at: due,
          });
      }
  });
  await insertRows(
    "reminders",
    reminders,
    "booking_id,channel,template,booking_version",
  );
  await insertRows("notification_logs", logs);
  const billingMarker = `${namespace}:setup:${business.id}`;
  const billingExists = await result(
    system
      .from("billing_events")
      .select("id")
      .eq("id", billingMarker)
      .maybeSingle(),
  );
  if (!billingExists)
    await result(
      system.rpc("apply_billing_event", {
        p_id: billingMarker,
        p_business: business.id,
        p_status: def.state,
        p_period: at(
          day(
            def.state === "past_due"
              ? -1
              : def.state === "cancelled"
                ? -3
                : def.state === "trialing"
                  ? 14
                  : 30,
          ),
          23,
        ),
        p_created: new Date().toISOString(),
      }),
    );
  await insertRows(
    "billing_sessions",
    Array.from({ length: 4 }, (_, i) => ({
      id: uid(`${def.key}:checkout:${i}`),
      business_id: business.id,
      status: i === 0 ? "pending" : i === 1 ? "expired" : "completed",
      expires_at: shift(at(day(i === 0 ? 1 : -10 + i), 12), 30),
      created_at: at(day(i === 0 ? 0 : -10 + i), 12),
    })),
  );
  await insertRows("billing_events", [
    {
      id: `${namespace}:history:${business.id}`,
      business_id: business.id,
      event_type: "demo.imported.billing_history",
      metadata: { demo_seed: namespace, simulated: true },
      created_at: at(day(-15), 12),
    },
  ]);
  Object.assign(entry, {
    complete: true,
    bookings: bookings.length,
    clients: clients.length,
    services: services.length,
    providers: providers.length,
    reminders: reminders.length,
    notificationLogs: logs.length,
    eventCount: events.length,
    bookingUrl: `${frontend}/booking/${def.slug}`,
    day: day(0),
    holiday: day(10),
    lunchBlock: day(2),
  });
  persist();
  console.log(
    JSON.stringify({ event: "demo_seed_business_complete", ...entry }),
  );
}

// Two ended, confirmed appointments let the operator exercise completion and no-show
// immediately. They are imported fixtures, not automated workflow tests.
for (const def of definitions) {
  const entry = manifest.businesses.find((e) => e.slug === def.slug);
  if (entry.practiceAdded) continue;
  const practiceDay = weekday(day(-1)) === 0 ? day(-2) : day(-1);
  const practice = [11, 15].map((hour, i) => ({
    id: uid(`${def.key}:practice:${i}`),
    business_id: entry.id,
    service_id: uid(`${def.key}:service:0`),
    provider_id: uid(`${def.key}:provider:0`),
    client_id: uid(`${def.key}:client:${58 + i}`),
    starts_at: at(practiceDay, hour),
    ends_at: shift(at(practiceDay, hour), def.services[0][1]),
    status: "confirmed",
    price: def.services[0][2],
    source: "admin",
    version: 1,
    customer_notes: `${marker} Hands-on practice: ${i === 0 ? "mark completed" : "mark no-show"}. Imported past appointment intentionally awaiting closure.`,
    request_key: uid(`${def.key}:practice-request:${i}`),
    request_fingerprint: createHash("md5")
      .update(`${namespace}:${def.key}:practice:${i}`)
      .digest("hex"),
    created_at: at(day(-3), 8),
  }));
  await insertRows("bookings", practice);
  await insertRows(
    "booking_events",
    practice.map((b) => ({
      id: uid(`${b.id}:event:created`),
      business_id: entry.id,
      booking_id: b.id,
      event_type: "created",
      actor_id: entry.ownerId,
      created_at: b.created_at,
      metadata: { demo_seed: namespace, source: "seed_import", practice: true },
    })),
  );
  const jobs = practice.flatMap((b) =>
    ["email", "sms"].flatMap((channel) =>
      ["confirmation", "reminder"].map((template) => ({
        id: uid(`${b.id}:job:${channel}:${template}`),
        business_id: entry.id,
        booking_id: b.id,
        channel,
        template,
        booking_version: 1,
        status: "sent",
        attempts: 1,
        scheduled_for:
          template === "confirmation"
            ? b.created_at
            : shift(b.starts_at, -1440),
        sent_at:
          template === "confirmation"
            ? b.created_at
            : shift(b.starts_at, -1440),
      })),
    ),
  );
  await insertRows(
    "reminders",
    jobs,
    "booking_id,channel,template,booking_version",
  );
  await insertRows(
    "notification_logs",
    jobs.map((j) => ({
      id: uid(`${j.id}:log`),
      business_id: entry.id,
      booking_id: j.booking_id,
      reminder_id: j.id,
      channel: j.channel,
      template: j.template,
      status: "simulated",
      provider_message_id: `demo_fixture_${j.id}`,
      created_at: j.sent_at,
    })),
  );
  Object.assign(entry, {
    practiceAdded: true,
    practiceDate: practiceDay,
    practiceBookings: practice.map((b) => b.id),
    bookings: entry.bookings + 2,
    reminders: entry.reminders + jobs.length,
    notificationLogs: entry.notificationLogs + jobs.length,
    eventCount: entry.eventCount + practice.length,
  });
  persist();
}

const access = [
  `# Local-only demo login details`,
  ``,
  `Do not commit this file. Your existing account can access all four demo workspaces through its selector. TechyDose Hub was not modified.`,
  ``,
  `Login: ${frontend}/login`,
  ``,
  `| Role | Email | Password | Workspace |`,
  `|---|---|---|---|`,
  ...definitions.map(
    (d) =>
      `| Dedicated owner | demo.${d.key}.owner@steadly.example.com | ${process.env[`DEMO_${d.key.toUpperCase()}_PASSWORD`]} | ${d.name} |`,
  ),
  `| Admin (no billing changes) | ${adminEmail} | ${process.env.DEMO_ADMIN_PASSWORD} | [DEMO] Oak & Form Studio |`,
  ``,
  `These are disposable, confirmed demo accounts. Notifications and billing remain simulated.`,
  `Passwords are also stored in the ignored Backend/.env.demo file.`,
  `Seed anchor date: ${manifest.anchorDate} (Asia/Kolkata).`,
  ``,
].join("\n");
writeFileSync(accessPath, access);
manifest.completedAt = new Date().toISOString();
persist();
console.log(
  JSON.stringify({
    event: "demo_seed_complete",
    workspaces: manifest.businesses.length,
    appointments: manifest.businesses.reduce((n, b) => n + b.bookings, 0),
    customers: manifest.businesses.reduce((n, b) => n + b.clients, 0),
    credentials_file: "DEMO_ACCESS.local.md",
    manifest_file: "Backend/.demo-seed-manifest.json",
  }),
);
