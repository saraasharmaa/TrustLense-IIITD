import { describe, expect, it } from "vitest";
import { ADAPTER_ORDER } from "@/lib/adapters/registry";
import { createCase } from "./createCase";

const body = (extra: object) => ({ sources: ADAPTER_ORDER, fresh: false, ...extra });

describe("createCase validation", () => {
  it("rejects a GSTIN with a bad checksum before touching the database", async () => {
    await expect(createCase(body({ gstin: "33AABCS7345M1Z4" }))).rejects.toMatchObject({
      code: "invalid_identifier",
      details: { check: "checksum" },
    });
  });

  it("rejects a malformed CIN and Udyam number", async () => {
    await expect(createCase(body({ cin: "nope" }))).rejects.toMatchObject({
      code: "invalid_identifier",
    });
    await expect(createCase(body({ udyamNumber: "UDYAM-1" }))).rejects.toMatchObject({
      code: "invalid_identifier",
    });
  });

  it("requires at least one identifier", async () => {
    await expect(createCase(body({ legalName: "Acme" }))).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
