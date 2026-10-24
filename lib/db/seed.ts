import { db } from "@/lib/db/client";
import { subjects } from "@/lib/db/schema";
import { listDemoCompanies } from "@/lib/demo/fixtures";

async function seed() {
  const rows = listDemoCompanies().map(({ subject }) => subject);
  await db().insert(subjects).values(rows).onConflictDoNothing();
  console.log(`seeded ${rows.length} synthetic demo subjects`);
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
