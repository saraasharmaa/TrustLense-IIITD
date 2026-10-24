export type ErrorCode =
  | "invalid_input"
  | "invalid_identifier"
  | "not_found"
  | "rate_limited"
  | "conflict"
  | "upstream_unavailable"
  | "internal";

const HTTP_STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  invalid_identifier: 400,
  not_found: 404,
  rate_limited: 429,
  conflict: 409,
  upstream_unavailable: 502,
  internal: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

// Shape from docs/05-api-spec.md; unknown errors never leak their message or stack
export function errorResponse(err: unknown): Response {
  const known = err instanceof AppError ? err : new AppError("internal", "Unexpected error");
  const body = { error: { code: known.code, message: known.message, details: known.details } };
  return Response.json(body, { status: known.status });
}
