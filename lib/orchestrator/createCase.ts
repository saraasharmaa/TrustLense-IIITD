import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { cases, subjects } from "@/lib/db/schema";
import { findDemoCompanyByGstin } from "@/lib/demo/fixtures";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { AdapterId } from "@/lib/types";
import { ADAPTER_ORDER } from "@/lib/adapters/registry";
import { validateGstin } from "./temp-scoring-stub";

export const CreateCaseBody = z.object({
  gstin: z.string().nullish(),
  cin: z.string().nullish(),
  udyamNumber: z.string().nullish(),
  legalName: z.string().min(1).nullish(),
  sources: z.array(AdapterId).min(1).default(ADAPTER_ORDER),
  mode: z.enum(["live", "demo"]).optional(),
  fresh: z.boolean().default(false),
});

const WORKSPACE = "demo";

export async function createCase(body: z.output<typeof CreateCaseBody>) {
  if (!body.gstin && !body.cin && !body.udyamNumber) {
    throw new AppError("invalid_input", "Provide a gstin, cin or udyamNumber");
  }
  const parsed = body.gstin ? validateGstin(body.gstin) : undefined;
  const fixture = parsed ? findDemoCompanyByGstin(parsed.gstin) : undefined;
  const mode = body.mode ?? (env().DEMO_MODE ? "demo" : "live");

  const subjectId = await findOrCreateSubject(body, parsed, fixture?.subject);
  const [created] = await db()
    .insert(cases)
    .values({ subjectId, mode, requestedSources: body.sources })
    .returning({ id: cases.id });
  return { caseId: created!.id, subjectId };
}

async function findOrCreateSubject(
  body: z.output<typeof CreateCaseBody>,
  parsed: ReturnType<typeof validateGstin> | undefined,
  fixtureSubject:
    | {
        legalName: string;
        tradeName: string | null;
        cin: string | null;
        udyamNumber: string | null;
        entityType: string;
      }
    | undefined,
): Promise<string> {
  if (parsed) {
    const [existing] = await db()
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.workspaceId, WORKSPACE), eq(subjects.gstin, parsed.gstin)));
    if (existing) return existing.id;
  }
  const [row] = await db()
    .insert(subjects)
    .values({
      workspaceId: WORKSPACE,
      // Real names are discovered by the adapters; until then the identifier is the label
      legalName:
        body.legalName ??
        fixtureSubject?.legalName ??
        parsed?.gstin ??
        body.cin ??
        body.udyamNumber ??
        "Unknown",
      tradeName: fixtureSubject?.tradeName,
      gstin: parsed?.gstin,
      pan: parsed?.pan,
      stateCode: parsed?.stateCode,
      cin: body.cin ?? fixtureSubject?.cin,
      udyamNumber: body.udyamNumber ?? fixtureSubject?.udyamNumber,
      entityType: fixtureSubject?.entityType,
    })
    .returning({ id: subjects.id });
  return row!.id;
}
