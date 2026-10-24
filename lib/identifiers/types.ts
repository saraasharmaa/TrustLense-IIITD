import { AppError } from "@/lib/errors";

export type IdentifierCheck = "format" | "state" | "checksum";

export type IdentifierFailure = { ok: false; check: IdentifierCheck; message: string };
export type IdentifierResult<T> = { ok: true; value: T } | IdentifierFailure;

export function fail(check: IdentifierCheck, message: string): IdentifierFailure {
  return { ok: false, check, message };
}

// Routes and the orchestrator want the AppError shape from docs/05; the UI wants the plain result.
export function orThrow<T>(result: IdentifierResult<T>): T {
  if (result.ok) return result.value;
  throw new AppError("invalid_identifier", result.message, { check: result.check });
}
