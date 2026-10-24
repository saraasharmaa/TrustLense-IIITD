import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export type LlmProvider = "anthropic" | "openai" | "gemini";

// Gemini is called through its OpenAI-compatible endpoint, so it reuses the OpenAI SDK
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

// LLM_PROVIDER wins; otherwise the first provider with a key: Anthropic, OpenAI, Gemini
export function llmProvider(): LlmProvider | null {
  const { LLM_PROVIDER, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY } = env();
  const keys: Record<LlmProvider, string | undefined> = {
    anthropic: ANTHROPIC_API_KEY,
    openai: OPENAI_API_KEY,
    gemini: GEMINI_API_KEY,
  };
  if (LLM_PROVIDER) return keys[LLM_PROVIDER] ? LLM_PROVIDER : null;
  return (["anthropic", "openai", "gemini"] as const).find((p) => keys[p]) ?? null;
}

interface Prompt {
  system?: string;
  user: string;
  maxTokens: number;
  signal?: AbortSignal;
}

async function askAnthropic(prompt: Prompt): Promise<string> {
  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = env();
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const reply = await client.messages.create(
    {
      model: ANTHROPIC_MODEL,
      max_tokens: prompt.maxTokens,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    },
    { signal: prompt.signal },
  );
  return reply.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

async function askOpenAiCompatible(
  prompt: Prompt,
  config: { apiKey: string | undefined; model: string; baseURL?: string },
): Promise<string> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const reply = await client.chat.completions.create(
    {
      model: config.model,
      max_completion_tokens: prompt.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        ...(prompt.system ? [{ role: "system" as const, content: prompt.system }] : []),
        { role: "user" as const, content: prompt.user },
      ],
    },
    { signal: prompt.signal },
  );
  return reply.choices[0]?.message.content ?? "";
}

// Models sometimes wrap JSON in a code fence, so take the outermost object
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start)
    throw new AppError("internal", "LLM reply contained no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

export async function completeJson(prompt: Prompt): Promise<unknown> {
  const provider = llmProvider();
  if (!provider) throw new AppError("upstream_unavailable", "No LLM API key is configured");
  const { OPENAI_API_KEY, OPENAI_MODEL, GEMINI_API_KEY, GEMINI_MODEL } = env();
  const text =
    provider === "anthropic"
      ? await askAnthropic(prompt)
      : provider === "gemini"
        ? await askOpenAiCompatible(prompt, {
            apiKey: GEMINI_API_KEY,
            model: GEMINI_MODEL,
            baseURL: GEMINI_BASE_URL,
          })
        : await askOpenAiCompatible(prompt, { apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });
  return extractJson(text);
}
