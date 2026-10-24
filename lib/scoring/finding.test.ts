import { describe, expect, it } from "vitest";
import { clip, readSource } from "./finding";
import { outcome, outcomesOf } from "./test-utils";

const udyamNotFound = { status: "not_found" };

describe("clip", () => {
  it("leaves short text and shortens long text to the limit", () => {
    expect(clip("short")).toBe("short");
    expect(clip("x".repeat(400))).toHaveLength(300);
  });
});

describe("readSource", () => {
  it("returns parsed data and evidence tied to the source run", () => {
    const o = outcome(udyamNotFound, { status: "not_found" });
    const source = readSource("udyam", outcomesOf({ udyam: o }));
    expect(source?.data).toEqual(udyamNotFound);
    expect(source?.evidence("Udyam not found")).toEqual({
      sourceRunId: o.sourceRunId,
      adapter: "udyam",
      url: o.evidenceUrl,
      retrievedAt: o.retrievedAt,
      excerpt: "Udyam not found",
      isReplay: true,
    });
  });

  it("points evidence at the item URL only when it is a valid URL", () => {
    const source = readSource("udyam", outcomesOf({ udyam: outcome(udyamNotFound) }));
    expect(source?.evidence("x", "https://example.invalid/case/1").url).toBe(
      "https://example.invalid/case/1",
    );
    expect(source?.evidence("x", "not a url").url).toBe("https://example.invalid/replay/test");
  });

  it("keeps the original timestamp of carried-forward data", () => {
    const o = outcome(udyamNotFound, {
      status: "carried_forward",
      retrievedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(readSource("udyam", outcomesOf({ udyam: o }))?.evidence("x").retrievedAt).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it.each(["failed", "timeout", "captcha_blocked", "skipped"] as const)(
    "ignores a %s outcome",
    (status) => {
      expect(readSource("udyam", outcomesOf({ udyam: outcome(undefined, { status }) }))).toBeNull();
    },
  );

  it("returns null when the adapter is missing, has no source URL or fails the schema", () => {
    expect(readSource("udyam", outcomesOf({}))).toBeNull();
    expect(
      readSource(
        "udyam",
        outcomesOf({ udyam: outcome(udyamNotFound, { evidenceUrl: undefined }) }),
      ),
    ).toBeNull();
    expect(readSource("udyam", outcomesOf({ udyam: outcome({ status: "weird" }) }))).toBeNull();
  });
});
