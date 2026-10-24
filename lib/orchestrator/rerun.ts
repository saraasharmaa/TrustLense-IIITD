import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { sourceRuns } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { AdapterId, type SourceStatus } from "@/lib/types";
import { loadCase } from "./store";

export const RerunBody = z.object({ sources: z.array(AdapterId).min(1).optional() });

// A missing identifier or a clean "no record" won't change on a retry, so only real failures qualify
const RETRYABLE: SourceStatus[] = ["failed", "timeout", "captcha_blocked"];

export async function sourcesToRerun(
  caseId: string,
  requested?: AdapterId[],
): Promise<AdapterId[]> {
  const { case: c } = await loadCase(caseId);
  if (c.status === "queued" || c.status === "running") {
    throw new AppError("conflict", "This case is still running");
  }
  const runs = await db().select().from(sourceRuns).where(eq(sourceRuns.caseId, caseId));
  const known = new Set(runs.map((r) => r.adapter));

  if (requested) {
    const unknown = requested.filter((id) => !known.has(id));
    if (unknown.length)
      throw new AppError("invalid_input", `Not part of this case: ${unknown.join(", ")}`);
    return requested;
  }
  const failed = runs
    .filter((r) => RETRYABLE.includes(r.status))
    .map((r) => r.adapter as AdapterId);
  if (failed.length === 0) throw new AppError("invalid_input", "No failed sources to rerun");
  return failed;
}
