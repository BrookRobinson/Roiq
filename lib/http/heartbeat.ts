// ============================================================
// A JSON response that stays alive while slow work finishes.
//
// A report takes three to five minutes and the answer used to arrive as one
// JSON body at the end, with nothing sent before it. Anything sitting between
// the browser and the server gives up on a silent connection long before that:
// Cloudflare cut the first reports run through a tunnel at about two minutes
// (11 October 2026), and the page said "Network error — check your connection",
// which blamed the reader's internet for our own silence. Hosting platforms and
// mobile carriers have the same habit.
//
// So the response opens straight away and sends a space every few seconds, then
// the JSON. Leading whitespace is valid JSON, so the body still parses as one
// document.
//
// The catch: the HTTP status is sent with the first byte, before the work has
// succeeded or failed, so it is always 200. The real status travels IN the body
// as `_status`, and `analyzeFetch()` (lib/analyze-fetch.ts) turns it back into
// an ordinary Response so callers keep reading `res.ok` and `res.status`.
// Anything that can be refused quickly (bad input, no credits, a farm) should
// still be returned as a normal response BEFORE calling this.
// ============================================================

export interface HeartbeatResult {
  status: number;
  body: Record<string, unknown>;
}

const BEAT_MS = 10_000;

export function heartbeatJson(
  work: () => Promise<HeartbeatResult>,
  onError: (err: unknown) => HeartbeatResult
): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          /* the reader went away; the work still finishes */
        }
      };
      send(" ");
      const beat = setInterval(() => send(" "), BEAT_MS);
      let out: HeartbeatResult;
      try {
        out = await work();
      } catch (err) {
        out = onError(err);
      }
      clearInterval(beat);
      send(JSON.stringify({ ...out.body, _status: out.status }));
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // no-transform stops compression from holding the heartbeat back until
      // there is enough to compress, which would defeat the point of it.
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
