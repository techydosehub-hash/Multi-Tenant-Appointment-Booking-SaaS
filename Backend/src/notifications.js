import { system, result } from "./db.js";
// The mock adapter records delivery in PostgreSQL. Replacing it with an external adapter
// requires passing reminder.id as the provider's idempotency key.
export const notificationAdapter = {
  async send(job) {
    return result(
      system.rpc("deliver_mock_notification", {
        p_id: job.id,
        p_lease: job.lease_token,
      }),
    );
  },
};
export async function processNotifications() {
  const jobs = await result(system.rpc("claim_notifications"));
  const summary = { claimed: jobs.length, simulated: 0, skipped: 0, failed: 0 };
  for (const job of jobs) {
    try {
      const state = await notificationAdapter.send(job);
      if (state === "simulated") summary.simulated++;
      else summary.skipped++;
    } catch {
      summary.failed++;
      await result(
        system.rpc("fail_notification", {
          p_id: job.id,
          p_lease: job.lease_token,
        }),
      );
    }
  }
  return summary;
}
