// Next calls this once when the server starts; the scheduler needs Node, not the edge runtime
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduler } = await import("@/lib/monitor/scheduler");
  startScheduler();
}
