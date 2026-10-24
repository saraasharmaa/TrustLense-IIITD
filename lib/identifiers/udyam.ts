import { fail, type IdentifierResult } from "./types";

const UDYAM_FORMAT = /^UDYAM-([A-Z]{2})-\d{2}-\d{7}$/;

export type UdyamDetails = { udyamNumber: string; stateLetters: string };

export function validateUdyam(input: string): IdentifierResult<UdyamDetails> {
  const udyamNumber = input.trim().toUpperCase();
  const match = UDYAM_FORMAT.exec(udyamNumber);
  if (!match) {
    return fail("format", "Udyam number must look like UDYAM-XX-00-0000000");
  }
  return { ok: true, value: { udyamNumber, stateLetters: match[1] ?? "" } };
}
