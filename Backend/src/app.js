import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { env } from "./config.js";
import { system, userClient, result } from "./db.js";
import * as v from "./validation.js";
import { processNotifications } from "./notifications.js";
import { startDemo, demoState, demoProfile, saveDemoState, isGuest, legacyDemoIds } from "./demo.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.VERCEL ? 1 : env.TRUST_PROXY);
app.use(helmet());
app.use(
  cors({
    origin: env.APP_URL,
    allowedHeaders: ["Content-Type", "Authorization", "X-Business-Id"],
    exposedHeaders: ["X-Request-Id"],
  }),
);
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.set("X-Request-Id", req.requestId);
  res.set("Cache-Control", "no-store");
  const start = Date.now();
  res.on("finish", () =>
    console.log(
      JSON.stringify({
        event: "request",
        request_id: req.requestId,
        method: req.method,
        route: req.route?.path || "unmatched",
        status: res.statusCode,
        duration_ms: Date.now() - start,
      }),
    ),
  );
  next();
});
const ok = (res, data, status = 200) => res.status(status).json({ data });
const fail = (status, message) => Object.assign(new Error(message), { status });
const paginate = (req) => {
  const p = v.page.parse(req.query);
  return { ...p, from: (p.page - 1) * p.limit, to: p.page * p.limit - 1 };
};

// Raw bytes are required for signatures; register before express.json().
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json", limit: "32kb" }),
  async (req, res) => {
    const timestamp = req.get("x-billing-timestamp");
    const signature = req.get("x-billing-signature") || "";
    if (
      !timestamp ||
      !/^\d+$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      !Buffer.isBuffer(req.body)
    )
      throw fail(401, "Invalid webhook signature");
    const expected = createHmac("sha256", env.BILLING_WEBHOOK_SECRET)
      .update(`${timestamp}.`)
      .update(req.body)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
      throw fail(401, "Invalid webhook signature");
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      throw fail(400, "Malformed JSON");
    }
    const e = v.webhook.parse(payload);
    if (new Date(e.created_at).getTime() > Date.now() + 300000)
      throw fail(400, "Event timestamp is in the future");
    ok(
      res,
      await result(
        system.rpc("apply_billing_event", {
          p_id: e.id,
          p_business: e.business_id,
          p_status: e.status,
          p_period: e.current_period_end,
          p_created: e.created_at,
        }),
      ),
    );
  },
);
app.use(express.json({ limit: "32kb" }));
app.get("/api/health", (_req, res) =>
  ok(res, { status: "ok", billing: "simulation", notifications: "mock" }),
);
app.get("/api/health/ready", async (_req, res) => {
  // Inspect metadata without reading customer rows or changing remote data.
  const checks = await Promise.all([
    system
      .from("business_members")
      .select("business_id,role,businesses(id)", { head: true })
      .limit(0),
    system.from("client_metrics").select("id", { head: true }).limit(0),
  ]);
  const issue = checks.find((check) => check.error);
  if (issue) throw issue.error;
  ok(res, { status: "ready", database: "available" });
});
app.get("/api/jobs/reminders", async (req, res) => {
  const token = req.get("authorization") || "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    throw fail(401, "Invalid job credentials");
  ok(res, await processNotifications());
});

