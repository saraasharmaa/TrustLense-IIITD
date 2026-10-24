import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts, subjects } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { CaseDiff } from "./diff";

export async function createAlert(input: {
  watchId: string;
  subjectId: string;
  caseId: string;
  previousCaseId: string;
  diff: CaseDiff;
  isSimulated: boolean;
}): Promise<string> {
  const [row] = await db()
    .insert(alerts)
    .values({
      watchId: input.watchId,
      subjectId: input.subjectId,
      caseId: input.caseId,
      previousCaseId: input.previousCaseId,
      severity: input.diff.severity,
      title: input.diff.title,
      change: input.diff.change,
      isSimulated: input.isSimulated,
    })
    .returning({ id: alerts.id });
  return row!.id;
}

export async function listAlerts(opts: { unreadOnly: boolean; limit: number }) {
  const rows = await db()
    .select({ a: alerts, s: subjects })
    .from(alerts)
    .innerJoin(subjects, eq(alerts.subjectId, subjects.id))
    .where(opts.unreadOnly ? isNull(alerts.acknowledgedAt) : undefined)
    .orderBy(desc(alerts.createdAt))
    .limit(opts.limit);
  const unread = await db()
    .select({ id: alerts.id })
    .from(alerts)
    .where(isNull(alerts.acknowledgedAt));

  return {
    unreadCount: unread.length,
    alerts: rows.map(({ a, s }) => ({
      id: a.id,
      severity: a.severity,
      title: a.title,
      isSimulated: a.isSimulated,
      createdAt: a.createdAt.toISOString(),
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      subject: { id: s.id, legalName: s.legalName, gstin: s.gstin },
      change: a.change,
      caseId: a.caseId,
      previousCaseId: a.previousCaseId,
    })),
  };
}

export async function acknowledgeAlert(id: string): Promise<void> {
  const updated = await db()
    .update(alerts)
    .set({ acknowledgedAt: new Date() })
    .where(eq(alerts.id, id))
    .returning({ id: alerts.id });
  if (updated.length === 0) throw new AppError("not_found", "Alert not found");
}
