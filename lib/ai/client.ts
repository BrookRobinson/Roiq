import Anthropic from "@anthropic-ai/sdk";

// Model used for photo analysis. Per RoiQ spec Part 2.1 / Part 17 — Sonnet is the
// deliberate cost choice for the vision pipeline (Batch + prompt caching layered on top).
export const ANALYSIS_MODEL = "claude-sonnet-4-6";

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
  if (!client) client = new Anthropic();
  return client;
}

export function isAnalysisConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
