import { requireCaseId } from "@/lib/api/params";
import { handle } from "@/lib/api/route";
import { acknowledgeAlert } from "@/lib/monitor/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await acknowledgeAlert(await requireCaseId(ctx.params));
  return new Response(null, { status: 204 });
});
