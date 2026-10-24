import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { fail, orThrow } from "./types";

describe("orThrow", () => {
  it("returns the value of a valid result", () => {
    expect(orThrow({ ok: true, value: 7 })).toBe(7);
  });

  it("throws invalid_identifier carrying the failed check", () => {
    try {
      orThrow(fail("checksum", "GSTIN checksum is invalid"));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        code: "invalid_identifier",
        message: "GSTIN checksum is invalid",
        details: { check: "checksum" },
      });
    }
  });
});
