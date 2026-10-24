import { GST_STATES } from "@/lib/identifiers/states";
import { nameSimilarity } from "@/lib/identifiers/names";
import type { AdapterInput } from "./types";

interface PartyText {
  summary: string;
  partyName?: string | null;
  partyDetails?: string | null;
}

// A different name is a different company, whatever else lines up
const SAME_NAME_THRESHOLD = 0.85;
const DIFFERENT_NAME_CAP = 0.4;
const BASE = 0.4;
const STATE_WEIGHT = 0.3;
const CITY_WEIGHT = 0.2;
const DIRECTOR_WEIGHT = 0.3;

const mentions = (text: string, needle: string | undefined) =>
  Boolean(needle) && text.toLowerCase().includes((needle as string).toLowerCase());

// Party-name searches return same-name entities, so confidence comes from overlap with what we
// know about the subject. Below 0.7 the scorer shows "possible match" and applies no penalty.
export function matchConfidence(item: PartyText, input: AdapterInput): number {
  if (input.legalName && item.partyName) {
    if (nameSimilarity(input.legalName, item.partyName) < SAME_NAME_THRESHOLD)
      return DIFFERENT_NAME_CAP;
  }
  const text = `${item.partyDetails ?? ""} ${item.summary}`;
  const state = input.stateCode ? GST_STATES[input.stateCode] : undefined;

  let confidence = BASE;
  if (mentions(text, state)) confidence += STATE_WEIGHT;
  if (mentions(text, input.city)) confidence += CITY_WEIGHT;
  if (input.directors?.some((d) => mentions(text, d.name))) confidence += DIRECTOR_WEIGHT;
  return Math.min(1, Math.round(confidence * 100) / 100);
}
