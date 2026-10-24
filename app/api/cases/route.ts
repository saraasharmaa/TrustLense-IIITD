import { desc, eq } from "drizzle-orm";
import { handle, parseBody } from "@/lib/api/route";
import { db } from "@/lib/db/client";
import { cases, subjects } from "@/lib/db/schema";
import { CreateCaseBody, createCase } from "@/lib/orchestrator/createCase";
import { runCase } from "@/lib/orchestrator/runCase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, CreateCaseBody);
  const { caseId, subjectId } = await createCase(body);
  // Runs in this process after the response; progress is read back through the event log
  void runCase(caseId, { fresh: body.fresh });
  return Response.json({ caseId, subjectId, status: "queued" }, { status: 201 });
});

export const GET = handle(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const limit = Math.min(Number(params.get("limit")) || 20, 100);
  const subjectId = params.get("subjectId");
  const rows = await db()
    .select({ c: cases, s: subjects })
    .from(cases)
    .innerJoin(subjects, eq(cases.subjectId, subjects.id))
    .where(subjectId ? eq(cases.subjectId, subjectId) : undefined)
    .orderBy(desc(cases.createdAt))
    .limit(limit);
  return Response.json({
    cases: rows.map(({ c, s }) => ({
      id: c.id,
      status: c.status,
      mode: c.mode,
      score: c.score,
      grade: c.grade,
      isProvisional: c.isProvisional,
      createdAt: c.createdAt.toISOString(),
      subject: { id: s.id, legalName: s.legalName, gstin: s.gstin },
    })),
  });
});
