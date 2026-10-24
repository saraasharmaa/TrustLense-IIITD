import pLimit from "p-limit";
import { withCache } from "@/lib/adapters/cache";
import { ADAPTER_ORDER, getAdapter, hasRequiredInputs } from "@/lib/adapters/registry";
import type { ReplayOptions } from "@/lib/adapters/replay";
import type { SourceAdapter, SourceOutcomes } from "@/lib/adapters/types";
import { env } from "@/lib/env";
import { buildNarrative } from "@/lib/llm/narrative";
import type { AdapterId, SourceStatus } from "@/lib/types";
import { emitEvent } from "./events";
import { runAdapter, type AttemptedResult } from "./retry";
import { evaluate, score } from "./temp-scoring-stub";
import {
  createSourceRun,
  finishCase,
  loadCase,
  markCaseRunning,
  saveFindings,
  toAdapterInput,
  updateSourceRun,
} from "./store";

export interface RunCaseOptions {
  replay?: ReplayOptions;
  backoffMs?: number;
  // Skip the source cache for this run (the ?fresh option on the API)
  fresh?: boolean;
}

// Progress and per-attempt events are best effort; the final events are awaited in order
function fireEvent(...args: Parameters<typeof emitEvent>): void {
  emitEvent(...args).catch((err: unknown) => {
    console.error(JSON.stringify({ caseId: args[0], event: args[1], error: String(err) }));
  });
}

const PROGRESS_INTERVAL_MS = 500;
const MAX_STEPS = 50;
const DATA_STATUSES: SourceStatus[] = ["succeeded", "not_found"];

function summarize(adapter: string, result: AttemptedResult): string {
  if (result.status === "succeeded") return `${adapter}: record retrieved`;
  if (result.status === "not_found") return `${adapter}: no matching record`;
  return `${adapter}: ${result.error ?? result.status}`;
}

function caseStatus(statuses: SourceStatus[]): "completed" | "partial" | "failed" {
  if (!statuses.some((s) => DATA_STATUSES.includes(s))) return "failed";
  return statuses.every((s) => DATA_STATUSES.includes(s)) ? "completed" : "partial";
}

export async function runCase(caseId: string, options: RunCaseOptions = {}): Promise<void> {
  try {
    await execute(caseId, options);
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "Case failed";
    await finishCase(caseId, { status: "failed" });
    await emitEvent(caseId, "case.failed", { message });
  }
}

