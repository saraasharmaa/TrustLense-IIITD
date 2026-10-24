import { describe, expect, it } from "vitest";
import { matchConfidence } from "./legal-match";

const subject = {
  legalName: "Sunrise Textiles Pvt Ltd",
  stateCode: "33",
  city: "Tiruppur",
  directors: [{ name: "Anil Kumar" }],
};

describe("matchConfidence", () => {
  it("is low when nothing but the name lines up", () => {
    expect(matchConfidence({ summary: "Recovery suit" }, subject)).toBe(0.4);
  });

  it("reaches the 0.7 threshold with the subject's state", () => {
    expect(matchConfidence({ summary: "Madras High Court, Tamil Nadu" }, subject)).toBe(0.7);
  });

  it("adds city and director overlap, capped at 1", () => {
    const item = { summary: "Tiruppur, Tamil Nadu", partyDetails: "R2: Anil Kumar, director" };
    expect(matchConfidence(item, subject)).toBe(1);
  });

  it("keeps same-name companies in another state below the threshold", () => {
    const item = { summary: "Sunrise Textiles Pvt Ltd, Surat, Gujarat" };
    expect(matchConfidence(item, subject)).toBeLessThan(0.7);
  });

  it("caps a party with a different name even when the state matches", () => {
    const item = { summary: "Tamil Nadu", partyName: "Sunrise Traders LLP" };
    expect(matchConfidence(item, subject)).toBe(0.4);
  });

  it("accepts a party name that is the same company written differently", () => {
    const item = { summary: "Tamil Nadu", partyName: "SUNRISE TEXTILES PRIVATE LIMITED" };
    expect(matchConfidence(item, subject)).toBe(0.7);
  });
});
