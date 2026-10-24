import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { cases, subjects, watches } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { AdapterId } from "@/lib/types";

export const FREQUENCIES = [6, 24, 168] as const;

export const CreateWatchBody = z.object({
  frequencyHours: z.union([z.literal(6), z.literal(24), z.literal(168)]),
  adapters: z.array(AdapterId).min(1).default(["gst", "news"]),
});

export const PatchWatchBody = z
  .object({
    active: z.boolean().optional(),
    frequencyHours: z.union([z.literal(6), z.literal(24), z.literal(168)]).optional(),
  })
  .refine((b) => b.active !== undefined || b.frequencyHours !== undefined, "Nothing to change");

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

export async function createWatch(caseId: string, body: z.output<typeof CreateWatchBody>) {
  const [row] = await db().select().from(cases).where(eq(cases.id, caseId));
  if (!row) throw new AppError("not_found", "Case not found");
  if (row.status !== "completed" && row.status !== "partial") {
    throw new AppError("conflict", "Only a finished case can become a watch baseline");
  }
  const [existing] = await db()
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.subjectId, row.subjectId), eq(watches.active, true)));
  if (existing) throw new AppError("conflict", "This company is already being watched");

  const nextRunAt = hoursFromNow(body.frequencyHours);
  const [created] = await db()
    .insert(watches)
    .values({
      subjectId: row.subjectId,
      frequencyHours: body.frequencyHours,
      adapters: body.adapters,
      baselineCaseId: caseId,
      nextRunAt,
    })
    .returning({ id: watches.id });
  return { watchId: created!.id, nextRunAt: nextRunAt.toISOString() };
}

export async function patchWatch(id: string, body: z.output<typeof PatchWatchBody>): Promise<void> {
  const [current] = await db().select().from(watches).where(eq(watches.id, id));
  if (!current) throw new AppError("not_found", "Watch not found");
  const frequency = body.frequencyHours ?? current.frequencyHours;
  await db()
    .update(watches)
    .set({
      active: body.active,
      frequencyHours: body.frequencyHours,
      // A resumed or re-timed watch is next due one period from now
      nextRunAt: body.active || body.frequencyHours ? hoursFromNow(frequency) : undefined,
    })
    .where(eq(watches.id, id));
}

export async function listWatches() {
  const rows = await db()
    .select({ w: watches, s: subjects })
    .from(watches)
    .innerJoin(subjects, eq(watches.subjectId, subjects.id))
    .orderBy(asc(watches.createdAt));

  const gradeOf = async (caseId: string | null) => {
    if (!caseId) return null;
    const [c] = await db().select({ grade: cases.grade }).from(cases).where(eq(cases.id, caseId));
    return c?.grade ?? null;
  };

  return Promise.all(
    rows.map(async ({ w, s }) => ({
      id: w.id,
      subject: { id: s.id, legalName: s.legalName, gstin: s.gstin },
      frequencyHours: w.frequencyHours,
      adapters: w.adapters,
      active: w.active,
      lastRunAt: w.lastRunAt?.toISOString() ?? null,
      nextRunAt: w.nextRunAt?.toISOString() ?? null,
      currentGrade: await gradeOf(w.lastCaseId ?? w.baselineCaseId),
      baselineGrade: await gradeOf(w.baselineCaseId),
    })),
  );
}
