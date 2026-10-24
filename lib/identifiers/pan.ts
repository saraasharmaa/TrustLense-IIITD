import { fail, type IdentifierResult } from "./types";

const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// The 4th PAN character encodes the holder type (FR-1.2).
const ENTITY_TYPES: Record<string, string> = {
  C: "Company",
  F: "Firm/LLP",
  P: "Individual",
  H: "HUF",
  A: "AOP",
  T: "Trust",
  B: "BOI",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government",
};

export type PanDetails = { pan: string; entityType: string };

export function validatePan(input: string): IdentifierResult<PanDetails> {
  const pan = input.trim().toUpperCase();
  if (!PAN_FORMAT.test(pan)) {
    return fail("format", "PAN must be 5 letters, 4 digits and 1 letter");
  }
  const entityType = ENTITY_TYPES[pan.charAt(3)];
  if (!entityType) return fail("format", "PAN has an unknown holder type in its 4th character");
  return { ok: true, value: { pan, entityType } };
}
