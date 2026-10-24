import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sourceCache } from "@/lib/db/schema";
import type { AdapterInput, AdapterResult, SourceAdapter } from "./types";

type CacheablePart = Pick<
  AdapterResult<unknown>,
  "status" | "normalized" | "rawOutput" | "evidenceUrl"
>;

const CACHEABLE: AdapterResult<unknown>["status"][] = ["succeeded", "not_found"];

export function cacheKey(adapterId: string, input: AdapterInput): string {
  const subject = input.gstin ?? input.cin ?? input.udyamNumber ?? input.legalName ?? "";
  return `${adapterId}:${subject.toLowerCase()}`;
}

async function read(key: string): Promise<{ part: CacheablePart; fetchedAt: Date } | undefined> {
  const [row] = await db().select().from(sourceCache).where(eq(sourceCache.key, key));
  if (!row) return undefined;
  const ageSeconds = (Date.now() - row.fetchedAt.getTime()) / 1000;
  if (ageSeconds > row.ttlSeconds) return undefined;
  return { part: row.payload as CacheablePart, fetchedAt: row.fetchedAt };
}

async function write(key: string, part: CacheablePart, ttlSeconds: number): Promise<void> {
  const values = { key, payload: part, fetchedAt: new Date(), ttlSeconds };
  await db()
    .insert(sourceCache)
    .values(values)
    .onConflictDoUpdate({ target: sourceCache.key, set: values });
}

// Only clean results are cached: a failure or CAPTCHA should be retried, not remembered
export function withCache<T>(adapter: SourceAdapter<T>, ttlSeconds: number): SourceAdapter<T> {
  return {
    ...adapter,
    async run(input, ctx) {
      const key = cacheKey(adapter.id, input);
      const hit = await read(key);
      if (hit) {
        ctx.emitProgress(`Using result cached at ${hit.fetchedAt.toISOString()}`);
        return {
          ...hit.part,
          retrievedAt: hit.fetchedAt.toISOString(),
          isReplay: false,
        } as AdapterResult<T>;
      }
      const result = await adapter.run(input, ctx);
      if (CACHEABLE.includes(result.status)) {
        const { status, normalized, rawOutput, evidenceUrl } = result;
        await write(key, { status, normalized, rawOutput, evidenceUrl }, ttlSeconds);
      }
      return result;
    },
  };
}
