import type {
  AdapterContext,
  AdapterInput,
  AdapterResult,
  SourceAdapter,
} from "@/lib/adapters/types";

export interface RunAdapterOptions {
  timeoutMs: number;
  backoffMs: number;
  // Aborted when the whole case hits its cap
  caseSignal?: AbortSignal;
  onAttempt?: (attempt: number) => void;
  onAttemptFailed?: (result: AdapterResult<unknown>, attempt: number, willRetry: boolean) => void;
}

export type AttemptedResult = AdapterResult<unknown> & { attempt: number };

const MAX_ATTEMPTS = 2;

// A CAPTCHA or an empty result won't change on retry, so only failures are retried
function isRetryable(result: AdapterResult<unknown>): boolean {
  return result.status === "failed" || result.status === "timeout";
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 300);
}

async function attemptOnce(
  adapter: SourceAdapter<unknown>,
  input: AdapterInput,
  baseCtx: Omit<AdapterContext, "signal">,
  options: RunAdapterOptions,
): Promise<AdapterResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Timed out after ${options.timeoutMs} ms`)),
    options.timeoutMs,
  );
  const abortWithCase = () => controller.abort(options.caseSignal?.reason);
  options.caseSignal?.addEventListener("abort", abortWithCase, { once: true });
  if (options.caseSignal?.aborted) abortWithCase();

  try {
    const aborted = new Promise<never>((_, reject) =>
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason), {
        once: true,
      }),
    );
    return await Promise.race([
      adapter.run(input, { ...baseCtx, signal: controller.signal }),
      aborted,
    ]);
  } catch (err) {
    const status = controller.signal.aborted ? "timeout" : "failed";
    return { status, error: errorMessage(err), isReplay: false };
  } finally {
    clearTimeout(timer);
    options.caseSignal?.removeEventListener("abort", abortWithCase);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The one wrapper every adapter runs through: timeout, one retry, never throws
export async function runAdapter(
  adapter: SourceAdapter<unknown>,
  input: AdapterInput,
  baseCtx: Omit<AdapterContext, "signal">,
  options: RunAdapterOptions,
): Promise<AttemptedResult> {
  let result: AdapterResult<unknown> = { status: "failed", isReplay: false };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    options.onAttempt?.(attempt);
    result = await attemptOnce(adapter, input, baseCtx, options);
    const willRetry = isRetryable(result) && attempt < MAX_ATTEMPTS && !options.caseSignal?.aborted;
    if (result.status === "failed" || result.status === "timeout") {
      options.onAttemptFailed?.(result, attempt, willRetry);
    }
    if (!willRetry) return { ...result, attempt };
    await wait(options.backoffMs);
  }
  return { ...result, attempt: MAX_ATTEMPTS };
}
