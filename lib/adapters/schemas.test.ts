import { describe, expect, it } from "vitest";
import { listDemoCompanies } from "@/lib/demo/fixtures";
import { adapterSchemas, parseWith } from "./schemas";

describe("adapter schemas", () => {
  it("accept every fixture adapter payload", () => {
    for (const company of listDemoCompanies()) {
      for (const snapshot of company.snapshots) {
        for (const [adapter, payload] of Object.entries(snapshot.adapters)) {
          const schema = adapterSchemas[adapter as keyof typeof adapterSchemas];
          expect(
            () => parseWith(schema, payload, adapter),
            `${company.key}/${adapter}`,
          ).not.toThrow();
        }
      }
    }
  });

  it("rejects a payload with a wrong type and names the field", () => {
    const bad = { status: "ok", articles: [{ title: 5 }] };
    expect(() => parseWith(adapterSchemas.news, bad, "news output")).toThrow(
      /news output failed validation at articles\.0\.title/,
    );
  });
});
