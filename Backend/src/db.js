import { createClient } from "@supabase/supabase-js";
import { env } from "./config.js";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const system = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  options,
);
export const userClient = (token) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
export async function result(query) {
  const { data, error, count } = await query;
  if (error) throw error;
  return count === null || count === undefined
    ? data
    : { items: data, total: count };
}
