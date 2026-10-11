// POST /api/analyze, read the way the route now answers.
//
// A full analysis is sent as a heartbeat stream (lib/http/heartbeat.ts): always
// HTTP 200, with the real status in the body as `_status`. This puts it back,
// so a caller still writes `if (!res.ok)` and `res.status === 402`.

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function analyzeFetch(payload: unknown): Promise<Response> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) return res;

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    // The connection was cut before the report finished arriving. Say that,
    // rather than letting a JSON parse error surface as "network error".
    return new Response(
      JSON.stringify({
        error: "incomplete_response",
        message: "The report didn't finish arriving, so nothing was saved. Please try again.",
      }),
      { status: 502, headers: JSON_HEADERS }
    );
  }
  const status = typeof data._status === "number" ? data._status : 200;
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
