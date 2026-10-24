import { requireCaseId } from "@/lib/api/params";
import { handle } from "@/lib/api/route";
import { getCaseView } from "@/lib/orchestrator/caseView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  return Response.json(await getCaseView(await requireCaseId(ctx.params)));
});
