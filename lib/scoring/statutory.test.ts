import { describe, expect, it } from "vitest";
import { statutoryFindings } from "./statutory";
import { NOW, outcome, outcomesOf } from "./test-utils";

const GSTIN = "33AABCS7345M1Z3";

// 12 periods ending 2026-09, oldest first
const PERIODS = Array.from({ length: 12 }, (_, i) => {
  const index = 2025 * 12 + 9 + i;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
});

function onTime(period: string) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { period, form: "GSTR-3B", status: "Filed", filedDate: `${next}-15` };
}

function gst(
  overrides: Record<string, unknown> = {},
  notFiled: string[] = [],
  late: string[] = [],
) {
  const returns = PERIODS.map((period) => {
    if (notFiled.includes(period))
      return { period, form: "GSTR-3B", status: "Not Filed", filedDate: null };
    if (late.includes(period)) return { ...onTime(period), filedDate: "2099-01-01" };
    return onTime(period);
  });
  return {
    status: "ok",
    legalName: "Sunrise Textiles Pvt Ltd",
    tradeName: null,
    gstin: GSTIN,
    registrationStatus: "Active",
    registrationDate: "2015-01-01",
    cancellationDate: null,
    constitution: null,
    taxpayerType: null,
    stateJurisdiction: null,
    centreJurisdiction: null,
    businessActivities: [],
    principalPlace: null,
    returns,
    ...overrides,
  };
}

function run(normalized: unknown) {
  return statutoryFindings(outcomesOf({ gst: outcome(normalized) }), NOW);
}

function ruleIds(normalized: unknown) {
  return run(normalized).map((f) => f.ruleId);
}

describe("GST-01 registration status", () => {
  it.each(["Cancelled", "Suspended", "cancelled", "SUSPENDED"])("%s is a hard stop", (status) => {
    const [finding] = run(gst({ registrationStatus: status }));
    expect(finding).toMatchObject({
      ruleId: "GST-01",
      severity: "critical",
      penalty: 30,
      hardStop: true,
      title: `GST registration ${status.toLowerCase()}`,
      fingerprint: `GST-01:${GSTIN}`,
    });
    expect(finding?.evidence).toHaveLength(1);
  });

  it.each(["Active", null])("does not trigger for %s", (status) => {
    expect(ruleIds(gst({ registrationStatus: status }))).toEqual([]);
  });
});

describe("GST-03 missed returns", () => {
  const missed = (n: number) => PERIODS.slice(0, n);

  it.each([
    [2, [], null],
    [3, ["GST-03"], 8],
    [5, ["GST-03"], 8],
    [6, ["GST-03"], 15],
    [12, ["GST-02", "GST-03"], 15],
  ] as const)("%i missed → %j", (count, ids, penalty) => {
    const findings = run(gst({}, missed(count)));
    expect(findings.map((f) => f.ruleId)).toEqual(ids);
    if (penalty) expect(findings.at(-1)?.penalty).toBe(penalty);
  });

  it("flags severity by tier", () => {
    expect(run(gst({}, missed(3)))[0]?.severity).toBe("medium");
    expect(run(gst({}, missed(6)))[0]?.severity).toBe("high");
  });

  it("explains the rule and lists the periods as evidence", () => {
    const [finding] = run(gst({}, missed(4)));
    expect(finding?.detail).toBe(
      "GST-03: 4 of last 12 GSTR-3B returns not filed. Rule: 3 or more missed → −8.",
    );
    expect(finding?.evidence[0]?.excerpt).toContain(PERIODS[0]);
  });

  it("falls back to late filings only when fewer than 3 are missed", () => {
    expect(ruleIds(gst({}, [], PERIODS.slice(0, 3)))).toEqual([]);
    const [late] = run(gst({}, [], PERIODS.slice(0, 4)));
    expect(late).toMatchObject({ ruleId: "GST-03", penalty: 4, severity: "low" });
    const [missedFirst] = run(gst({}, missed(3), PERIODS.slice(5, 11)));
    expect(missedFirst?.penalty).toBe(8);
  });

  it("treats the 20th of the following month as on time, the 21st as late", () => {
    const filedOn = (day: string) =>
      gst({
        returns: ["01", "02", "03", "04"].map((month) => ({
          period: `2026-${month}`,
          form: "GSTR-3B",
          status: "Filed",
          filedDate: `2026-0${Number(month) + 1}-${day}`,
        })),
      });
    expect(ruleIds(filedOn("20"))).toEqual([]);
    expect(ruleIds(filedOn("21"))).toEqual(["GST-03"]);
  });

  it("handles the December → January due date", () => {
    const returns = [
      { period: "2025-12", form: "GSTR-3B", status: "Filed", filedDate: "2026-01-21" },
      { period: "2025-11", form: "GSTR-3B", status: "Filed", filedDate: "2025-12-21" },
      { period: "2025-10", form: "GSTR-3B", status: "Filed", filedDate: "2025-11-21" },
      { period: "2025-09", form: "GSTR-3B", status: "Filed", filedDate: "2025-10-21" },
    ];
    expect(ruleIds(gst({ returns }))).toEqual(["GST-03"]);
  });
});

