import { requireCaseId } from "@/lib/api/params";
import { handle } from "@/lib/api/route";
import { listEventsAfter, subscribe, type CaseEvent } from "@/lib/orchestrator/events";
import { loadCase } from "@/lib/orchestrator/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;
const TERMINAL: CaseEvent["type"][] = ["report.ready", "case.failed"];

function format(event: CaseEvent): string {
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = await requireCaseId(ctx.params);
  await loadCase(id);
  const lastSeq = Number(req.headers.get("last-event-id")) || 0;
  const encoder = new TextEncoder();

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = lastSeq;
      let closed = false;
      const buffered: CaseEvent[] = [];
      let replaying = true;

      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        controller.close();
      };
      const send = (event: CaseEvent) => {
        if (closed || event.seq <= sent) return;
        sent = event.seq;
        controller.enqueue(encoder.encode(format(event)));
        if (TERMINAL.includes(event.type)) close();
      };

      // Subscribe before reading history so no event falls between the two
      const unsubscribe = subscribe(id, (event) =>
        replaying ? buffered.push(event) : send(event),
      );
      const heartbeat = setInterval(
        () => controller.enqueue(encoder.encode(": ping\n\n")),
        HEARTBEAT_MS,
      );
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
      req.signal.addEventListener("abort", close);

      for (const event of await listEventsAfter(id, lastSeq)) send(event);
      replaying = false;
      buffered.forEach(send);
    },
    cancel: () => cleanup(),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
