import { describe, expect, it } from "vitest";
import { readSseData } from "./sse";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>) {
  const out: unknown[] = [];
  for await (const item of readSseData(body)) out.push(item);
  return out;
}

describe("readSseData", () => {
  it("parses events delivered whole", async () => {
    const body = streamOf('data: {"type":"STARTED"}\n\ndata: {"type":"COMPLETE"}\n\n');
    expect(await collect(body)).toEqual([{ type: "STARTED" }, { type: "COMPLETE" }]);
  });

  it("reassembles an event split across chunks, even mid-token", async () => {
    const body = streamOf(
      'data: {"type":"PRO',
      'GRESS","purpose":"a"}\n',
      '\ndata: {"type":"COMPLETE"}\n\n',
    );
    expect(await collect(body)).toEqual([{ type: "PROGRESS", purpose: "a" }, { type: "COMPLETE" }]);
  });

  it("ignores comments, event names and malformed data", async () => {
    const body = streamOf(': ping\n\nevent: x\ndata: not json\n\ndata: {"ok":true}\n\n');
    expect(await collect(body)).toEqual([{ ok: true }]);
  });

  it("handles CRLF separators and a final event without a trailing blank line", async () => {
    const body = streamOf('data: {"a":1}\r\n\r\ndata: {"b":2}');
    expect(await collect(body)).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
