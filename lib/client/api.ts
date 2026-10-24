import type { z } from "zod";

// Every API response is parsed, so a changed server shape fails loudly instead of rendering garbage
export async function getJson<S extends z.ZodType>(url: string, schema: S): Promise<z.output<S>> {
  const res = await fetch(url, { cache: "no-store" });
  return readResponse(res, schema);
}

export async function postJson<S extends z.ZodType>(
  url: string,
  body: unknown,
  schema: S,
): Promise<z.output<S>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readResponse(res, schema);
}

async function readResponse<S extends z.ZodType>(res: Response, schema: S): Promise<z.output<S>> {
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (json as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return schema.parse(json);
}
