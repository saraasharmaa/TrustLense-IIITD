import { handle } from "@/lib/api/route";
import { listAlerts } from "@/lib/monitor/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const limit = Math.min(Number(params.get("limit")) || 20, 100);
  return Response.json(await listAlerts({ unreadOnly: params.get("unread") === "1", limit }));
});