describe("GST-02 last three periods", () => {
  it("triggers when the 3 most recent periods are all not filed", () => {
    const ids = ruleIds(gst({}, PERIODS.slice(-3)));
    expect(ids).toEqual(["GST-02", "GST-03"]);
  });

  it("does not trigger when only the 2 most recent are missed", () => {
    expect(ruleIds(gst({}, PERIODS.slice(-2)))).toEqual([]);
  });

  it("needs at least 3 returns to say anything about the last 3", () => {
    const returns = PERIODS.slice(-2).map((period) => ({
      period,
      form: "GSTR-3B",
      status: "Not Filed",
      filedDate: null,
    }));
    expect(ruleIds(gst({ returns }))).toEqual([]);
  });

  it("looks at the most recent periods regardless of list order", () => {
    const shuffled = gst({}, PERIODS.slice(-3));
    shuffled.returns.reverse();
    expect(ruleIds(shuffled)).toEqual(["GST-02", "GST-03"]);
  });
});

describe("GST returns window and forms", () => {
  it("ignores GSTR-1 rows and periods before the last 12", () => {
    const extra = [
      { period: "2024-01", form: "GSTR-3B", status: "Not Filed", filedDate: null },
      { period: "2026-09", form: "GSTR-1", status: "Not Filed", filedDate: null },
    ];
    const page = gst();
    page.returns.push(...extra);
    expect(ruleIds(page)).toEqual([]);
  });

  it("creates a coverage finding instead of rules when returns are unavailable", () => {
    const [finding, ...rest] = run(gst({ returns: [] }));
    expect(finding).toMatchObject({
      ruleId: "COVERAGE-GST-RETURNS",
      category: "COVERAGE",
      severity: "info",
      penalty: 0,
    });
    expect(rest).toEqual([]);
  });
});

describe("GST-04 registration age", () => {
  it.each([
    ["2026-01-01", true],
    ["2025-11-01", true],
    ["2025-10-24", false],
    ["2015-01-01", false],
  ])("registered %s → triggers %s", (registrationDate, triggers) => {
    expect(ruleIds(gst({ registrationDate })).includes("GST-04")).toBe(triggers);
  });

  it("ignores a missing registration date", () => {
    expect(ruleIds(gst({ registrationDate: null }))).toEqual([]);
  });
});

describe("unusable GST data", () => {
  it.each([{ status: "not_found" }, { status: "captcha_blocked" }])(
    "yields nothing for %j",
    (page) => {
      expect(run(page)).toEqual([]);
    },
  );

  it("yields nothing without a GST outcome", () => {
    expect(statutoryFindings(outcomesOf({}), NOW)).toEqual([]);
  });
});
