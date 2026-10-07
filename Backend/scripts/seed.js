import { system, userClient, result } from "../src/db.js";
import { createClient } from "@supabase/supabase-js";
import { env } from "../src/config.js";
// Explicit opt-in setup utility. It is not run during installation or application startup.
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) {
  console.error(
    "Set DEMO_PASSWORD to a new password of at least 12 characters before seeding.",
  );
  process.exit(1);
}
const suffix = process.env.DEMO_SUFFIX || "demo";
if (!/^[a-z0-9-]{1,20}$/.test(suffix))
  throw new Error(
    "DEMO_SUFFIX must contain 1–20 lowercase letters, numbers or hyphens",
  );
for (const studio of [
  {
    name: "Oak & Form Studio",
    slug: `oak-form-${suffix}`,
    email: `oak-${suffix}@example.com`,
  },
  {
    name: "Fieldwork Consulting",
    slug: `fieldwork-${suffix}`,
    email: `fieldwork-${suffix}@example.com`,
  },
]) {
  const existing = await result(
    system
      .from("businesses")
      .select("id")
      .eq("slug", studio.slug)
      .maybeSingle(),
  );
  if (existing) {
    console.log(`${studio.slug}: already seeded; skipped`);
    continue;
  }
  const { data: created, error } = await system.auth.admin.createUser({
    email: studio.email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: login, error: loginError } = await auth.auth.signInWithPassword(
    { email: studio.email, password },
  );
  if (loginError) throw loginError;
  const db = userClient(login.session.access_token);
  const business = await result(
    db.rpc("create_business", {
      p_name: studio.name,
      p_slug: studio.slug,
      p_timezone: "Asia/Kolkata",
    }),
  );
  await result(
    db
      .from("businesses")
      .update({
        description:
          "Thoughtful appointments, a warm welcome, and space to focus on you.",
        email: studio.email,
      })
      .eq("id", business),
  );
  const services = await result(
    db
      .from("services")
      .insert([
        {
          business_id: business,
          name: "Initial consultation",
          description: "A focused conversation to find the right next step.",
          duration_minutes: 30,
          price: 150000,
        },
        {
          business_id: business,
          name: "Signature session",
          description: "Dedicated time for the details that matter.",
          duration_minutes: 60,
          price: 300000,
        },
      ])
      .select(),
  );
  const providers = await result(
    db
      .from("providers")
      .insert([
        { business_id: business, name: "Alex Morgan" },
        { business_id: business, name: "Sam Taylor" },
      ])
      .select(),
  );
  await result(
    db
      .from("provider_services")
      .insert(
        providers.flatMap((p) =>
          services.map((s) => ({
            business_id: business,
            provider_id: p.id,
            service_id: s.id,
          })),
        ),
      ),
  );
  await auth.auth.signOut();
  console.log(
    JSON.stringify({
      business: studio.name,
      email: studio.email,
      booking: `${env.APP_URL}/booking/${studio.slug}`,
      business_id: business,
      user_id: created.user.id,
    }),
  );
}
console.log(
  "Seed complete. Sign in using DEMO_PASSWORD. No appointments or notification deliveries were created.",
);
