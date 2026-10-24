import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Finding, ScoreResult } from "@/lib/types";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const result: ScoreResult = {
  score: 66,
  grade: "C",
  recommendation: "Manual review required",
  hardStops: [],
  coverage: 1,
  isProvisional: false,
  categoryBreakdown: [],
  rulesVersion: "1.0.0",
};

const findings: Finding[] = [
  {
    id: "f1",
    ruleId: "GST-03",
    category: "STATUTORY",
    severity: "medium",
    title: "Repeated missed GSTR-3B",
    detail: "Four returns not filed",
    penalty: 8,
    appliedPenalty: 8,
    hardStop: false,
    confidence: 1,
    fingerprint: "f1",
    evidence: [],
  },
];

const reply = (obj: object) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });
const draft = {
  headline: "Grade C",
  summary: "Returns were missed.",
  keyRisks: [{ text: "Missed returns", findingIds: ["f1"] }],
  strengths: [],
  suggestedConditions: [],
  questionsForBorrower: [],
};

async function build(key: string | undefined) {
  vi.stubEnv("DATABASE_URL", "postgres://x");
  vi.stubEnv("ANTHROPIC_API_KEY", key ?? "");
  vi.resetModules();
  const { buildNarrative } = await import("./narrative");
  return buildNarrative(findings, result);
}

beforeEach(() => create.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe("buildNarrative", () => {
  it("uses the template when no API key is configured, without calling the model", async () => {
    expect((await build(undefined)).source).toBe("template");
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the model narrative when it passes validation", async () => {
    create.mockResolvedValue(reply(draft));
    expect(await build("k")).toMatchObject({ source: "llm", headline: "Grade C" });
  });

  it("falls back to the template when the model cites a finding that does not exist", async () => {
    create.mockResolvedValue(reply({ ...draft, keyRisks: [{ text: "x", findingIds: ["ghost"] }] }));
    expect((await build("k")).source).toBe("template");
  });

  it("falls back to the template on invalid JSON or an API error", async () => {
    create.mockResolvedValueOnce({ content: [{ type: "text", text: "sorry" }] });
    expect((await build("k")).source).toBe("template");
    create.mockRejectedValueOnce(new Error("503"));
    expect((await build("k")).source).toBe("template");
  });

  it("falls back when the summary invents a rupee amount", async () => {
    create.mockResolvedValue(reply({ ...draft, summary: "Exposure of ₹9,99,999 is at risk." }));
    expect((await build("k")).source).toBe("template");
  });
});
