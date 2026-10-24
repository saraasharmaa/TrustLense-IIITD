// Pre-demo smoke test: database, every fixture company in replay mode against its expected result,
// and the simulated-change alert. Prints a pass/fail table and exits non-zero on any failure.
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { ADAPTER_ORDER } from "@/lib/adapters/registry";
import { db } from "@/lib/db/client";
import { alerts, cases, watches } from "@/lib/db/schema";
import { listDemoCompanies } from "@/lib/demo/fixtures";
import { runWatch } from "@/lib/monitor/monitor";
import { createCase } from "@/lib/orchestrator/createCase";
import { runCase } from "@/lib/orchestrator/runCase";

interface Row {
  check: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const rows: Row[] = [];
const record = (check: string, expected: string, actual: string) =>
  rows.push({ check, expected, actual, pass: expected === actual });

const FAST = { replay: { delayMs: [0, 0] as [number, number] }, backoffMs: 1 };

async function checkDatabase() {
  try {
    await db().execute(sql`select 1`);
    record("database", "reachable", "reachable");
  } catch (err) {
    record("database", "reachable", `unreachable (${String(err).slice(0, 60)})`);
    throw err;
  }
}

async function runFixtureCase(gstin: string) {
  const { caseId } = await createCase({
    gstin,
    sources: ADAPTER_ORDER,
    mode: "demo",
    fresh: false,
  });
  await runCase(caseId, FAST);
  const [row] = await db().select().from(cases).where(eq(cases.id, caseId));
  return row;
}

async function checkFixtures() {
  for (const company of listDemoCompanies()) {
    const row = await runFixtureCase(company.subject.gstin);
    const want = `${company.expected.score}/${company.expected.grade}`;
    const got = row?.score == null ? `no score (${row?.status})` : `${row.score}/${row.grade}`;
    record(`${company.key} replay case`, want, got);
  }
}

async function checkSimulatedAlert() {
  const sunrise = listDemoCompanies().find((c) => c.key === "sunrise");
  if (!sunrise) return record("simulated alert", "critical", "no sunrise fixture");
  const base = await runFixtureCase(sunrise.subject.gstin);
  if (!base) return record("simulated alert", "critical", "no baseline case");
  const [watch] = await db()
    .insert(watches)
    .values({
      subjectId: base.subjectId,
      frequencyHours: 24,
      baselineCaseId: base.id,
      active: false,
    })
    .returning({ id: watches.id });
  try {
    const outcome = await runWatch(watch!.id, { simulate: true });
    const [alert] = outcome.alertId
      ? await db().select().from(alerts).where(eq(alerts.id, outcome.alertId))
      : [];
    const moved = alert ? `${alert.change.gradeBefore}->${alert.change.gradeAfter}` : "no alert";
    record(
      "sunrise simulated change",
      "critical C->D",
      alert ? `${alert.severity} ${moved}` : moved,
    );
  } catch (err) {
    record("sunrise simulated change", "critical C->D", String(err).slice(0, 80));
  }
}

async function main() {
  try {
    await checkDatabase();
    await checkFixtures();
    await checkSimulatedAlert();
  } catch {
    // the failing check is already in the table
  }
  console.table(
    rows.map((r) => ({
      check: r.check,
      expected: r.expected,
      actual: r.actual,
      result: r.pass ? "PASS" : "FAIL",
    })),
  );
  const failed = rows.filter((r) => !r.pass).length;
  console.log(failed === 0 ? "All checks passed" : `${failed} check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
