import { runAgentSource } from "./agent";
import { GstOutput, type GstData } from "./schemas";
import type { SourceAdapter } from "./types";

// Public taxpayer search; the portal normally asks for a CAPTCHA, which we report rather than bypass
const GST_SEARCH_URL = "https://services.gst.gov.in/services/searchtp";

const SCHEMA_HINT = `{"status":"ok"|"not_found"|"captcha_blocked","legalName":string|null,"tradeName":string|null,"gstin":string,"registrationStatus":string|null,"registrationDate":string|null,"cancellationDate":string|null,"constitution":string|null,"taxpayerType":string|null,"stateJurisdiction":string|null,"centreJurisdiction":string|null,"businessActivities":string[],"principalPlace":string|null,"returns":[{"period":"YYYY-MM","form":"GSTR-1"|"GSTR-3B","status":"Filed"|"Not Filed","filedDate":string|null}]}. If the return history is not publicly shown, use "returns": [].`;

export const gstAdapter: SourceAdapter<GstData> = {
  id: "gst",
  label: "GST taxpayer search",
  requires: [["gstin"]],
  tier: "agent",
  run: (input, ctx) =>
    runAgentSource({
      ctx,
      url: GST_SEARCH_URL,
      label: "GST taxpayer search",
      task: `Search for GSTIN ${input.gstin}. Read the taxpayer details. Then, only if it is publicly available without logging in, read the GSTR-1 and GSTR-3B return status for the last 12 months.`,
      schemaHint: SCHEMA_HINT,
      schema: GstOutput,
    }),
};
