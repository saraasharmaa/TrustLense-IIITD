import { fetchCompanyMasterData } from "@/lib/sandbox/client";
import { McaOutput, parseWith, type McaData } from "./schemas";
import type { SourceAdapter } from "./types";

const MCA_PORTAL_URL = "https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html";

// Licensed-API tier for MCA. Master data has status, capital and address; it has no director list or
// filing dates, so directors stay empty and the overdue-filing rule has nothing to evaluate.
export const mcaApiAdapter: SourceAdapter<McaData> = {
  id: "mca",
  label: "MCA company master data (licensed API)",
  requires: [["cin"]],
  tier: "licensed_api",
  async run(input, ctx) {
    const cin = input.cin as string;
    try {
      ctx.emitProgress("Looking up the CIN with the licensed MCA API");
      const company = await fetchCompanyMasterData(cin);
      if (!company) {
        return { status: "not_found", normalized: { status: "not_found" }, isReplay: false };
      }
      const raw = {
        status: "ok",
        cin: company.cin,
        companyName: company.company_name,
        companyStatus: company.company_status ?? null,
        incorporationDate: company.company_registration_date ?? null,
        category: company.company_category ?? null,
        companyClass: company.company_class ?? null,
        authorizedCapital: company.authorized_capital ?? null,
        paidUpCapital: company.paidup_capital ?? null,
        registeredAddress: company.registered_office_address ?? null,
        lastAgmDate: null,
        lastBalanceSheetDate: null,
        directors: [],
        charges: null,
      };
      return {
        status: "succeeded",
        normalized: parseWith(McaOutput, raw, "MCA API output"),
        rawOutput: { provider: "sandbox.co.in", company },
        evidenceUrl: MCA_PORTAL_URL,
        isReplay: false,
      };
    } catch (err) {
      if (ctx.signal.aborted) throw err;
      const message = err instanceof Error ? err.message.slice(0, 300) : "MCA API call failed";
      return { status: "failed", error: message, isReplay: false };
    }
  },
};
