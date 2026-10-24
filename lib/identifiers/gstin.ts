import { GST_STATES } from "./states";
import { fail, type IdentifierResult } from "./types";

const GSTIN_FORMAT = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const CHECKSUM_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Weight 1 on even positions and 2 on odd; each product is folded back into base 36 (FR-1.2).
function expectedChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < first14.length; i++) {
    const product = CHECKSUM_ALPHABET.indexOf(first14.charAt(i)) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHECKSUM_ALPHABET.charAt((36 - (sum % 36)) % 36);
}

export type GstinDetails = { gstin: string; stateCode: string; stateName: string };

export function validateGstin(input: string): IdentifierResult<GstinDetails> {
  const gstin = input.trim().toUpperCase();
  if (!GSTIN_FORMAT.test(gstin)) {
    return fail("format", "GSTIN must be 15 characters in the official GSTIN pattern");
  }
  const stateCode = gstin.slice(0, 2);
  const stateName = GST_STATES[stateCode];
  if (!stateName) return fail("state", `GSTIN state code ${stateCode} is not a known GST state`);
  if (expectedChecksum(gstin.slice(0, 14)) !== gstin.charAt(14)) {
    return fail("checksum", "GSTIN checksum is invalid");
  }
  return { ok: true, value: { gstin, stateCode, stateName } };
}