const publicRouter = express.Router();
publicRouter.use(
  rateLimit({
    windowMs: 60000,
    limit: 90,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again in a minute.",
          request_id: req.requestId,
        },
      }),
  }),
);
publicRouter.use("/businesses/:slug", async (req, _res, next) => {
  const slug = v.slug.parse(req.params.slug);
  req.business = await result(
    system
      .from("businesses")
      .select(
        "id,name,slug,description,timezone,currency,phone,email,status,requires_approval",
      )
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle(),
  );
  if (!req.business) throw fail(404, "This booking page is not available");
  next();
});
publicRouter.get("/businesses/:slug", async (req, res) => {
  const [services, providers, mappings] = await Promise.all([
    result(
      system
        .from("services")
        .select("id,name,description,duration_minutes,price")
        .eq("business_id", req.business.id)
        .eq("active", true)
        .order("name"),
    ),
    result(
      system
        .from("providers")
        .select("id,name")
        .eq("business_id", req.business.id)
        .eq("active", true)
        .order("name"),
    ),
    result(
      system
        .from("provider_services")
        .select("provider_id,service_id")
        .eq("business_id", req.business.id),
    ),
  ]);
  ok(res, { business: req.business, services, providers, mappings });
});
publicRouter.get("/businesses/:slug/services", async (req, res) =>
  ok(
    res,
    await result(
      system
        .from("services")
        .select("id,name,description,duration_minutes,price")
        .eq("business_id", req.business.id)
        .eq("active", true)
        .order("name"),
    ),
  ),
);
publicRouter.get("/businesses/:slug/availability", async (req, res) => {
  const q = z
    .object({ service_id: v.id, provider_id: v.id.optional(), date: v.date })
    .parse(req.query);
  ok(
    res,
    await result(
      system.rpc("available_slots", {
        p_business: req.business.id,
        p_service: q.service_id,
        p_date: q.date,
        p_provider: q.provider_id || null,
      }),
    ),
  );
});
publicRouter.post(
  "/businesses/:slug/bookings",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: {
          message: "Too many booking attempts. Try again in a minute.",
          request_id: req.requestId,
        },
      }),
  }),
  async (req, res) => {
    const b = v.booking.parse(req.body);
    const data = await result(
      system.rpc("create_booking", {
        p_business: req.business.id,
        p_service: b.service_id,
        p_provider: b.provider_id,
        p_starts: b.starts_at,
        p_name: b.name,
        p_email: b.email,
        p_phone: b.phone,
        p_notes: b.notes,
        p_request: b.request_key,
      }),
    );
    ok(res, data, 201);
  },
);
app.use("/api/public", publicRouter);

// Unauthenticated guest demos were removed. The demo is available only after sign-in.
app.post("/api/demo/guest", (req, res) => {
  res.status(403).json({ error: { message: "Sign in or create an account to try the demo.", request_id: req.requestId } });
});

