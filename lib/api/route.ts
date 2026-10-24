import type { z } from "zod";
import { AppError, errorResponse } from "@/lib/errors";

// Routes stay thin: validate input, call lib/*, map errors to the docs/05 shape
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (!(err instanceof AppError)) console.error(err);
      return errorResponse(err);
    }
  };
}

export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  const json: unknown = await req.json().catch(() => {
    throw new AppError("invalid_input", "Request body must be JSON");
  });
  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError("invalid_input", `${issue?.path.join(".") || "body"}: ${issue?.message}`);
  }
  return result.data;
}
