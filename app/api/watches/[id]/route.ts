import { requireCaseId } from "@/lib/api/params";
import { handle, parseBody } from "@/lib/api/route";
import { PatchWatchBody, patchWatch } from "@/lib/monitor/watches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Watch ids are uuids like case ids, so the same param check applies
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = await requireCaseId(ctx.params);
  await patchWatch(id, await parseBody(req, PatchWatchBody));
  return new Response(null, { status: 204 });
});
