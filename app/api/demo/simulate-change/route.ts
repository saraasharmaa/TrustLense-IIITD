import { z } from "zod";
import { handle, parseBody } from "@/lib/api/route";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { runWatch } from "@/lib/monitor/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ watchId: z.string().uuid() });

export const POST = handle(async (req: Request) => {
  const { DEMO_MODE, ALLOW_SIMULATION } = env();
  if (!DEMO_MODE && !ALLOW_SIMULATION) throw new AppError("not_found", "Not found");
  const { watchId } = await parseBody(req, Body);
  const outcome = await runWatch(watchId, { simulate: true });
  if (!outcome.alertId) throw new AppError("conflict", "The simulated change produced no alert");
  return Response.json(outcome, { status: 201 });
});
