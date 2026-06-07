import OpenAI from "openai";

// Image generation/editing for the Renovation Visualiser. Separate from the
// Anthropic client — needs its own OPENAI_API_KEY.
//
// gpt-image-1 supports true image-to-image EDITING (the room photo becomes the
// actual base), which is what the visualiser wants. Note: an OpenAI org may need
// identity verification to access gpt-image-1; if a render errors we surface a
// placeholder rather than failing the request.

export const IMAGE_MODEL = "gpt-image-1";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — renovation render generation is unavailable. Add it to .env.local.");
  }
  if (!client) client = new OpenAI();
  return client;
}

export function isImageGenConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