const portal = express.Router();
portal.use(async (req, _res, next) => {
  const token = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw fail(401, "Please sign in");
  req.db = userClient(token);
  const { data, error } = await req.db.auth.getUser();
  if (error || !data.user)
    throw fail(401, "Your session expired. Please sign in again");
  req.user = data.user;
  next();
});
const accountProfile = (user) => ({
  id: user.id,
  email: user.email,
  created_at: user.created_at,
  last_sign_in_at: user.last_sign_in_at,
  full_name: user.user_metadata?.full_name || "",
  phone: user.user_metadata?.profile_phone || "",
  bio: user.user_metadata?.profile_bio || "",
  timezone: user.user_metadata?.profile_timezone || "Asia/Kolkata",
  providers: user.app_metadata?.providers || [],
});
portal.get("/profile", async (req, res) => ok(res, demoState(req.user)?.active ? demoProfile(req.user) : accountProfile(req.user)));
portal.patch("/profile", async (req, res) => {
  const b = z
    .object({
      full_name: v.text,
      phone: z.string().trim().max(30),
      bio: z.string().trim().max(500),
      timezone: v.timezone,
    })
    .strict()
    .parse(req.body);
  if (demoState(req.user)?.active) {
    const user = await saveDemoState(req.user, { ...demoState(req.user), profile: b });
    return ok(res, demoProfile(user));
  }
  if (isGuest(req.user)) throw fail(403, "Create your own account to edit a real profile");
  // Editable Auth metadata is presentation only. Roles always come from business_members.
  // The per-request DB client has a JWT header, not a refresh-token Auth session.
  // Use the trusted Auth API for this verified user's ID and only whitelisted metadata.
  const { data, error } = await system.auth.admin.updateUserById(req.user.id, {
    user_metadata: {
      ...req.user.user_metadata,
      full_name: b.full_name,
      profile_phone: b.phone,
      profile_bio: b.bio,
      profile_timezone: b.timezone,
    },
  });
  if (error) throw error;
  ok(res, accountProfile(data.user));
});
portal.get("/me", async (req, res) => {
  const demo = demoState(req.user);
  const memberships = await result(
      req.db
        .from("business_members")
        .select("business_id,role,businesses(*)")
        .eq("user_id", req.user.id),
    );
  ok(res, {
    user: demo?.active ? demoProfile(req.user) : accountProfile(req.user),
    demo, guest: isGuest(req.user),
    memberships: memberships.filter(m => demo?.active ? m.business_id === demo.business_id : m.business_id !== demo?.business_id && !(legacyDemoIds.has(m.business_id) && m.role === "owner" && m.businesses.owner_user_id !== req.user.id)),
  });
});
portal.post("/demo/start", async (req, res) => {
  if (isGuest(req.user)) throw fail(403, "Sign in with your own account to try the demo");
  const b = z.object({ return_business_id: v.id.nullable().optional() }).strict().parse(req.body || {});
  ok(res, await startDemo(req.user, b.return_business_id));
});
portal.post("/demo/exit", async (req, res) => {
  const demo = demoState(req.user);
  if (demo) await saveDemoState(req.user, { ...demo, active: false });
  ok(res, { guest: isGuest(req.user), return_business_id: demo?.return_business_id || null });
});
portal.post("/businesses", async (req, res) => {
  if (isGuest(req.user) || demoState(req.user)?.active) throw fail(403, "Exit the demo and use your own account to create a real workspace");
  const b = z
    .object({ name: v.text, slug: v.slug, timezone: v.timezone })
    .strict()
    .parse(req.body);
  ok(
    res,
    {
      id: await result(
        req.db.rpc("create_business", {
          p_name: b.name,
          p_slug: b.slug,
          p_timezone: b.timezone,
        }),
      ),
    },
    201,
  );
});
portal.use(async (req, _res, next) => {
  req.businessId = v.id.parse(req.get("x-business-id"));
  const demo = demoState(req.user);
  if ((demo?.active || isGuest(req.user)) && (!demo?.active || req.businessId !== demo.business_id))
    throw fail(403, "Exit the demo to use your real workspace");
  const membership = await result(
    req.db
      .from("business_members")
      .select("role")
      .eq("business_id", req.businessId)
      .eq("user_id", req.user.id)
      .maybeSingle(),
  );
  if (!membership) throw fail(403, "You do not have access to this business");
  req.role = membership.role;
  next();
});
const owner = (req, _res, next) => {
  if (req.role !== "owner")
    throw fail(403, "Only the business owner can manage billing");
  next();
};
portal.get("/billing", async (req, res) =>
  ok(res, {
    subscription: await result(
      req.db
        .from("subscriptions")
        .select("*")
        .eq("business_id", req.businessId)
        .single(),
    ),
    mode: "simulation",
    monthly_price: 1900,
    currency: "USD",
  }),
);
portal.get("/billing/history", async (req, res) => {
  const p = paginate(req);
  ok(
    res,
    await result(
      req.db
        .from("billing_sessions")
        .select("id,status,created_at,expires_at", { count: "exact" })
        .eq("business_id", req.businessId)
        .order("created_at", { ascending: false })
        .range(p.from, p.to),
    ),
  );
});
portal.get("/billing/checkout/:id", owner, async (req, res) => {
  const session = await result(
    req.db
      .from("billing_sessions")
      .select("id,business_id,status,expires_at,created_at")
      .eq("id", v.id.parse(req.params.id))
      .eq("business_id", req.businessId)
      .single(),
  );
  ok(res, {
    ...session,
    amount: 1900,
    currency: "USD",
    plan: "Studio Monthly",
    mode: "simulation",
    expired:
      session.status !== "completed" &&
      new Date(session.expires_at) <= new Date(),
  });
});
portal.post("/billing/checkout/:id/decline", owner, async (req, res) => {
  const id = v.id.parse(req.params.id);
  const session = await result(
    req.db
      .from("billing_sessions")
      .select("status,expires_at")
      .eq("id", id)
      .eq("business_id", req.businessId)
      .single(),
  );
  if (
    session.status !== "pending" ||
    new Date(session.expires_at) <= new Date()
  )
    throw fail(400, "This checkout is no longer available");
  await result(
    system
      .from("billing_events")
      .upsert(
        {
          id: `demo_decline_${id}`,
          business_id: req.businessId,
          event_type: "simulation.payment.declined",
          metadata: {
            session_id: id,
            simulated: true,
            amount: 1900,
            currency: "USD",
          },
        },
        { onConflict: "id", ignoreDuplicates: true },
      ),
  );
  ok(res, {
    status: "declined",
    message:
      "The demo payment was declined. Your subscription was not changed. Choose the approved demo method to retry.",
  });
});
portal.post("/billing/checkout", owner, async (req, res) => {
  const session = await result(
    system
      .from("billing_sessions")
      .insert({ business_id: req.businessId })
      .select("id,expires_at")
      .single(),
  );
  ok(
    res,
    {
      ...session,
      url: `${env.APP_URL}/dashboard/billing?checkout=${session.id}`,
      mode: "simulation",
    },
    201,
  );
});
portal.post("/billing/checkout/:id/complete", owner, async (req, res) =>
  ok(
    res,
    await result(
      system.rpc("complete_checkout", {
        p_business: req.businessId,
        p_session: v.id.parse(req.params.id),
        p_actor: req.user.id,
      }),
    ),
  ),
);
portal.post("/billing/cancel", owner, async (req, res) =>
  ok(
    res,
    await result(
      system.rpc("apply_billing_event", {
        p_id: `cancel_${randomUUID()}`,
        p_business: req.businessId,
        p_status: "cancelled",
        p_period: new Date().toISOString(),
        p_created: new Date().toISOString(),
      }),
    ),
  ),
);
portal.use(async (req, _res, next) => {
  const access = await result(
    req.db.rpc("has_access", { p_business: req.businessId }),
  );
  if (!access)
    throw fail(
      402,
      "Your subscription needs attention. Open Billing to restore dashboard access.",
    );
  next();
});
portal.get("/dashboard", async (req, res) =>
  ok(
    res,
    await result(
      req.db.rpc("dashboard_metrics", { p_business: req.businessId }),
    ),
  ),
);
portal.get("/business", async (req, res) =>
  ok(
    res,
    await result(
      req.db.from("businesses").select("*").eq("id", req.businessId).single(),
    ),
  ),
);
portal.patch("/business", async (req, res) =>
  ok(
    res,
    await result(
      req.db
        .from("businesses")
        .update(v.profile.parse(req.body))
        .eq("id", req.businessId)
        .select()
        .single(),
    ),
  ),
);

