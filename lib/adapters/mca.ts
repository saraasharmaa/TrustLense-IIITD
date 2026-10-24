import { runAgentSource } from "./agent";
import { McaOutput, type McaData } from "./schemas";
import type { SourceAdapter } from "./types";

// Public company master data view; if it asks for a CAPTCHA or login the run is reported as blocked
const MCA_MASTER_DATA_URL = "https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html";

const SCHEMA_HINT = `{"status":"ok"|"not_found"|"captcha_blocked","cin":string|null,"companyName":string|null,"companyStatus":string|null,"incorporationDate":string|null,"category":string|null,"companyClass":string|null,"authorizedCapital":number|null,"paidUpCapital":number|null,"registeredAddress":string|null,"lastAgmDate":string|null,"lastBalanceSheetDate":string|null,"directors":[{"din":string|null,"name":string,"appointmentDate":string|null,"disqualified":boolean|null}],"charges":[{"chargeHolder":string,"amount":number|null,"creationDate":string|null,"status":"Open"|"Satisfied"}]|null}. Use "charges": null when the charges register is not publicly shown without payment; use [] only if it is shown and empty.`;

export const mcaAdapter: SourceAdapter<McaData> = {
  id: "mca",
  label: "MCA company master data",
  requires: [["cin"], ["legalName"]],
  tier: "agent",
  run: (input, ctx) => {
    const subject = input.cin ? `CIN ${input.cin}` : `company name "${input.legalName}"`;
    return runAgentSource({
      ctx,
      url: MCA_MASTER_DATA_URL,
      label: "MCA company master data",
      task: `Look up ${subject} in the public company master data view. Read the company details and the list of directors. Read registered charges only if they are shown without payment.`,
      schemaHint: SCHEMA_HINT,
      schema: McaOutput,
    });
  },
};
