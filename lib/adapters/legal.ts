import { runAgentSource } from "./agent";
import { matchConfidence } from "./legal-match";
import { LegalOutput, type LegalData } from "./schemas";
import type { AdapterInput, AdapterResult, SourceAdapter } from "./types";

const ECOURTS_URL = "https://services.ecourts.gov.in/ecourtindia_v6/";
const IBBI_URL = "https://ibbi.gov.in/public-announcement";

const CASE_HINT = `{"status":"ok"|"not_found"|"captcha_blocked","searchedNames":string[],"cases":[{"forum":"eCourts"|"NCLT"|"HighCourt"|"DRT"|"Other","caseNumber":string,"caseType":string,"filingDate":string|null,"role":"Petitioner"|"Respondent"|"Other","status":"Pending"|"Disposed"|"Unknown","summary":string,"url":string,"partyName":string|null,"partyDetails":string|null}],"insolvencyNotices":[]}. partyName and partyDetails are the party name and address exactly as shown.`;

const NOTICE_HINT = `{"status":"ok"|"not_found"|"captcha_blocked","searchedNames":string[],"cases":[],"insolvencyNotices":[{"source":string,"noticeType":string,"date":string|null,"summary":string,"url":string,"partyName":string|null,"partyDetails":string|null}]}. partyName and partyDetails are the debtor name and address exactly as shown.`;

function names(input: AdapterInput): string {
  return [input.legalName, input.tradeName]
    .filter(Boolean)
    .map((n) => `"${n}"`)
    .join(" and ");
}

type Page = AdapterResult<LegalData>;

// Both sources must be reached: a block on one must never read as "no cases found"
function combine(court: Page, notices: Page): Page {
  const stopped = [court, notices].find(
    (r) => r.status !== "succeeded" && r.status !== "not_found",
  );
  if (stopped)
    return {
      ...stopped,
      normalized: undefined,
      rawOutput: { court: court.rawOutput, notices: notices.rawOutput },
    };
  const parts = [court.normalized, notices.normalized].filter((p) => p?.status === "ok") as Extract<
    LegalData,
    { status: "ok" }
  >[];
  const rawOutput = { court: court.rawOutput, notices: notices.rawOutput };
  if (parts.length === 0) {
    return {
      status: "not_found",
      normalized: { status: "not_found" },
      rawOutput,
      evidenceUrl: ECOURTS_URL,
      isReplay: false,
    };
  }
  return {
    status: "succeeded",
    normalized: {
      status: "ok",
      searchedNames: [...new Set(parts.flatMap((p) => p.searchedNames))],
      cases: parts.flatMap((p) => p.cases),
      insolvencyNotices: parts.flatMap((p) => p.insolvencyNotices),
    },
    rawOutput,
    evidenceUrl: ECOURTS_URL,
    tinyfishRunId: court.tinyfishRunId,
    isReplay: false,
  };
}

function withConfidence(result: Page, input: AdapterInput): Page {
  const data = result.normalized;
  if (data?.status !== "ok") return result;
  return {
    ...result,
    normalized: {
      ...data,
      cases: data.cases.map((c) => ({ ...c, matchConfidence: matchConfidence(c, input) })),
      insolvencyNotices: data.insolvencyNotices.map((n) => ({
        ...n,
        matchConfidence: matchConfidence(n, input),
      })),
    },
  };
}

export const legalAdapter: SourceAdapter<LegalData> = {
  id: "legal",
  label: "Courts and insolvency",
  requires: [["legalName"]],
  tier: "agent",
  async run(input, ctx) {
    const place = input.stateCode
      ? ` Prefer results from the state with GST code ${input.stateCode}.`
      : "";
    const [court, notices] = await Promise.all([
      runAgentSource({
        ctx,
        url: ECOURTS_URL,
        label: "eCourts case search",
        task: `Search case status by party name for ${names(input)}.${place} List pending and recent cases with the role of the searched party.`,
        schemaHint: CASE_HINT,
        schema: LegalOutput,
      }),
      runAgentSource({
        ctx,
        url: IBBI_URL,
        label: "IBBI public announcements",
        task: `Search the public announcements for ${names(input)}. List any insolvency or liquidation notices.`,
        schemaHint: NOTICE_HINT,
        schema: LegalOutput,
      }),
    ]);
    return withConfidence(combine(court, notices), input);
  },
};
