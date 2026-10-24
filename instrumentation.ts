// Next calls this once when the server starts. The import sits inside the runtime check so the
// edge bundle never pulls in the database driver.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/monitor/scheduler");
    startScheduler();
  }
}
