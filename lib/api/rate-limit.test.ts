import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, enforceRateLimit, resetRateLimits } from "./rate-limit";

beforeEach(() => {
  resetRateLimits();
});

describe("enforceRateLimit", () => {
  it("allows 10 requests per minute per key and rejects the 11th", () => {
    for (let i = 0; i < 10; i++) enforceRateLimit("a", 1000);
    expect(() => enforceRateLimit("a", 1000)).toThrowError(/Too many/);
  });

  it("counts keys separately", () => {
    for (let i = 0; i < 10; i++) enforceRateLimit("a", 1000);
    expect(() => enforceRateLimit("b", 1000)).not.toThrow();
  });

  it("frees the budget once requests are older than a minute", () => {
    for (let i = 0; i < 10; i++) enforceRateLimit("a", 1000);
    expect(() => enforceRateLimit("a", 1000 + 60_001)).not.toThrow();
  });

  it("reports rate_limited so routes answer 429", () => {
    for (let i = 0; i < 10; i++) enforceRateLimit("a");
    try {
      enforceRateLimit("a");
    } catch (err) {
      expect(err).toMatchObject({ code: "rate_limited", status: 429 });
    }
  });
});

describe("clientIp", () => {
  it("uses the first forwarded address", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
});
