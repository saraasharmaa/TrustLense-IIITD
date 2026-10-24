import { describe, expect, it } from "vitest";
import { adverseFindings } from "./adverse";
import { NOW, outcome, outcomesOf } from "./test-utils";

let counter = 0;

function article(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    title: "Unit faces unrest",
    url: `https://example.invalid/news/${counter}`,
    publishedDate: "2026-06-14",
    source: "Demo Times",
    snippet: "Workers protested over delayed wages.",
    category: "labour_dispute",
    severity: "medium",
    entityMatchConfidence: 0.85,
    ...overrides,
  };
}

function news(articles: unknown[]) {
  return { status: "ok", articles };
}

function regulatory(matches: unknown[]) {
  return { status: "ok", matches };
}

function match(overrides: Record<string, unknown> = {}) {
  return {
    list: "SEBI_ORDERS",
    matchedName: "Sunrise Textiles",
    matchType: "company",
    confidence: 0.9,
    date: null,
    summary: "Order against the company",
    url: "https://example.invalid/sebi/1",
    ...overrides,
  };
}

function runNews(articles: unknown[]) {
  return adverseFindings(outcomesOf({ news: outcome(news(articles)) }), NOW);
}

function runRegulatory(matches: unknown[]) {
  return adverseFindings(outcomesOf({ regulatory: outcome(regulatory(matches)) }), NOW);
}

describe("NEWS-01 and NEWS-02", () => {
  it("scores a high-severity article −12 and a medium one −6", () => {
    expect(runNews([article({ severity: "high" })])[0]).toMatchObject({
      ruleId: "NEWS-01",
      severity: "high",
      penalty: 12,
    });
    expect(runNews([article({ severity: "medium" })])[0]).toMatchObject({
      ruleId: "NEWS-02",
      severity: "medium",
      penalty: 6,
    });
  });

  it("ignores low and none severity", () => {
    expect(runNews([article({ severity: "low" }), article({ severity: "none" })])).toEqual([]);
  });

  it("scores at confidence 0.7 and not at 0.69", () => {
    expect(runNews([article({ entityMatchConfidence: 0.7 })])[0]?.ruleId).toBe("NEWS-02");
    expect(runNews([article({ entityMatchConfidence: 0.69 })])[0]).toMatchObject({
      ruleId: "NEWS-POSSIBLE",
      severity: "info",
      penalty: 0,
      title: "Possible match — verify",
    });
  });

  // NOW is 2026-10-24: 2024-10-24 is exactly 24 months old
  it.each([
    ["2024-10-24", "NEWS-02"],
    ["2024-10-23", "NEWS-STALE"],
    ["2020-01-01", "NEWS-STALE"],
  ])("article dated %s → %s", (publishedDate, ruleId) => {
    expect(runNews([article({ publishedDate })])[0]?.ruleId).toBe(ruleId);
  });

  it("never scores an undated article", () => {
    expect(runNews([article({ publishedDate: null })])[0]).toMatchObject({
      ruleId: "NEWS-STALE",
      penalty: 0,
    });
  });

  it("gives every article its own finding, evidence and URL fingerprint", () => {
    const a = article({ severity: "high" });
    const b = article({ severity: "high" });
    const findings = runNews([a, b]);
    expect(findings.map((f) => f.fingerprint)).toEqual([`NEWS:${a.url}`, `NEWS:${b.url}`]);
    expect(findings[0]?.evidence[0]).toMatchObject({ url: a.url, adapter: "news" });
    expect(findings[0]?.evidence[0]?.excerpt).toContain("Workers protested");
  });
});

describe("NEWS-03 positive news", () => {
  it("is info with no penalty at confidence 0.7 or more", () => {
    expect(runNews([article({ category: "positive_growth", severity: "none" })])[0]).toMatchObject({
      ruleId: "NEWS-03",
      severity: "info",
      penalty: 0,
    });
  });

  it("is dropped below 0.7", () => {
    const low = article({
      category: "positive_growth",
      severity: "none",
      entityMatchConfidence: 0.5,
    });
    expect(runNews([low])).toEqual([]);
  });
});

describe("REG-01 regulatory matches", () => {
  it.each(["SEBI_ORDERS", "IBBI", "OTHER"])("%s at 0.8 scores −10", (list) => {
    expect(runRegulatory([match({ list, confidence: 0.8 })])[0]).toMatchObject({
      ruleId: "REG-01",
      severity: "high",
      penalty: 10,
      fingerprint: "REG-01:https://example.invalid/sebi/1",
    });
  });

  it("does not score below 0.8", () => {
    expect(runRegulatory([match({ confidence: 0.79 })])[0]).toMatchObject({
      ruleId: "REG-POSSIBLE",
      penalty: 0,
      severity: "info",
    });
  });

  it("leaves the MCA disqualified list to MCA-03", () => {
    expect(runRegulatory([match({ list: "MCA_DISQUALIFIED_DIRECTORS" })])).toEqual([]);
  });
});

describe("unusable adverse data", () => {
  it.each([{ status: "not_found" }, { status: "captcha_blocked" }])(
    "yields nothing for %j",
    (page) => {
      expect(
        adverseFindings(outcomesOf({ news: outcome(page), regulatory: outcome(page) }), NOW),
      ).toEqual([]);
    },
  );
});
