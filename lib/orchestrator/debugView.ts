import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sourceRuns } from "@/lib/db/schema";
import { listEventsAfter } from "./events";

// Everything stored about a case, untrimmed, for the developer-only debug page
export async function getDebugView(caseId: string) {
  const [events, runs] = await Promise.all([
    listEventsAfter(caseId, 0),
    db()
      .select()
      .from(sourceRuns)
      .where(eq(sourceRuns.caseId, caseId))
      .orderBy(asc(sourceRuns.createdAt)),
  ]);
  return { events, runs };
}
