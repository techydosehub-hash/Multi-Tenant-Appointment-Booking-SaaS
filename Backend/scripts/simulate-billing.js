import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
const [businessId, status = "active", periodEnd] = process.argv.slice(2);
if (!businessId || !process.env.BILLING_WEBHOOK_SECRET) {
  console.error(
    "Usage: npm run simulate:billing -- BUSINESS_UUID active [ISO_PERIOD_END]. Requires BILLING_WEBHOOK_SECRET.",
  );
  process.exit(1);
}
const now = new Date();
const period = new Date(now);
period.setUTCMonth(period.getUTCMonth() + 1);
const body = JSON.stringify({
  id: `sim_event_${randomUUID()}`,
  business_id: businessId,
  status,
  current_period_end: periodEnd || period.toISOString(),
  created_at: now.toISOString(),
});
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHmac("sha256", process.env.BILLING_WEBHOOK_SECRET)
  .update(`${timestamp}.${body}`)
  .digest("hex");
const response = await fetch(
  `${process.env.API_URL || "http://localhost:3001/api"}/billing/webhook`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Billing-Timestamp": timestamp,
      "X-Billing-Signature": signature,
    },
    body,
  },
);
console.log(
  JSON.stringify(
    { status: response.status, result: await response.json() },
    null,
    2,
  ),
);
if (!response.ok) process.exitCode = 1;
