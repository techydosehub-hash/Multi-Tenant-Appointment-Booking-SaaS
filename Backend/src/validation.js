import { z } from "zod";
export const id = z.uuid();
export const text = z.string().trim().min(2).max(120);
export const slug = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const instant = z.iso.datetime({ offset: true });
export const date = z.iso.date();
export const timezone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Choose a valid IANA timezone");
export const service = z
  .object({
    name: text,
    description: z.string().max(2000).default(""),
    duration_minutes: z.number().int().min(5).max(480),
    price: z.number().int().min(0).max(100000000),
    active: z.boolean().default(true),
  })
  .strict();
export const provider = z
  .object({ name: text, active: z.boolean().default(true) })
  .strict();
export const profile = z
  .object({
    name: text,
    slug,
    description: z.string().max(2000),
    timezone,
    currency: z.enum(["INR", "USD", "EUR", "GBP"]),
    phone: z.string().max(30),
    email: z.union([z.email(), z.literal("")]),
    status: z.enum(["active", "paused"]),
    requires_approval: z.boolean(),
    email_notifications: z.boolean(),
    sms_notifications: z.boolean(),
  })
  .strict();
export const booking = z
  .object({
    service_id: id,
    provider_id: id,
    starts_at: instant,
    name: text,
    email: z
      .email()
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s().-]/g, ""))
      .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number")),
    notes: z.string().max(2000).default(""),
    request_key: id,
  })
  .strict();
export const hour = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    enabled: z.boolean(),
  })
  .refine(
    (v) => v.end_time > v.start_time,
    "End time must be after start time",
  );
export const hours = z
  .object({
    provider_id: id.nullable().default(null),
    hours: z
      .array(hour)
      .length(7)
      .refine(
        (v) => new Set(v.map((x) => x.day_of_week)).size === 7,
        "Provide each day exactly once",
      ),
  })
  .strict();
export const block = z
  .object({
    provider_id: id.nullable().default(null),
    starts_at: instant,
    ends_at: instant,
    reason: z.string().max(250).default(""),
  })
  .strict()
  .refine(
    (v) => new Date(v.ends_at) > new Date(v.starts_at),
    "End must be after start",
  );
export const page = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const webhook = z
  .object({
    id: z.string().min(1).max(120),
    business_id: id,
    status: z.enum([
      "active",
      "trialing",
      "past_due",
      "cancelled",
      "incomplete",
    ]),
    current_period_end: instant,
    created_at: instant,
  })
  .strict();
