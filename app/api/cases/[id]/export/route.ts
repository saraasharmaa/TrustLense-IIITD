import { handle } from "@/lib/api/route";
import { requireCaseId } from "@/lib/api/params";
import { AppError } from "@/lib/errors";
import { getCaseView } from "@/lib/orchestrator/caseView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const caseId = await requireCaseId(ctx.params);
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  if (format !== "json") throw new AppError("invalid_input", "Only format=json is supported");

  const report = { ...(await getCaseView(caseId)), generatedAt: new Date().toISOString() };
  return new Response(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="trustlens-${caseId.slice(0, 8)}.json"`,
    },
  });
});