for (const [table, schema] of [
  ["services", v.service],
  ["providers", v.provider],
]) {
  portal.get(`/${table}`, async (req, res) =>
    ok(
      res,
      await result(
        req.db
          .from(table)
          .select("*")
          .eq("business_id", req.businessId)
          .order("created_at"),
      ),
    ),
  );
  portal.post(`/${table}`, async (req, res) =>
    ok(
      res,
      await result(
        req.db
          .from(table)
          .insert({ ...schema.parse(req.body), business_id: req.businessId })
          .select()
          .single(),
      ),
      201,
    ),
  );
  portal.patch(`/${table}/:id`, async (req, res) =>
    ok(
      res,
      await result(
        req.db
          .from(table)
          .update(schema.partial().parse(req.body))
          .eq("business_id", req.businessId)
          .eq("id", v.id.parse(req.params.id))
          .select()
          .single(),
      ),
    ),
  );
}
portal.get("/provider-services", async (req, res) =>
  ok(
    res,
    await result(
      req.db
        .from("provider_services")
        .select("*")
        .eq("business_id", req.businessId),
    ),
  ),
);
portal.post("/provider-services", async (req, res) => {
  const b = z
    .object({ provider_id: v.id, service_id: v.id })
    .strict()
    .parse(req.body);
  ok(
    res,
    await result(
      req.db
        .from("provider_services")
        .upsert(
          { ...b, business_id: req.businessId },
          { onConflict: "provider_id,service_id" },
        )
        .select()
        .single(),
    ),
  );
});
portal.delete("/provider-services", async (req, res) => {
  const b = z
    .object({ provider_id: v.id, service_id: v.id })
    .strict()
    .parse(req.body);
  await result(
    req.db
      .from("provider_services")
      .delete()
      .eq("business_id", req.businessId)
      .eq("provider_id", b.provider_id)
      .eq("service_id", b.service_id),
  );
  ok(res, { deleted: true });
});
portal.get("/schedule", async (req, res) => {
  const [business_hours, provider_hours, blocked_periods] = await Promise.all(
    ["business_hours", "provider_hours", "blocked_periods"].map((t) =>
      result(req.db.from(t).select("*").eq("business_id", req.businessId)),
    ),
  );
  ok(res, { business_hours, provider_hours, blocked_periods });
});
portal.put("/schedule/hours", async (req, res) => {
  const b = v.hours.parse(req.body);
  const table = b.provider_id ? "provider_hours" : "business_hours";
  const rows = b.hours.map((h) => ({
    ...h,
    business_id: req.businessId,
    ...(b.provider_id ? { provider_id: b.provider_id } : {}),
  }));
  ok(
    res,
    await result(
      req.db
        .from(table)
        .upsert(rows, {
          onConflict: b.provider_id
            ? "provider_id,day_of_week"
            : "business_id,day_of_week",
        })
        .select(),
    ),
  );
});
portal.delete("/schedule/providers/:id", async (req, res) => {
  await result(
    req.db
      .from("provider_hours")
      .delete()
      .eq("business_id", req.businessId)
      .eq("provider_id", v.id.parse(req.params.id)),
  );
  ok(res, { reset: true });
});
portal.post("/schedule/blocks", async (req, res) =>
  ok(
    res,
    await result(
      req.db
        .from("blocked_periods")
        .insert({ ...v.block.parse(req.body), business_id: req.businessId })
        .select()
        .single(),
    ),
    201,
  ),
);
portal.delete("/schedule/blocks/:id", async (req, res) => {
  await result(
    req.db
      .from("blocked_periods")
      .delete()
      .eq("business_id", req.businessId)
      .eq("id", v.id.parse(req.params.id)),
  );
  ok(res, { deleted: true });
});

