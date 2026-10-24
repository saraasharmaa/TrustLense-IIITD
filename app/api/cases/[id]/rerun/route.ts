import { handle, parseBody } from "@/lib/api/route";
import { requireCaseId } from "@/lib/api/params";
import { RerunBody, sourcesToRerun } from "@/lib/orchestrator/rerun";
import { runCase } from "@/lib/orchestrator/runCase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const caseId = await requireCaseId(ctx.params);
  const body = await parseBody(req, RerunBody);
  const sources = await sourcesToRerun(caseId, body.sources);
  // A rerun asks for current data, so it skips the source cache
  void runCase(caseId, { only: sources, fresh: true });
  return Response.json({ caseId, sources }, { status: 202 });
});
