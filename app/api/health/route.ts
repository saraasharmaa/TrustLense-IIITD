import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { llmProvider } from "@/lib/llm/complete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dbReachable(): Promise<boolean> {
  try {
    await db().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const { TINYFISH_API_KEY, DEMO_MODE } = env();
  const dbOk = await dbReachable();
  return Response.json({
    ok: dbOk,
    db: dbOk,
    tinyfishConfigured: Boolean(TINYFISH_API_KEY),
    llmConfigured: llmProvider() !== null,
    demoMode: DEMO_MODE,
    version: "0.1.0",
  });
}
