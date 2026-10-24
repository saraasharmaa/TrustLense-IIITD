import { requireCaseId } from "@/lib/api/params";
import { handle, parseBody } from "@/lib/api/route";
import { CreateWatchBody, createWatch } from "@/lib/monitor/watches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const caseId = await requireCaseId(ctx.params);
  const body = await parseBody(req, CreateWatchBody);
  return Response.json(await createWatch(caseId, body), { status: 201 });
});
