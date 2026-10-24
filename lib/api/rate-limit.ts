import { AppError } from "@/lib/errors";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

// In memory and per process: enough to stop a runaway client during a demo, not a production limiter
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function enforceRateLimit(key: string, now = Date.now()): void {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    throw new AppError("rate_limited", "Too many checks started; wait a minute and try again");
  }
  hits.set(key, [...recent, now]);
}

export function resetRateLimits(): void {
  hits.clear();
}
