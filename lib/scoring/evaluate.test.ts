import { describe, expect, it } from "vitest";
import type { SourceOutcomes } from "@/lib/adapters/types";
import { demoToday, listDemoCompanies } from "@/lib/demo/fixtures";
import type { AdapterId, SourceStatus } from "@/lib/types";
import { evaluate, score } from "./index";

const ALL_ADAPTERS: AdapterId[] = ["gst", "mca", "legal", "news", "udyam", "regulatory"];
const NOW = new Date(demoToday);

// Mirrors the reference script: each snapshot overlays the previous one, and adapters the new
// snapshot does not re-run are carried forward from the earlier one.
function outcomesAfter(company: ReturnType<typeof listDemoCompanies>[number], label: string) {
  const outcomes: SourceOutcomes = {};
  for (const snapshot of company.snapshots) {
    for (const adapter of Object.keys(outcomes) as AdapterId[]) {
      const previous = outcomes[adapter];
      if (previous) outcomes[adapter] = { ...previous, status: "carried_forward" };
    }
    for (const [adapter, payload] of Object.entries(snapshot.adapters) as [
      AdapterId,
      Record<string, unknown>,
    ][]) {
      const status: SourceStatus =
        payload.status === "ok" ? "succeeded" : (payload.status as SourceStatus);
      outcomes[adapter] = {
        sourceRunId: crypto.randomUUID(),
        status,
        normalized: payload,
        evidenceUrl: `https://example.invalid/replay/${adapter}/${company.key}`,
        retrievedAt: `${demoToday}T08:00:00.000Z`,
        isReplay: true,
      };
    }
    if (snapshot.label === label) break;
  }
  return outcomes;
}

function run(key: string, label: string) {
  const company = listDemoCompanies().find((c) => c.key === key);
  if (!company) throw new Error(`no fixture ${key}`);
  const outcomes = outcomesAfter(company, label);
  const findings = evaluate(outcomes, { now: NOW, requested: ALL_ADAPTERS });
  return { company, outcomes, findings, result: score(findings, outcomes) };
}

function applied(result: ReturnType<typeof score>) {
  return Object.fromEntries(result.categoryBreakdown.map((c) => [c.category, c.applied]));
}

// Expected values are the output of `python3 fixtures/score_reference.py`
describe("fixture parity with score_reference.py", () => {
  it("Aravali scores 97 / A", () => {
    const { company, result } = run("aravali", "t0");
    expect(result).toMatchObject({
      score: 97,
      grade: "A",
      hardStops: [],
      coverage: 1,
      isProvisional: false,
    });
    expect(result.recommendation).toBe(company.expected.recommendation);
    expect(applied(result)).toEqual({
      STATUTORY: 0,
      CORPORATE: 0,
      LEGAL: 3,
      ADVERSE: 0,
      LEGITIMACY: 0,
    });
  });

  it("Sunrise scores 66 / C before the change", () => {
    const { company, result } = run("sunrise", "t0");
    expect(result).toMatchObject({ score: 66, grade: "C", hardStops: [], coverage: 1 });
    expect(result.recommendation).toBe(company.expected.recommendation);
    expect(applied(result)).toEqual({
      STATUTORY: 8,
      CORPORATE: 8,
      LEGAL: 12,
      ADVERSE: 6,
      LEGITIMACY: 0,
    });
  });

  it("Sunrise scores 38 / D with a hard stop after GST is suspended", () => {
    const { result } = run("sunrise", "t1");
    expect(result).toMatchObject({
      score: 38,
      grade: "D",
      hardStops: ["GST registration suspended"],
      coverage: 1,
    });
    expect(result.recommendation).toBe(
      "Escalate – high risk (hard stop: GST registration suspended)",
    );
    expect(applied(result)).toEqual({
      STATUTORY: 30,
      CORPORATE: 8,
      LEGAL: 12,
      ADVERSE: 12,
      LEGITIMACY: 0,
    });
  });

  it("Kaveri scores 9 / D with two hard stops", () => {
    const { company, result } = run("kaveri", "t0");
    expect(result).toMatchObject({
      score: 9,
      grade: "D",
      hardStops: ["GST registration cancelled", "Insolvency proceedings"],
    });
    expect(result.recommendation).toBe(company.expected.recommendation);
    expect(applied(result)).toEqual({
      STATUTORY: 30,
      CORPORATE: 20,
      LEGAL: 25,
      ADVERSE: 12,
      LEGITIMACY: 4,
    });
  });

  it("matches the expected score and grade stored in every fixture", () => {
    for (const company of listDemoCompanies()) {
      const t0 = run(company.key, "t0").result;
      expect(t0.score).toBe(company.expected.score);
      expect(t0.grade).toBe(company.expected.grade);
      if (company.expectedAfterChange) {
        const t1 = run(company.key, "t1").result;
        expect(t1.score).toBe(company.expectedAfterChange.score);
        expect(t1.grade).toBe(company.expectedAfterChange.grade);
      }
    }
  });

  it("raises no address or name findings on the clean fixtures", () => {
    for (const key of ["aravali", "sunrise", "kaveri"]) {
      const ids = run(key, "t0").findings.map((f) => f.ruleId);
      expect(ids).not.toContain("BIZ-02");
      expect(ids).not.toContain("BIZ-03");
    }
  });
});

describe("evaluate", () => {
  it("returns findings with applied penalties that agree with the score", () => {
    const { findings, result } = run("kaveri", "t0");
    const appliedTotal = findings.reduce((sum, f) => sum + f.appliedPenalty, 0);
    expect(100 - appliedTotal).toBe(result.score);
  });

  it("gives every scored finding evidence tied to its source run", () => {
    const { findings, outcomes } = run("sunrise", "t0");
    const runIds = new Set(Object.values(outcomes).map((o) => o.sourceRunId));
    for (const finding of findings.filter((f) => f.category !== "COVERAGE")) {
      expect(finding.evidence.length).toBeGreaterThan(0);
      for (const e of finding.evidence) {
        expect(runIds.has(e.sourceRunId)).toBe(true);
        expect(e.isReplay).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    const first = run("kaveri", "t0").findings.map((f) => [f.ruleId, f.appliedPenalty]);
    const second = run("kaveri", "t0").findings.map((f) => [f.ruleId, f.appliedPenalty]);
    expect(first).toEqual(second);
  });

  it("counts carried-forward sources toward coverage and still scores their data", () => {
    const { outcomes, findings, result } = run("sunrise", "t1");
    expect(outcomes.mca?.status).toBe("carried_forward");
    expect(result.coverage).toBe(1);
    expect(findings.some((f) => f.ruleId === "MCA-02")).toBe(true);
  });

  it("reports unrequested and failed sources as coverage findings and lowers coverage", () => {
    const company = listDemoCompanies()[0];
    if (!company) throw new Error("no fixtures");
    const outcomes = outcomesAfter(company, "t0");
    delete outcomes.mca;
    delete outcomes.legal;
    delete outcomes.udyam;
    outcomes.news = { ...outcomes.news!, status: "timeout" };
    const findings = evaluate(outcomes, { now: NOW, requested: ["gst", "news"] });
    const ids = findings.filter((f) => f.category === "COVERAGE").map((f) => f.ruleId);
    expect(ids).toEqual(
      expect.arrayContaining(["COVERAGE-MCA", "COVERAGE-LEGAL", "COVERAGE-UDYAM", "COVERAGE-NEWS"]),
    );
    const result = score(findings, outcomes);
    expect(result).toMatchObject({ coverage: 0.3, isProvisional: true });
    expect(result.recommendation).toBe("Manual review required (limited coverage)");
  });
});
