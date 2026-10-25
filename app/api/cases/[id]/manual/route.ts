import { requireCaseId } from "@/lib/api/params";
import { handle, parseBody } from "@/lib/api/route";
import { ManualGstBody, enterGstManually } from "@/lib/orchestrator/manualSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const caseId = await requireCaseId(ctx.params);
  await enterGstManually(caseId, await parseBody(req, ManualGstBody));
  return new Response(null, { status: 204 });
});
