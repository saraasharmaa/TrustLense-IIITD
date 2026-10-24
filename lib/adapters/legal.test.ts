import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { legalAdapter } from "./legal";
import type { AdapterContext } from "./types";

const { runAgent } = vi.hoisted(() => ({ runAgent: vi.fn() }));
vi.mock("@/lib/tinyfish/client", () => ({ runAgent }));

const ctx = (): AdapterContext => ({
  caseId: "c",
  sourceRunId: "s",
  signal: new AbortController().signal,
  emitProgress: vi.fn(),
  mode: "live",
  now: new Date(),
});

const input = {
  legalName: "Sunrise Textiles Pvt Ltd",
  stateCode: "33",
  directors: [{ name: "Anil Kumar" }],
};

const courtCase = (summary: string, partyName: string | null = null) => ({
  forum: "eCourts",
  caseNumber: "CC/1",
  caseType: "Cheque dishonour - Sec 138 NI Act",
  filingDate: null,
  role: "Respondent",
  status: "Pending",
  summary,
  url: "https://ecourts.example/1",
  partyName,
});

const ok = (patch: object) => ({
  status: "ok",
  searchedNames: ["Sunrise Textiles Pvt Ltd"],
  cases: [],
  insolvencyNotices: [],
  ...patch,
});

// The adapter runs two agents; answer by start page
function answer(court: unknown, notices: unknown) {
  runAgent.mockImplementation(async ({ url }: { url: string }) => ({
    runId: "r",
    resultJson: url.includes("ecourts") ? court : notices,
  }));
}

beforeEach(() => {
  runAgent.mockReset();
});

describe("legalAdapter", () => {
  it("merges court cases and insolvency notices and scores each item's match confidence", async () => {
    answer(
      ok({ cases: [courtCase("Madras High Court, Tamil Nadu"), courtCase("Surat, Gujarat")] }),
      ok({
        insolvencyNotices: [
          {
            source: "IBBI",
            noticeType: "CIRP",
            date: null,
            summary: "Tamil Nadu",
            url: "https://ibbi.example/1",
          },
        ],
      }),
    );
    const result = await legalAdapter.run(input, ctx());
    expect(result.status).toBe("succeeded");
    const data = result.normalized as {
      cases: { matchConfidence: number }[];
      insolvencyNotices: { matchConfidence: number }[];
    };
    expect(data.cases.map((c) => c.matchConfidence)).toEqual([0.7, 0.4]);
    expect(data.insolvencyNotices[0]?.matchConfidence).toBe(0.7);
  });

  it("gives a different-named party low confidence even in the right state", async () => {
    answer(ok({ cases: [courtCase("Tamil Nadu", "Sunrise Traders LLP")] }), {
      status: "not_found",
    });
    const data = (await legalAdapter.run(input, ctx())).normalized as {
      cases: { matchConfidence: number }[];
    };
    expect(data.cases[0]?.matchConfidence).toBe(0.4);
  });

  it("is not_found only when both sources were searched and empty", async () => {
    answer({ status: "not_found" }, { status: "not_found" });
    expect((await legalAdapter.run(input, ctx())).status).toBe("not_found");
  });

  it("never reports a clean result when one source was blocked", async () => {
    answer({ status: "not_found" }, { status: "captcha_blocked" });
    const result = await legalAdapter.run(input, ctx());
    expect(result.status).toBe("captcha_blocked");
    expect(result.normalized).toBeUndefined();
  });

  it("fails when one source errors even though the other returned cases", async () => {
    runAgent.mockImplementation(async ({ url }: { url: string }) => {
      if (url.includes("ibbi")) throw new AppError("upstream_unavailable", "HTTP 500");
      return { runId: "r", resultJson: ok({ cases: [courtCase("Tamil Nadu")] }) };
    });
    const result = await legalAdapter.run(input, ctx());
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/HTTP 500/);
  });
});