const bookingSelect =
  "*,services(name,duration_minutes),providers(name),clients(name,email,phone)";
portal.get("/bookings", async (req, res) => {
  const p = paginate(req);
  const q = z
    .object({
      from: v.instant.optional(),
      to: v.instant.optional(),
      status: z
        .enum(["pending", "confirmed", "cancelled", "completed", "no_show"])
        .optional(),
      provider_id: v.id.optional(),
      client_id: v.id.optional(),
    })
    .parse(req.query);
  if (
    q.from &&
    q.to &&
    (new Date(q.to) <= new Date(q.from) ||
      new Date(q.to) - new Date(q.from) > 93 * 86400000)
  )
    throw fail(400, "Choose a date range of up to 93 days");
  let query = req.db
    .from("bookings")
    .select(bookingSelect, { count: "exact" })
    .eq("business_id", req.businessId)
    .order("starts_at", { ascending: !!q.from })
    .range(p.from, p.to);
  if (q.from) query = query.gte("starts_at", q.from);
  if (q.to) query = query.lt("starts_at", q.to);
  for (const key of ["status", "provider_id", "client_id"])
    if (q[key]) query = query.eq(key, q[key]);
  ok(res, { ...(await result(query)), page: p.page, limit: p.limit });
});
portal.get("/bookings/:id", async (req, res) => {
  const id = v.id.parse(req.params.id);
  const [booking, events] = await Promise.all([
    result(
      req.db
        .from("bookings")
        .select(bookingSelect)
        .eq("business_id", req.businessId)
        .eq("id", id)
        .single(),
    ),
    result(
      req.db
        .from("booking_events")
        .select("*")
        .eq("business_id", req.businessId)
        .eq("booking_id", id)
        .order("created_at", { ascending: false }),
    ),
  ]);
  ok(res, { booking, events });
});
portal.patch("/bookings/:id", async (req, res) => {
  const b = z
    .object({
      status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
      version: z.number().int().positive(),
    })
    .strict()
    .parse(req.body);
  const current = await result(
    req.db
      .from("bookings")
      .select("version")
      .eq("business_id", req.businessId)
      .eq("id", v.id.parse(req.params.id))
      .single(),
  );
  if (current.version !== b.version)
    throw fail(409, "This booking changed. Refresh and try again.");
  ok(
    res,
    await result(
      system.rpc("change_booking", {
        p_business: req.businessId,
        p_booking: v.id.parse(req.params.id),
        p_actor: req.user.id,
        p_version: b.version,
        p_status: b.status,
      }),
    ),
  );
});
portal.get("/bookings/:id/availability", async (req, res) => {
  const b = await result(
    req.db
      .from("bookings")
      .select("id,service_id,provider_id")
      .eq("business_id", req.businessId)
      .eq("id", v.id.parse(req.params.id))
      .single(),
  );
  const q = z
    .object({ date: v.date, provider_id: v.id.optional() })
    .parse(req.query);
  ok(
    res,
    await result(
      system.rpc("available_slots", {
        p_business: req.businessId,
        p_service: b.service_id,
        p_provider: q.provider_id || b.provider_id,
        p_date: q.date,
        p_exclude: b.id,
      }),
    ),
  );
});
portal.post("/bookings/:id/reschedule", async (req, res) => {
  const b = z
    .object({
      starts_at: v.instant,
      provider_id: v.id,
      version: z.number().int().positive(),
    })
    .strict()
    .parse(req.body);
  const current = await result(
    req.db
      .from("bookings")
      .select("version")
      .eq("business_id", req.businessId)
      .eq("id", v.id.parse(req.params.id))
      .single(),
  );
  if (current.version !== b.version)
    throw fail(409, "This booking changed. Refresh and try again.");
  ok(
    res,
    await result(
      system.rpc("change_booking", {
        p_business: req.businessId,
        p_booking: v.id.parse(req.params.id),
        p_actor: req.user.id,
        p_version: b.version,
        p_starts: b.starts_at,
        p_provider: b.provider_id,
      }),
    ),
  );
});
portal.get("/clients", async (req, res) => {
  const p = paginate(req);
  const search = z
    .string()
    .max(100)
    .parse(req.query.search || "")
    .replace(/[^\p{L}\p{N}@+ ._-]/gu, "")
    .replace(/[%_]/g, "");
  let query = req.db
    .from("client_metrics")
    .select("*", { count: "exact" })
    .eq("business_id", req.businessId)
    .order("created_at", { ascending: false })
    .range(p.from, p.to);
  if (search)
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    );
  ok(res, { ...(await result(query)), page: p.page, limit: p.limit });
});
portal.get("/clients/:id", async (req, res) =>
  ok(
    res,
    await result(
      req.db
        .from("client_metrics")
        .select("*")
        .eq("business_id", req.businessId)
        .eq("id", v.id.parse(req.params.id))
        .single(),
    ),
  ),
);
portal.patch("/clients/:id", async (req, res) =>
  ok(
    res,
    await result(
      req.db
        .from("clients")
        .update(
          z
            .object({ notes: z.string().max(10000) })
            .strict()
            .parse(req.body),
        )
        .eq("business_id", req.businessId)
        .eq("id", v.id.parse(req.params.id))
        .select()
        .single(),
    ),
  ),
);
portal.get("/notifications", async (req, res) => {
  const p = paginate(req);
  ok(
    res,
    await result(
      req.db
        .from("reminders")
        .select("*", { count: "exact" })
        .eq("business_id", req.businessId)
        .order("scheduled_for", { ascending: false })
        .range(p.from, p.to),
    ),
  );
});
portal.get("/notification-logs", async (req, res) => {
  const p = paginate(req);
  ok(
    res,
    await result(
      req.db
        .from("notification_logs")
        .select("*", { count: "exact" })
        .eq("business_id", req.businessId)
        .order("created_at", { ascending: false })
        .range(p.from, p.to),
    ),
  );
});
app.use("/api", portal);
app.use((_req, _res, next) => next(fail(404, "Route not found")));
app.use((error, req, res, _next) => {
  let status = error.status || 500,
    message = "Something went wrong. Please try again.";
  if (error instanceof ZodError) {
    status = 400;
    message = error.issues
      .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
      .join("; ");
  } else if (
    !error.code &&
    /fetch failed|abort|timeout/i.test(error.message || "")
  ) {
    status = 503;
    message =
      "The database connection timed out. Please refresh and try again.";
  } else if (
    ["PGRST205", "PGRST200", "PGRST202", "PGRST204", "42P01", "42703"].includes(
      error.code,
    )
  ) {
    status = 503;
    message =
      "The database schema is unavailable or incomplete. Follow the database recovery steps in SETUP_AND_DEPLOYMENT.md, reload the Supabase schema cache, and restart the backend.";
  } else if (
    ["PGRST000", "PGRST001", "PGRST002", "PGRST003"].includes(error.code)
  ) {
    status = 503;
    message =
      "The database is temporarily unavailable. Please try again shortly.";
  } else if (error.code === "23P01") {
    status = 409;
    message = "That time is no longer available. Please choose another slot.";
  } else if (error.code === "23505") {
    status = 409;
    message = "This record already exists. Try a different slug or value.";
  } else if (error.code === "23503") {
    status = 400;
    message =
      "The selected record is unavailable or belongs to another business.";
  } else if (error.code === "42501") {
    status = 403;
    message = "This action is not permitted for your account or subscription.";
  } else if (error.code === "PGRST116" || error.code === "P0002") {
    status = 404;
    message = "Record not found";
  } else if (["40001", "PT409"].includes(error.code)) {
    status = 409;
    message = "This booking changed. Refresh and try again.";
  } else if (error.code === "P0001" || error.code === "23514") {
    status = 400;
    message =
      error.code === "P0001"
        ? error.message
        : "The supplied values violate a data constraint";
  } else if (status < 500) message = error.message;
  console.error(
    JSON.stringify({
      event: "request_error",
      request_id: req.requestId,
      code: error.code || error.name,
      status,
    }),
  );
  res.status(status).json({
    error: {
      code: error.code || `HTTP_${status}`,
      message,
      request_id: req.requestId,
    },
  });
});
export default app;
