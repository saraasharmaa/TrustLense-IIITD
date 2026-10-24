import { CIN_STATES } from "./states";
import { fail, type IdentifierResult } from "./types";

const CIN_FORMAT = /^([LU])\d{5}([A-Z]{2})(\d{4})[A-Z]{3}\d{6}$/;

export type CinDetails = {
  cin: string;
  listingStatus: "Listed" | "Unlisted";
  // null when the letters are not in our table: the CIN is still format-valid, so we do not reject it
  stateName: string | null;
  incorporationYear: number;
};

export function validateCin(input: string): IdentifierResult<CinDetails> {
  const cin = input.trim().toUpperCase();
  const match = CIN_FORMAT.exec(cin);
  if (!match) {
    return fail("format", "CIN must be 21 characters: L or U, 5 digits, state, year, type, number");
  }
  const [, listing, stateLetters, year] = match;
  return {
    ok: true,
    value: {
      cin,
      listingStatus: listing === "L" ? "Listed" : "Unlisted",
      stateName: CIN_STATES[stateLetters ?? ""] ?? null,
      incorporationYear: Number(year),
    },
  };
}
