import { notFound } from "next/navigation";
import { z } from "zod";
import { getDebugView } from "@/lib/orchestrator/debugView";

export const dynamic = "force-dynamic";

const pre = "overflow-x-auto rounded bg-slate-100 p-3 text-xs text-slate-900";

export default async function DebugCasePage({ params }: { params: Promise<{ id: string }> }) {
  // Raw adapter output can hold anything a portal returned, so this page is local development only
  if (process.env.NODE_ENV === "production") notFound();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { events, runs } = await getDebugView(id);
  const credits = runs.reduce((sum, r) => sum + Number(r.credits ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Debug: case {id}</h1>
      <p className="text-sm">
        {runs.length} source runs, {events.length} events, {credits} credits reported
      </p>

      <h2 className="text-lg font-semibold">Source runs</h2>
      {runs.map((run) => (
        <section key={run.id} className="space-y-2">
          <h3 className="font-mono text-sm">
            {run.adapter} · {run.status} · attempt {run.attempt} · {run.durationMs ?? "-"} ms
            {run.isReplay ? " · replay" : ""} · tinyfish run {run.tinyfishRunId ?? "-"}
          </h3>
          {run.error && <p className="text-sm text-red-700">Error: {run.error}</p>}
          <pre className={pre}>
            {JSON.stringify(
              { steps: run.steps, raw: run.rawOutput, normalized: run.normalized },
              null,
              2,
            )}
          </pre>
        </section>
      ))}

      <h2 className="text-lg font-semibold">Events</h2>
      <pre className={pre}>
        {events.map((e) => `${e.seq} ${e.ts} ${e.type} ${JSON.stringify(e.data)}`).join("\n")}
      </pre>
    </main>
  );
}
