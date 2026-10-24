import { z } from "zod";
import { handle } from "@/lib/api/route";
import { AppError } from "@/lib/errors";
import { getCaseView } from "@/lib/orchestrator/caseView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new AppError("not_found", "Case not found");
    return Response.json(await getCaseView(id));
  },
);
