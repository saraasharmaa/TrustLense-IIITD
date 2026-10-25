import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

async function load(env: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://x");
  vi.stubEnv("SANDBOX_API_KEY", env.key ?? "");
  vi.stubEnv("SANDBOX_API_SECRET", env.secret ?? "");
  vi.resetModules();
  return import("./client");
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("fetchCompanyMasterData", () => {
  it("authenticates once, sends the token without Bearer, and returns the first company", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: { access_token: "tok123" } }))
      .mockResolvedValueOnce(
        json({ data: [{ cin: "L1", company_name: "ACME LTD", company_status: "Active" }] }),
      );
    const { fetchCompanyMasterData } = await load({ key: "key_live_abc", secret: "secret_live_x" });
    expect((await fetchCompanyMasterData("L1"))?.company_name).toBe("ACME LTD");

    const [authUrl, authInit] = fetchMock.mock.calls[0]!;
    expect(authUrl).toBe("https://api.sandbox.co.in/authenticate");
    expect(authInit.headers["x-api-secret"]).toBe("secret_live_x");
    const [, callInit] = fetchMock.mock.calls[1]!;
    expect(callInit.headers.Authorization).toBe("tok123");
    expect(JSON.parse(callInit.body)).toEqual({ cin: "L1" });
  });

  it("accepts the single-object shape the live API returns", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: { access_token: "t" } }))
      .mockResolvedValueOnce(
        json({ data: { cin: "L1", company_name: "ACME LTD", company_status: "Active" } }),
      );
    const { fetchCompanyMasterData } = await load({ key: "key_live_abc", secret: "s" });
    expect((await fetchCompanyMasterData("L1"))?.company_name).toBe("ACME LTD");
  });

  it("returns null for a 404", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: { access_token: "t" } }))
      .mockResolvedValueOnce(json({ message: "nf" }, 404));
    const { fetchCompanyMasterData } = await load({ key: "key_live_abc", secret: "s" });
    expect(await fetchCompanyMasterData("L1")).toBeNull();
  });

  it("refuses a test key instead of returning sample data, and never calls out", async () => {
    const { fetchCompanyMasterData } = await load({ key: "key_test_abc", secret: "s" });
    await expect(fetchCompanyMasterData("L1")).rejects.toThrow(/test key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires both key and secret, and keeps them out of error messages", async () => {
    const { fetchCompanyMasterData } = await load({ key: "key_live_abc" });
    await expect(fetchCompanyMasterData("L1")).rejects.toThrow(/required/);
    fetchMock.mockResolvedValueOnce(json({ message: "bad creds" }, 401));
    const second = await load({ key: "key_live_abc", secret: "secret_live_zzz" });
    const err = await second.fetchCompanyMasterData("L1").catch((e: Error) => e);
    expect((err as Error).message).not.toContain("secret_live_zzz");
    expect((err as Error).message).not.toContain("key_live_abc");
  });
});
