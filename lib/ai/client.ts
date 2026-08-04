import Anthropic from "@anthropic-ai/sdk";

// Text + web-search calls (market rent, capital growth, interest rates, listing
// recovery) stay on Sonnet 4.6 — they use the web_search_20250305 tool version and
// don't benefit from the vision gains, so no reason to change them.
export const ANALYSIS_MODEL = "claude-sonnet-4-6";

// PHOTO / VISION analysis runs on Sonnet 5. A/B tested against 4.6 on 2026-08 (see
// scripts/vision-resolution-test.mjs): sonnet-5 reads materials + fine defects more
// accurately, catches things 4.6 confidently denies (e.g. a smoke detector 4.6
// declared absent), and hallucinates less speculative filler — and it's cheaper than
// 4.6 on intro pricing through 2026-08-31. Decoupled from ANALYSIS_MODEL so the
// web-search calls (older tool version) are untouched.
export const VISION_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

/**
 * Lazily-constructed Anthropic client. Reads ANTHROPIC_API_KEY from the
 * environment. Throws a clear error if the key is missing so the failure
 * surfaces at the API route rather than as an opaque SDK error.
 */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — photo analysis is unavailable. Add it to .env.local."
    );
  }
  // maxRetries 4 (SDK default 2): long web-search calls (listing recovery, market,
  // rates) occasionally hit transient connection errors — extra backoff'd retries ride them out.
  if (!client) client = new Anthropic({ maxRetries: 4 });
  return client;
}

export function isAnalysisConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
