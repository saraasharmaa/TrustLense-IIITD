import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export type LlmProvider = "anthropic" | "openai";

// LLM_PROVIDER wins; otherwise whichever key is set, Anthropic first
export function llmProvider(): LlmProvider | null {
  const { LLM_PROVIDER, ANTHROPIC_API_KEY, OPENAI_API_KEY } = env();
  if (LLM_PROVIDER === "openai") return OPENAI_API_KEY ? "openai" : null;
  if (LLM_PROVIDER === "anthropic") return ANTHROPIC_API_KEY ? "anthropic" : null;
  if (ANTHROPIC_API_KEY) return "anthropic";
  return OPENAI_API_KEY ? "openai" : null;
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

async function askOpenAi(prompt: Prompt): Promise<string> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = env();
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const reply = await client.chat.completions.create(
    {
      model: OPENAI_MODEL,
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
  const text = provider === "openai" ? await askOpenAi(prompt) : await askAnthropic(prompt);
  return extractJson(text);
}
