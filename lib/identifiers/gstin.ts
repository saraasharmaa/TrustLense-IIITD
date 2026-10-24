import { GST_STATES } from "./states";
import { fail, type IdentifierResult } from "./types";

const GSTIN_FORMAT = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export type GstinDetails = { gstin: string; stateCode: string; stateName: string };

export function validateGstin(input: string): IdentifierResult<GstinDetails> {
  const gstin = input.trim().toUpperCase();
  if (!GSTIN_FORMAT.test(gstin)) {
    return fail("format", "GSTIN must be 15 characters in the official GSTIN pattern");
  }
  const stateCode = gstin.slice(0, 2);
  const stateName = GST_STATES[stateCode];
  if (!stateName) return fail("state", `GSTIN state code ${stateCode} is not a known GST state`);
  return { ok: true, value: { gstin, stateCode, stateName } };
}
