import { env } from "@/lib/env";
import { runDueWatches } from "./monitor";

const TICK_MS = 60_000;

const globalForScheduler = globalThis as unknown as { trustlensScheduler?: NodeJS.Timeout };

// Started once per process (instrumentation.ts); the cron endpoint does the same work for hosted setups
export function startScheduler(): void {
  if (!env().ENABLE_INPROCESS_SCHEDULER || globalForScheduler.trustlensScheduler) return;

  let running = false;
  globalForScheduler.trustlensScheduler = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runDueWatches();
    } catch (err) {
      console.error(
        JSON.stringify({ event: "scheduler.failed", error: String(err).slice(0, 200) }),
      );
    } finally {
      running = false;
    }
  }, TICK_MS);
}
