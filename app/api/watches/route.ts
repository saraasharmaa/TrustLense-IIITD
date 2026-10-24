import { handle } from "@/lib/api/route";
import { listWatches } from "@/lib/monitor/watches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => Response.json({ watches: await listWatches() }));