async function execute(caseId: string, options: RunCaseOptions): Promise<void> {
  const { case: caseRow, subject } = await loadCase(caseId);
  const config = env();
  const input = toAdapterInput(subject);
  const requested = ADAPTER_ORDER.filter((id) => caseRow.requestedSources.includes(id));

  await markCaseRunning(caseId);
  await emitEvent(caseId, "case.started", { caseId, adapters: requested, mode: caseRow.mode });

  const caseController = new AbortController();
  const capTimer = setTimeout(
    () => caseController.abort(new Error("Case time limit reached")),
    config.CASE_TIMEOUT_MS,
  );

  // Monitoring must see current data, and replay data is never cached
  const useCache =
    caseRow.mode === "live" &&
    caseRow.triggeredBy !== "monitor" &&
    !options.fresh &&
    config.SOURCE_CACHE_TTL_SECONDS > 0;
  const withCacheIfAllowed = (adapter: SourceAdapter<unknown>) =>
    useCache ? withCache(adapter, config.SOURCE_CACHE_TTL_SECONDS) : adapter;

  const outcomes: SourceOutcomes = {};
  const statuses: SourceStatus[] = [];
  const limit = pLimit(config.MAX_PARALLEL_ADAPTERS);

  async function runSource(id: AdapterId, adapter: SourceAdapter<unknown>) {
    const isReplay = caseRow.mode === "demo";
    const sourceRunId = await createSourceRun(caseId, id, "running");
    const steps: { t: string; text: string; url?: string }[] = [];
    let lastProgress = 0;
    const startedAt = Date.now();

    const result = await runAdapter(
      adapter,
      input,
      {
        caseId,
        sourceRunId,
        mode: caseRow.mode,
        now: new Date(),
        emitProgress: (text, url) => {
          if (Date.now() - lastProgress < PROGRESS_INTERVAL_MS || steps.length >= MAX_STEPS) return;
          lastProgress = Date.now();
          steps.push({ t: new Date().toISOString(), text, url });
          fireEvent(caseId, "source.progress", { adapter: id, text, url });
        },
      },
      {
        timeoutMs: config.ADAPTER_TIMEOUT_MS,
        backoffMs: options.backoffMs ?? 2000,
        caseSignal: caseController.signal,
        onAttempt: (attempt) => {
          fireEvent(caseId, "source.started", { adapter: id, attempt, isReplay });
        },
        onAttemptFailed: (failed, _attempt, willRetry) => {
          fireEvent(caseId, "source.failed", {
            adapter: id,
            status: failed.status,
            error: failed.error,
            willRetry,
          });
        },
      },
    );

    const durationMs = Date.now() - startedAt;
    await updateSourceRun(sourceRunId, {
      status: result.status,
      attempt: result.attempt,
      isReplay: result.isReplay,
      durationMs,
      tinyfishRunId: result.tinyfishRunId,
      steps,
      rawOutput: result.rawOutput,
      normalized: result.normalized,
      error: result.error,
    });

    statuses.push(result.status);
    outcomes[id] = {
      sourceRunId,
      status: result.status,
      normalized: result.normalized,
      evidenceUrl: result.evidenceUrl,
      retrievedAt: result.retrievedAt ?? new Date().toISOString(),
      isReplay: result.isReplay,
    };

    // failed and timeout were already announced per attempt
    if (result.status === "captcha_blocked") {
      await emitEvent(caseId, "source.failed", {
        adapter: id,
        status: result.status,
        error: result.error ?? "Blocked by CAPTCHA",
        willRetry: false,
      });
    } else if (result.status !== "failed" && result.status !== "timeout") {
      await emitEvent(caseId, "source.completed", {
        adapter: id,
        status: result.status,
        durationMs,
        summary: summarize(id, result),
      });
    }
  }

  async function skipSource(id: AdapterId) {
    const reason = "missing_identifier";
    const sourceRunId = await createSourceRun(caseId, id, "skipped", reason);
    statuses.push("skipped");
    outcomes[id] = {
      sourceRunId,
      status: "skipped",
      retrievedAt: new Date().toISOString(),
      isReplay: caseRow.mode === "demo",
    };
    await emitEvent(caseId, "source.completed", {
      adapter: id,
      status: "skipped",
      durationMs: 0,
      summary: `${id}: skipped (${reason})`,
    });
  }

  await Promise.all(
    requested.map((id) => {
      const adapter = withCacheIfAllowed(getAdapter(id, caseRow.mode, options.replay));
      return limit(() =>
        hasRequiredInputs(adapter, input) ? runSource(id, adapter) : skipSource(id),
      );
    }),
  );
  clearTimeout(capTimer);

  const status = caseStatus(statuses);
  if (status === "failed") {
    await finishCase(caseId, { status });
    await emitEvent(caseId, "case.failed", { message: "No source returned data" });
    return;
  }

  const findings = evaluate(outcomes, { now: new Date(), requested }).map((f) => ({
    ...f,
    id: crypto.randomUUID(),
  }));
  await saveFindings(caseId, findings);
  for (const finding of findings) await emitEvent(caseId, "finding.created", finding);

  const result = score(findings, outcomes);
  if (result) await emitEvent(caseId, "score.computed", result);

  const narrative = await buildNarrative(findings, result);
  await emitEvent(caseId, "narrative.ready", narrative);

  await finishCase(caseId, { status, score: result, narrative });
  await emitEvent(caseId, "report.ready", { caseId, status });
}
