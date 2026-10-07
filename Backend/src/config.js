import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
// Resolve local configuration from the backend folder even when launched from the repository root.
// Existing Render/Vercel environment variables retain precedence over this local file.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
export const env = z
  .object({
    PORT: z.coerce.number().default(3001),
    SUPABASE_URL: z.url(),
    SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    // Browsers send an origin with no trailing slash. Normalize configuration for
    // both CORS and checkout links instead of requiring exact manual formatting.
    APP_URL: z.url().transform((value) => new URL(value).origin),
    CRON_SECRET: z.string().min(32),
    BILLING_WEBHOOK_SECRET: z.string().min(32),
    BILLING_MODE: z.literal("simulation").default("simulation"),
    NOTIFICATION_MODE: z.literal("mock").default("mock"),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  })
  .parse(process.env);
