// Runs one live adapter and prints what happened, for filling the spike table in docs/PROGRESS.md.
// Usage: npm run spike -- gst <GSTIN> [--runs 3]   |   npm run spike -- news "<legal name>" [--runs 3]
import { getAdapter } from "@/lib/adapters/registry";
import type { AdapterInput, AdapterResult } from "@/lib/adapters/types";
import { AdapterId } from "@/lib/types";

const RAW_PREVIEW_CHARS = 3000;

function usage(): never {
  console.error('Usage: npm run spike -- <gst|news> <GSTIN | "legal name"> [--runs N]');
  process.exit(2);
}

function parseArgs() {
  const [adapterArg, identifier, ...rest] = process.argv.slice(2);
  const adapter = AdapterId.safeParse(adapterArg);
  if (!adapter.success || !identifier) usage();
  const runsFlag = rest.indexOf("--runs");
  const runs = runsFlag >= 0 ? Number(rest[runsFlag + 1]) || 1 : 1;
  return { adapter: adapter.data, identifier, runs };
}

function toInput(adapter: AdapterId, identifier: string): AdapterInput {
  return adapter === "news" ? { legalName: identifier } : { gstin: identifier.toUpperCase() };
}

async function runOnce(adapter: AdapterId, input: AdapterInput) {
  const started = Date.now();
  const stamp = () => `+${((Date.now() - started) / 1000).toFixed(1)}s`;
  let result: AdapterResult<unknown>;
  try {
    result = await getAdapter(adapter, "live").run(input, {
      caseId: "spike",
      sourceRunId: "spike",
      signal: AbortSignal.timeout(180_000),
      emitProgress: (text, url) => console.log(`  ${stamp()} ${text}${url ? ` (${url})` : ""}`),
      mode: "live",
      now: new Date(),
    });
  } catch (err) {
    result = {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      isReplay: false,
    };
  }
  return { result, seconds: (Date.now() - started) / 1000 };
}

async function main() {
  const { adapter, identifier, runs } = parseArgs();
  const input = toInput(adapter, identifier);
  const outcomes: { status: string; seconds: number }[] = [];

  for (let i = 1; i <= runs; i++) {
    console.log(`\n== run ${i}/${runs}: ${adapter} ==`);
    const { result, seconds } = await runOnce(adapter, input);
    console.log(
      `status: ${result.status}  duration: ${seconds.toFixed(1)}s  tinyfish run: ${result.tinyfishRunId ?? "-"}`,
    );
    if (result.error) console.log(`error: ${result.error}`);
    console.log(
      `schema valid: ${result.normalized !== undefined ? "yes" : "no (no normalized output)"}`,
    );
    console.log(
      "raw output:",
      JSON.stringify(result.rawOutput, null, 2)?.slice(0, RAW_PREVIEW_CHARS) ?? "none",
    );
    outcomes.push({ status: result.status, seconds });
  }

  const good = outcomes.filter((o) => o.status === "succeeded" || o.status === "not_found").length;
  const sorted = outcomes.map((o) => o.seconds).sort((a, b) => a - b);
  console.log(
    `\nsummary: ${good}/${runs} reached data, median ${sorted[Math.floor(sorted.length / 2)]?.toFixed(1)}s`,
  );
  console.log(`statuses: ${outcomes.map((o) => o.status).join(", ")}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
