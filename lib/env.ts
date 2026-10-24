import { z } from "zod";

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const Env = z.object({
  // Optional so scripts that never touch the database (spike) can run; db() requires it
  DATABASE_URL: z.string().min(1).optional(),
  TINYFISH_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  // An empty LLM_PROVIDER= line in .env.local means "unset"
  LLM_PROVIDER: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["anthropic", "openai", "gemini"]).optional(),
  ),
  DEMO_MODE: flag,
  ALLOW_SIMULATION: flag,
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  MAX_PARALLEL_ADAPTERS: z.coerce.number().int().positive().default(6),
  ADAPTER_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  CASE_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  SOURCE_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(600),
  CRON_SECRET: z.string().optional(),
  ENABLE_INPROCESS_SCHEDULER: flag,
});

export type Env = z.infer<typeof Env>;

let cached: Env | undefined;

// Parsed on first use so `next build` and tests don't need a full .env
export function env(): Env {
  cached ??= Env.parse(process.env);
  return cached;
}
