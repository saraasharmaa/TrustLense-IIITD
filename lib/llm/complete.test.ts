import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const anthropicCreate = vi.hoisted(() => vi.fn());
const openaiCreate = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreate };
  },
}));
const openaiOptions = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
    constructor(options: unknown) {
      openaiOptions(options);
    }
  },
}));

async function load(env: Record<string, string>) {
  vi.stubEnv("DATABASE_URL", "postgres://x");
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "LLM_PROVIDER"])
    vi.stubEnv(key, env[key] ?? "");
  vi.resetModules();
  return import("./complete");
}

beforeEach(() => {
  anthropicCreate.mockReset();
  openaiCreate.mockReset();
  openaiOptions.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("llmProvider", () => {
  it("prefers anthropic when both keys are set", async () => {
    const { llmProvider } = await load({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" });
    expect(llmProvider()).toBe("anthropic");
  });

  it("uses openai when only its key is set", async () => {
    expect((await load({ OPENAI_API_KEY: "o" })).llmProvider()).toBe("openai");
  });

  it("lets LLM_PROVIDER choose, and is null when that provider has no key", async () => {
    expect(
      (
        await load({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", LLM_PROVIDER: "openai" })
      ).llmProvider(),
    ).toBe("openai");
    expect(
      (await load({ ANTHROPIC_API_KEY: "a", LLM_PROVIDER: "openai" })).llmProvider(),
    ).toBeNull();
  });

  it("uses gemini when it is the only key, and honours LLM_PROVIDER=gemini", async () => {
    expect((await load({ GEMINI_API_KEY: "g" })).llmProvider()).toBe("gemini");
    expect(
      (
        await load({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", LLM_PROVIDER: "gemini" })
      ).llmProvider(),
    ).toBe("gemini");
  });

  it("is null with no keys", async () => {
    expect((await load({})).llmProvider()).toBeNull();
  });
});

describe("completeJson", () => {
  it("calls openai in json mode and parses a fenced reply", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '```json\n{"a":1}\n```' } }],
    });
    const { completeJson } = await load({ OPENAI_API_KEY: "o" });
    expect(await completeJson({ system: "s", user: "u", maxTokens: 50 })).toEqual({ a: 1 });
    const args = openaiCreate.mock.calls[0]![0];
    expect(args.response_format).toEqual({ type: "json_object" });
    expect(args.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it("calls gemini through the openai-compatible endpoint with its own key", async () => {
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: '{"c":3}' } }] });
    const { completeJson } = await load({ GEMINI_API_KEY: "g" });
    expect(await completeJson({ user: "u", maxTokens: 50 })).toEqual({ c: 3 });
    expect(openaiOptions).toHaveBeenCalledWith({
      apiKey: "g",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      timeout: 30000,
      maxRetries: 1,
    });
  });

  it("calls anthropic when it is the provider", async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: "text", text: '{"b":2}' }] });
    const { completeJson } = await load({ ANTHROPIC_API_KEY: "a" });
    expect(await completeJson({ user: "u", maxTokens: 50 })).toEqual({ b: 2 });
  });

  it("refuses to run without a key and rejects replies with no JSON", async () => {
    await expect((await load({})).completeJson({ user: "u", maxTokens: 5 })).rejects.toThrow(
      /No LLM API key/,
    );
    openaiCreate.mockResolvedValue({ choices: [{ message: { content: "sorry" } }] });
    const { completeJson } = await load({ OPENAI_API_KEY: "o" });
    await expect(completeJson({ user: "u", maxTokens: 5 })).rejects.toThrow(/no JSON/);
  });
});
