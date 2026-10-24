import { afterEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/client", () => ({ db: () => ({ execute }) }));

async function getHealth() {
  const { GET } = await import("./route");
  return (await GET()).json();
}

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    execute.mockReset();
  });

  it("reports ok when the database answers", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("DEMO_MODE", "true");
    execute.mockResolvedValue([]);
    expect(await getHealth()).toMatchObject({ ok: true, db: true, demoMode: true });
  });

  it("reports not ok when the database is down, without throwing", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    execute.mockRejectedValue(new Error("connection refused"));
    expect(await getHealth()).toMatchObject({ ok: false, db: false });
  });

  it("only reports whether keys are configured, never their values", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x");
    vi.stubEnv("TINYFISH_API_KEY", "secret-key");
    execute.mockResolvedValue([]);
    const body = await getHealth();
    expect(body.tinyfishConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret-key");
  });
});
