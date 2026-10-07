import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const base = process.env.API_URL?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
if (!base || !secret || secret.length < 32) {
  console.error(
    "Configure API_URL (including /api) and CRON_SECRET before running the reminder caller.",
  );
  process.exit(1);
}
try {
  const url = new URL(`${base}/jobs/reminders`);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "API_URL must be an HTTP(S) URL without embedded credentials",
    );
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(120000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Reminder endpoint returned HTTP ${response.status}`);
  const payload = await response.json();
  console.log(
    JSON.stringify({ event: "reminder_run_finished", summary: payload.data }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      event: "reminder_run_failed",
      message:
        error.name === "TimeoutError"
          ? "Reminder endpoint timed out"
          : error.message,
    }),
  );
  process.exitCode = 1;
}
