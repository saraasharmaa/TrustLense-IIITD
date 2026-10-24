import { timingSafeEqual } from "node:crypto";
import { handle } from "@/lib/api/route";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { runDueWatches } from "@/lib/monitor/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const POST = handle(async (req: Request) => {
  if (!authorized(req.headers.get("authorization"), env().CRON_SECRET)) {
    throw new AppError("not_found", "Not found");
  }
  return Response.json(await runDueWatches());
});
