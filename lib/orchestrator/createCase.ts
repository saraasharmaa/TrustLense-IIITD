import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { cases, subjects } from "@/lib/db/schema";
import { findDemoCompanyByGstin } from "@/lib/demo/fixtures";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { AdapterId } from "@/lib/types";
import { ADAPTER_ORDER } from "@/lib/adapters/registry";
import { validateCin } from "@/lib/identifiers/cin";
import { validateGstin, type GstinDetails } from "@/lib/identifiers/gstin";
import { validateUdyam } from "@/lib/identifiers/udyam";
import { orThrow } from "@/lib/identifiers/types";

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
  const parsed = body.gstin ? orThrow(validateGstin(body.gstin)) : undefined;
  // Invalid identifiers are rejected before any case exists or any network call is made
  const cin = body.cin ? orThrow(validateCin(body.cin)).cin : undefined;
  const udyamNumber = body.udyamNumber
    ? orThrow(validateUdyam(body.udyamNumber)).udyamNumber
    : undefined;
  const fixture = parsed ? findDemoCompanyByGstin(parsed.gstin) : undefined;
  const mode = body.mode ?? (env().DEMO_MODE ? "demo" : "live");

  const subjectId = await findOrCreateSubject(
    { legalName: body.legalName, cin, udyamNumber },
    parsed,
    fixture?.subject,
  );
  const [created] = await db()
    .insert(cases)
    .values({ subjectId, mode, requestedSources: body.sources })
    .returning({ id: cases.id });
  return { caseId: created!.id, subjectId };
}

async function findOrCreateSubject(
  ids: { legalName?: string | null; cin?: string; udyamNumber?: string },
  parsed: GstinDetails | undefined,
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
    if (existing) {
      // A CIN supplied later fills the gap on a subject created without one
      if (ids.cin) {
        await db()
          .update(subjects)
          .set({ cin: ids.cin })
          .where(and(eq(subjects.id, existing.id), isNull(subjects.cin)));
      }
      return existing.id;
    }
  }
  const [row] = await db()
    .insert(subjects)
    .values({
      workspaceId: WORKSPACE,
      // Real names are discovered by the adapters; until then the identifier is the label
      legalName:
        ids.legalName ??
        fixtureSubject?.legalName ??
        parsed?.gstin ??
        ids.cin ??
        ids.udyamNumber ??
        "Unknown",
      tradeName: fixtureSubject?.tradeName,
      gstin: parsed?.gstin,
      pan: parsed?.pan,
      stateCode: parsed?.stateCode,
      entityType: parsed?.entityType ?? fixtureSubject?.entityType,
      cin: ids.cin ?? fixtureSubject?.cin,
      udyamNumber: ids.udyamNumber ?? fixtureSubject?.udyamNumber,
    })
    .returning({ id: subjects.id });
  return row!.id;
}
