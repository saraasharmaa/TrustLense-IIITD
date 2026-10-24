import { describe, expect, it } from "vitest";
import { legalFindings } from "./legal";
import { outcome, outcomesOf } from "./test-utils";

let caseCounter = 0;

function legalCase(overrides: Record<string, unknown> = {}) {
  caseCounter += 1;
  return {
    forum: "eCourts",
    caseNumber: `CC/${caseCounter}/2025`,
    caseType: "Civil - Commercial",
    filingDate: null,
    role: "Respondent",
    status: "Pending",
    summary: "Commercial suit",
    url: `https://example.invalid/case/${caseCounter}`,
    ...overrides,
  };
}

function notice(overrides: Record<string, unknown> = {}) {
  return {
    source: "IBBI",
    noticeType: "CIRP admitted",
    date: null,
    summary: "Corporate insolvency resolution process admitted",
    url: "https://example.invalid/notice/1",
    ...overrides,
  };
}

function legal(cases: unknown[] = [], insolvencyNotices: unknown[] = []) {
  return { status: "ok", searchedNames: ["Sunrise Textiles"], cases, insolvencyNotices };
}

function run(page: unknown) {
  return legalFindings(outcomesOf({ legal: outcome(page) }));
}

function ruleIds(page: unknown) {
  return run(page).map((f) => f.ruleId);
}

describe("LEG-01 insolvency", () => {
  it.each(["CIRP admitted", "Insolvency petition", "Voluntary liquidation", "Winding up order"])(
    "%s is a hard stop",
    (noticeType) => {
      expect(run(legal([], [notice({ noticeType })]))[0]).toMatchObject({
        ruleId: "LEG-01",
        severity: "critical",
        penalty: 25,
        hardStop: true,
        title: "Insolvency proceedings",
        fingerprint: "LEG-01:https://example.invalid/notice/1",
      });
    },
  );

  it("ignores other notice types", () => {
    expect(ruleIds(legal([], [notice({ noticeType: "Public announcement" })]))).toEqual([]);
  });

  it("points evidence at the notice URL", () => {
    expect(run(legal([], [notice()]))[0]?.evidence[0]?.url).toBe(
      "https://example.invalid/notice/1",
    );
  });
});

describe("LEG-02 pending recovery or cheque case as respondent", () => {
  it.each([
    "Cheque dishonour - Sec 138 NI Act",
    "Civil - Recovery",
    "DRT application",
    "SARFAESI notice",
  ])("%s triggers", (caseType) => {
    const [finding] = run(legal([legalCase({ caseType })]));
    expect(finding).toMatchObject({ ruleId: "LEG-02", severity: "high", penalty: 12 });
  });

  it.each([
    ["role Petitioner", { caseType: "Civil - Recovery", role: "Petitioner" }],
    ["role Other", { caseType: "Civil - Recovery", role: "Other" }],
    ["status Disposed", { caseType: "Civil - Recovery", status: "Disposed" }],
    ["unrelated type", { caseType: "Civil - Commercial" }],
  ])("does not trigger for %s", (_label, overrides) => {
    expect(ruleIds(legal([legalCase(overrides)]))).not.toContain("LEG-02");
  });

  it("gives each case its own fingerprint", () => {
    const cases = [legalCase({ caseType: "Civil - Recovery" }), legalCase({ caseType: "DRT" })];
    const fingerprints = run(legal(cases))
      .filter((f) => f.ruleId === "LEG-02")
      .map((f) => f.fingerprint);
    expect(new Set(fingerprints).size).toBe(2);
  });
});

describe("LEG-03 multiple pending respondent cases", () => {
  it.each([
    [2, false],
    [3, true],
    [5, true],
  ])("%i respondent cases → triggers %s", (count, triggers) => {
    const cases = Array.from({ length: count }, () => legalCase());
    expect(ruleIds(legal(cases)).includes("LEG-03")).toBe(triggers);
  });

  it("does not count petitioner or disposed cases", () => {
    const cases = [
      legalCase(),
      legalCase(),
      legalCase({ role: "Petitioner" }),
      legalCase({ status: "Disposed" }),
    ];
    expect(ruleIds(legal(cases))).not.toContain("LEG-03");
  });

  it("cites the cases it counted", () => {
    const finding = run(legal([legalCase(), legalCase(), legalCase()])).find(
      (f) => f.ruleId === "LEG-03",
    );
    expect(finding?.penalty).toBe(8);
    expect(finding?.evidence).toHaveLength(3);
  });
});

describe("LEG-04 any pending case", () => {
  it("triggers for a pending case in any role", () => {
    const [finding] = run(legal([legalCase({ role: "Petitioner" })]));
    expect(finding).toMatchObject({ ruleId: "LEG-04", severity: "low", penalty: 3 });
  });

  it("does not trigger for disposed or unknown-status cases", () => {
    expect(
      ruleIds(legal([legalCase({ status: "Disposed" }), legalCase({ status: "Unknown" })])),
    ).toEqual([]);
  });
});

describe("match confidence", () => {
  it("scores a case at 0.7 and not at 0.69", () => {
    expect(ruleIds(legal([legalCase({ matchConfidence: 0.7 })]))).toEqual(["LEG-04"]);
    expect(ruleIds(legal([legalCase({ matchConfidence: 0.69 })]))).toEqual(["LEG-POSSIBLE"]);
  });

  it("turns a low-confidence case into an unpenalised info finding", () => {
    const [finding] = run(
      legal([legalCase({ caseType: "Civil - Recovery", matchConfidence: 0.4 })]),
    );
    expect(finding).toMatchObject({
      ruleId: "LEG-POSSIBLE",
      severity: "info",
      penalty: 0,
      hardStop: false,
      title: "Possible match — verify",
      confidence: 0.4,
    });
  });

  it("does not let a low-confidence insolvency notice trigger the hard stop", () => {
    const findings = run(legal([], [notice({ matchConfidence: 0.5 })]));
    expect(findings.map((f) => f.ruleId)).toEqual(["LEG-POSSIBLE"]);
    expect(findings.some((f) => f.hardStop)).toBe(false);
  });

  it("treats a missing confidence as a full match", () => {
    expect(run(legal([], [notice()]))[0]?.confidence).toBe(1);
  });
});

describe("unusable legal data", () => {
  it.each([{ status: "not_found" }, { status: "captcha_blocked" }])(
    "yields nothing for %j",
    (page) => {
      expect(run(page)).toEqual([]);
    },
  );
});
