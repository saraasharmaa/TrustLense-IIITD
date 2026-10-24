import { z } from "zod";
import raw from "@/fixtures/demo-companies.json";
import { AdapterId } from "@/lib/types";

const Expected = z.object({
  score: z.number().int(),
  grade: z.enum(["A", "B", "C", "D"]),
  recommendation: z.string().optional(),
  note: z.string().optional(),
});

const FixtureSubject = z.object({
  legalName: z.string(),
  tradeName: z.string().nullable(),
  gstin: z.string(),
  pan: z.string(),
  cin: z.string().nullable(),
  udyamNumber: z.string().nullable(),
  stateCode: z.string(),
  entityType: z.string(),
});

// Adapter payloads stay untyped here; lib/adapters/schemas.ts parses them per adapter
const Snapshot = z.object({
  label: z.string(),
  note: z.string().optional(),
  adapters: z.partialRecord(AdapterId, z.record(z.string(), z.unknown())),
});

const FixtureCompany = z.object({
  key: z.string(),
  synthetic: z.literal(true),
  subject: FixtureSubject,
  expected: Expected,
  expectedAfterChange: Expected.optional(),
  snapshots: z.array(Snapshot).min(1),
});

const FixtureFile = z.object({
  demoToday: z.string().date(),
  companies: z.array(FixtureCompany),
});

export type FixtureCompany = z.infer<typeof FixtureCompany>;
export type FixtureSnapshot = z.infer<typeof Snapshot>;

const fixtures = FixtureFile.parse(raw);

export const demoToday = fixtures.demoToday;

export function listDemoCompanies(): FixtureCompany[] {
  return fixtures.companies;
}

export function findDemoCompanyByGstin(gstin: string): FixtureCompany | undefined {
  return fixtures.companies.find((c) => c.subject.gstin === gstin);
}

export function findSnapshot(company: FixtureCompany, label: string): FixtureSnapshot | undefined {
  return company.snapshots.find((s) => s.label === label);
}
