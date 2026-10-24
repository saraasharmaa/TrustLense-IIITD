import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { AdapterId } from "@/lib/types";

const date = z.string().nullable();

// The agent returns only {"status": ...} when a record is missing or a CAPTCHA blocks it
const emptyPage = z.object({ status: z.enum(["not_found", "captcha_blocked"]) });

function withEmptyPage<T extends z.ZodRawShape>(fields: T) {
  return z.union([z.object({ status: z.literal("ok"), ...fields }), emptyPage]);
}

export const GstOutput = withEmptyPage({
  legalName: z.string().nullable(),
  tradeName: z.string().nullable(),
  gstin: z.string(),
  registrationStatus: z.string().nullable(),
  registrationDate: date,
  cancellationDate: date,
  constitution: z.string().nullable(),
  taxpayerType: z.string().nullable(),
  stateJurisdiction: z.string().nullable(),
  centreJurisdiction: z.string().nullable(),
  businessActivities: z.array(z.string()),
  principalPlace: z.string().nullable(),
  returns: z.array(
    z.object({
      period: z.string(),
      form: z.enum(["GSTR-1", "GSTR-3B"]),
      status: z.enum(["Filed", "Not Filed"]),
      filedDate: date,
    }),
  ),
});

export const McaOutput = withEmptyPage({
  cin: z.string().nullable(),
  companyName: z.string().nullable(),
  companyStatus: z.string().nullable(),
  incorporationDate: date,
  category: z.string().nullable(),
  companyClass: z.string().nullable(),
  authorizedCapital: z.number().nullable(),
  paidUpCapital: z.number().nullable(),
  registeredAddress: z.string().nullable(),
  lastAgmDate: date,
  lastBalanceSheetDate: date,
  directors: z.array(
    z.object({
      din: z.string().nullable(),
      name: z.string(),
      appointmentDate: date,
      disqualified: z.boolean().nullable(),
    }),
  ),
  // null means the charges register was unavailable, not that there are none
  charges: z
    .array(
      z.object({
        chargeHolder: z.string(),
        amount: z.number().nullable(),
        creationDate: date,
        status: z.enum(["Open", "Satisfied"]),
      }),
    )
    .nullable(),
});

// matchConfidence is set by the normaliser from state/city/director overlap
const matchConfidence = z.number().min(0).max(1).optional();

export const LegalOutput = withEmptyPage({
  searchedNames: z.array(z.string()),
  cases: z.array(
    z.object({
      forum: z.enum(["eCourts", "NCLT", "HighCourt", "DRT", "Other"]),
      caseNumber: z.string(),
      caseType: z.string(),
      filingDate: date,
      role: z.enum(["Petitioner", "Respondent", "Other"]),
      status: z.enum(["Pending", "Disposed", "Unknown"]),
      summary: z.string(),
      url: z.string(),
      matchConfidence,
    }),
  ),
  insolvencyNotices: z.array(
    z.object({
      source: z.string(),
      noticeType: z.string(),
      date,
      summary: z.string(),
      url: z.string(),
      matchConfidence,
    }),
  ),
});

export const UdyamOutput = withEmptyPage({
  udyamNumber: z.string().nullable(),
  enterpriseName: z.string().nullable(),
  enterpriseType: z.enum(["Micro", "Small", "Medium"]).nullable(),
  majorActivity: z.string().nullable(),
  registrationDate: date,
  state: z.string().nullable(),
  nicCodes: z.array(z.string()),
});

// News has no CAPTCHA state: not_found means a clean search, not a failure
export const NewsOutput = z.union([
  z.object({ status: z.literal("not_found") }),
  z.object({
    status: z.literal("ok"),
    articles: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        publishedDate: date,
        source: z.string(),
        snippet: z.string(),
        category: z.enum([
          "fraud",
          "default",
          "insolvency",
          "regulatory_action",
          "labour_dispute",
          "closure",
          "positive_growth",
          "other",
        ]),
        severity: z.enum(["high", "medium", "low", "none"]),
        entityMatchConfidence: z.number().min(0).max(1),
      }),
    ),
  }),
]);

export const RegulatoryOutput = withEmptyPage({
  matches: z.array(
    z.object({
      list: z.enum(["SEBI_ORDERS", "MCA_DISQUALIFIED_DIRECTORS", "IBBI", "OTHER"]),
      matchedName: z.string(),
      matchType: z.enum(["company", "director"]),
      confidence: z.number().min(0).max(1),
      date,
      summary: z.string(),
      url: z.string(),
    }),
  ),
});

export const adapterSchemas = {
  gst: GstOutput,
  mca: McaOutput,
  legal: LegalOutput,
  udyam: UdyamOutput,
  news: NewsOutput,
  regulatory: RegulatoryOutput,
} satisfies Record<AdapterId, z.ZodType>;

export type GstData = z.infer<typeof GstOutput>;
export type McaData = z.infer<typeof McaOutput>;
export type LegalData = z.infer<typeof LegalOutput>;
export type UdyamData = z.infer<typeof UdyamOutput>;
export type NewsData = z.infer<typeof NewsOutput>;
export type RegulatoryData = z.infer<typeof RegulatoryOutput>;

// For a union the useful issue is in the branch that got furthest, not the root "no branch matched"
function mostSpecificIssue(issue: z.core.$ZodIssue | undefined): z.core.$ZodIssue | undefined {
  if (issue?.code !== "invalid_union") return issue;
  const deepest = issue.errors
    .map((branch) => mostSpecificIssue(branch[0]))
    .reduce(
      (best, next) => ((next?.path.length ?? 0) > (best?.path.length ?? 0) ? next : best),
      issue,
    );
  return deepest;
}

// The one place outside data (TinyFish, fixtures, LLM) is checked; no coercion on failure
export function parseWith<S extends z.ZodType>(
  schema: S,
  data: unknown,
  what: string,
): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = mostSpecificIssue(result.error.issues[0]);
    const where = issue?.path.join(".") || "(root)";
    throw new AppError("internal", `${what} failed validation at ${where}: ${issue?.message}`);
  }
  return result.data;
}
