import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

// Survives Next dev hot reloads so we don't open a new pool on every edit
const globalForDb = globalThis as unknown as { trustlensDb?: Db };

export function db(): Db {
  globalForDb.trustlensDb ??= drizzle(postgres(env().DATABASE_URL, { max: 10 }), { schema });
  return globalForDb.trustlensDb;
}
