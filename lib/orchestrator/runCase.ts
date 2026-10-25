import pLimit from "p-limit";
import { withCache } from "@/lib/adapters/cache";
import { McaOutput } from "@/lib/adapters/schemas";
import { ADAPTER_ORDER, getAdapter, hasRequiredInputs } from "@/lib/adapters/registry";
import type { ReplayOptions } from "@/lib/adapters/replay";
import type { SourceAdapter, SourceOutcomes } from "@/lib/adapters/types";
import { env } from "@/lib/env";
import { evaluate, score } from "@/lib/scoring";
import { buildNarrative } from "@/lib/llm/narrative";
import type { AdapterId, SourceStatus } from "@/lib/types";
import { emitEvent } from "./events";
import { runAdapter, type AttemptedResult } from "./retry";

import {
  clearForRerun,
  createSourceRun,
  finishCase,
  loadCase,
  loadKeptOutcomes,
  markCaseRunning,
  saveDirectors,
  saveFindings,
  toAdapterInput,
  updateSourceRun,
} from "./store";

export interface RunCaseOptions {
  replay?: ReplayOptions;
  backoffMs?: number;
  // Skip the source cache for this run (the ?fresh option on the API)
  fresh?: boolean;
  // Rerun only these sources and keep the other stored runs
  only?: AdapterId[];
  // With `only`: take the other sources from this earlier case (monitoring) instead of this case
  carryForwardFrom?: string;
}

// Progress and per-attempt events are best effort; the final events are awaited in order
function fireEvent(...args: Parameters<typeof emitEvent>): void {
  emitEvent(...args).catch((err: unknown) => {
    console.error(JSON.stringify({ caseId: args[0], event: args[1], error: String(err) }));
  });
}

const PROGRESS_INTERVAL_MS = 500;
const MAX_STEPS = 50;
const DATA_STATUSES: SourceStatus[] = ["succeeded", "not_found", "carried_forward"];

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

function directorsOf(normalized: unknown): { din?: string; name: string }[] {
  const parsed = McaOutput.safeParse(normalized);
  if (!parsed.success || parsed.data.status !== "ok") return [];
  return parsed.data.directors.map((d) => ({ din: d.din ?? undefined, name: d.name }));
}

// A rerun keeps this case's other stored runs; monitoring carries clean results over from the
// previous case and labels them so coverage and the UI show they were not re-checked
async function keptOutcomes(
  caseId: string,
  rerunning: AdapterId[],
  carryFrom?: string,
): Promise<SourceOutcomes> {
  if (!carryFrom || carryFrom === caseId) {
    await clearForRerun(caseId, rerunning);
    return loadKeptOutcomes(caseId);
  }
  const carried: SourceOutcomes = {};
  for (const [id, outcome] of Object.entries(await loadKeptOutcomes(carryFrom))) {
    const clean = outcome.status === "succeeded" || outcome.status === "not_found";
    if (clean && !rerunning.includes(id as AdapterId)) {
      carried[id as AdapterId] = { ...outcome, status: "carried_forward" };
    }
  }
  return carried;
}

async function execute(caseId: string, options: RunCaseOptions): Promise<void> {
  const { case: caseRow, subject } = await loadCase(caseId);
  const config = env();
  const input = toAdapterInput(subject);
  const requested = ADAPTER_ORDER.filter((id) => caseRow.requestedSources.includes(id));
  const toRun = options.only ? requested.filter((id) => options.only?.includes(id)) : requested;

  const outcomes: SourceOutcomes = {};
  const statuses: SourceStatus[] = [];
  if (options.only) {
    Object.assign(outcomes, await keptOutcomes(caseId, toRun, options.carryForwardFrom));
    statuses.push(...Object.values(outcomes).map((o) => o.status));
  }

  await markCaseRunning(caseId);
  await emitEvent(caseId, "case.started", { caseId, adapters: toRun, mode: caseRow.mode });

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

  const limit = pLimit(config.MAX_PARALLEL_ADAPTERS);

  async function rememberDirectors(normalized: unknown) {
    const directors = directorsOf(normalized);
    if (directors.length) await saveDirectors(subject.id, directors);
  }

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
      evidenceUrl: result.evidenceUrl,
      steps,
      rawOutput: result.rawOutput,
      normalized: result.normalized,
      error: result.error,
    });

    if (id === "mca" && result.status === "succeeded") await rememberDirectors(result.normalized);
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

  async function skipSource(id: AdapterId, adapter: SourceAdapter<unknown>) {
    // Say which identifier is missing so the analyst knows what to add
    const needs = adapter.requires.map((keys) => keys.join(" + ")).join(" or ");
    const reason = `missing_identifier: needs ${needs}`;
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

  try {
    await Promise.all(
      toRun.map((id) => {
        const adapter = withCacheIfAllowed(getAdapter(id, caseRow.mode, options.replay));
        return limit(() =>
          hasRequiredInputs(adapter, input) ? runSource(id, adapter) : skipSource(id, adapter),
        );
      }),
    );
  } finally {
    clearTimeout(capTimer);
  }

  await finalizeCase(caseId, requested, outcomes, statuses);
}

// Scores whatever outcomes exist and publishes the report; shared by full runs and manual entry
export async function finalizeCase(
  caseId: string,
  requested: AdapterId[],
  outcomes: SourceOutcomes,
  statuses: SourceStatus[],
): Promise<void> {
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
  // Events are written in order, so only the last one needs awaiting; the rest ride in the same batch
  for (const finding of findings) fireEvent(caseId, "finding.created", finding);

  const result = score(findings, outcomes);
  fireEvent(caseId, "score.computed", result);

  const narrative = await buildNarrative(findings, result);
  fireEvent(caseId, "narrative.ready", narrative);

  await finishCase(caseId, { status, score: result, narrative });
  await emitEvent(caseId, "report.ready", { caseId, status });
}
