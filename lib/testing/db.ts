import { db } from "@/lib/db/client";
import { cases, subjects } from "@/lib/db/schema";

// Integration tests run only when DATABASE_URL points at a database with the schema pushed
export const hasDatabase = Boolean(process.env.DATABASE_URL);

export async function createTestCase(
  mode: "live" | "demo" = "demo",
  gstin = `T${Date.now()}${Math.floor(Math.random() * 1e6)}`,
): Promise<string> {
  const [subject] = await db()
    .insert(subjects)
    .values({ legalName: "Test Co", gstin, workspaceId: crypto.randomUUID() })
    .returning({ id: subjects.id });
  const [created] = await db()
    .insert(cases)
    .values({ subjectId: subject!.id, mode, requestedSources: ["gst"] })
    .returning({ id: cases.id });
  return created!.id;
}
