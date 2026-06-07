import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { toFile } from "openai";

import { getAnthropic, ANALYSIS_MODEL, isAnalysisConfigured } from "@/lib/ai/client";
import { getOpenAI, IMAGE_MODEL, isImageGenConfigured } from "@/lib/ai/openai";
import {
  TIER_ORDER, TIER_META, TIER_SCOPE, STYLE_CUE, RENO_STYLES, DEFAULT_SQM,
  type RoomType, type RenoStyle, type RenoTier,
} from "@/lib/reno-visualiser";

export const runtime = "nodejs";
export const maxDuration = 120; // Claude vision + 3 DALL-E renders

interface RawRoomPlan {
  suggested_style: string;
  style_reason: string;
  estimated_sqm: number;
  room_description: string;
}

const PLAN_TOOL_NAME = "submit_room_plan";
const PLAN_TOOL: Anthropic.Tool = {
  name: PLAN_TOOL_NAME,
  description: "Submit the renovation plan for the room shown in the photo.",
  input_schema: {
    type: "object",
    properties: {
      suggested_style: { type: "string", enum: RENO_STYLES as unknown as string[], description: "The renovation style that best suits this home." },
      style_reason: { type: "string", description: "One short sentence, e.g. 'matches this 1970s West Coast home'." },
      estimated_sqm: { type: "number", description: "Estimated floor area of the room in square metres." },
      room_description: { type: "string", description: "Concise description of the room's layout, window position, and key fixtures, for an image-generation prompt." },
    },
    required: ["suggested_style", "style_reason", "estimated_sqm", "room_description"],
  },
};

function planPrompt(roomType: RoomType, region?: string, buildYear?: number): string {
  return `This is a ${roomType} in a New Zealand home${buildYear ? ` built around ${buildYear}` : ""}${region ? ` in ${region}` : ""}.
Suggest the renovation style that best suits this property (choose from: ${RENO_STYLES.join(", ")}), estimate the room's floor area in m², and describe the room's layout for a redesign render. Call ${PLAN_TOOL_NAME}.`;
}

function imageBlock(photoUrl?: string, photoBase64?: string): Anthropic.ContentBlockParam | null {
  if (photoUrl) return { type: "image", source: { type: "url", url: photoUrl } };
  if (photoBase64) {
    const m = photoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
    const media = (m?.[1] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    const data = m?.[2] ?? photoBase64;
    return { type: "image", source: { type: "base64", media_type: media, data } };
  }
  return null;
}

async function makePlan(roomType: RoomType, photoUrl?: string, photoBase64?: string, region?: string, buildYear?: number): Promise<RawRoomPlan | null> {
  if (!isAnalysisConfigured()) return null;
  const img = imageBlock(photoUrl, photoBase64);
  if (!img) return null; // no photo → can't analyse the room
  try {
    const resp = await getAnthropic().messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 800,
      tools: [PLAN_TOOL],
      tool_choice: { type: "tool", name: PLAN_TOOL_NAME },
      messages: [{ role: "user", content: [img, { type: "text", text: planPrompt(roomType, region, buildYear) }] }],
    });
    const tu = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === PLAN_TOOL_NAME);
    return tu ? (tu.input as RawRoomPlan) : null;
  } catch (e) {
    console.warn("[visualise] plan failed:", (e as Error)?.message);
    return null;
  }
}

// Prompt for generating from scratch (no base photo).
function renderPrompt(room: RoomType, style: RenoStyle, tier: RenoTier, roomDescription: string): string {
  const scope = TIER_SCOPE[room][tier].join(", ");
  return `Photorealistic real-estate interior render of a renovated ${room} in ${style} style (${STYLE_CUE[style]}), at a ${TIER_META[tier].label} budget level. The renovation includes: ${scope}. Keep the general layout of this existing room: ${roomDescription}. Bright natural daylight, wide-angle, magazine quality. No text, no people, no watermark.`;
}

// Prompt for editing the buyer's actual room photo (gpt-image-1 image-to-image).
function editPrompt(room: RoomType, style: RenoStyle, tier: RenoTier): string {
  const scope = TIER_SCOPE[room][tier].join(", ");
  return `Renovate this ${room} in ${style} style (${STYLE_CUE[style]}) at a ${TIER_META[tier].label} budget. Apply: ${scope}. Keep the room's existing layout, window and door positions, and viewpoint — change the finishes, fixtures, tiling, cabinetry, and styling only. Photorealistic, real-estate quality, bright natural daylight. No text or watermark.`;
}

// Load the room photo as a buffer for image-to-image editing.
async function loadImageBuffer(photoUrl?: string, photoBase64?: string): Promise<{ buf: Buffer; type: string } | null> {
  if (photoBase64) {
    const m = photoBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
    const type = m?.[1] ?? "image/png";
    const data = m?.[2] ?? photoBase64;
    try { return { buf: Buffer.from(data, "base64"), type }; } catch { return null; }
  }
  if (photoUrl) {
    try {
      const r = await fetch(photoUrl);
      if (!r.ok) return null;
      const type = r.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      return { buf: Buffer.from(await r.arrayBuffer()), type };
    } catch { return null; }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: {
    roomType?: RoomType; style?: RenoStyle; photoUrl?: string; photoBase64?: string;
    region?: string; buildYear?: number; sqm?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const roomType = body.roomType === "kitchen" ? "kitchen" : "bathroom";

  // 1. Claude describes the room + suggests a style + estimates size (if a photo + Anthropic key).
  const plan = await makePlan(roomType, body.photoUrl, body.photoBase64, body.region, body.buildYear);

  const style: RenoStyle = body.style && (RENO_STYLES as string[]).includes(body.style)
    ? body.style
    : (plan && (RENO_STYLES as string[]).includes(plan.suggested_style) ? (plan.suggested_style as RenoStyle) : "Modern");
  const estimatedSqm = body.sqm && body.sqm > 0 ? body.sqm : plan?.estimated_sqm ?? DEFAULT_SQM[roomType];
  const roomDescription = plan?.room_description ?? `a typical NZ ${roomType}`;

  // 2. gpt-image-1 renders, one per tier, in parallel (if an OpenAI key is set).
  //    With a room photo we EDIT it (the photo is the true base); otherwise we
  //    generate from the text description.
  let renders: { tier: RenoTier; imageUrl: string | null }[] = [];
  let imageError: string | undefined;
  if (isImageGenConfigured()) {
    try {
      const openai = getOpenAI();
      const base = await loadImageBuffer(body.photoUrl, body.photoBase64);
      renders = await Promise.all(
        TIER_ORDER.map(async (tier) => {
          try {
            let b64: string | null | undefined;
            if (base) {
              const ext = base.type.split("/")[1] || "png";
              const file = await toFile(base.buf, `room.${ext}`, { type: base.type });
              const r = await openai.images.edit({
                model: IMAGE_MODEL,
                image: file,
                prompt: editPrompt(roomType, style, tier),
                size: "1024x1024",
              });
              b64 = r.data?.[0]?.b64_json;
            } else {
              const r = await openai.images.generate({
                model: IMAGE_MODEL,
                prompt: renderPrompt(roomType, style, tier, roomDescription),
                size: "1024x1024",
              });
              b64 = r.data?.[0]?.b64_json;
            }
            return { tier, imageUrl: b64 ? `data:image/png;base64,${b64}` : null };
          } catch (e) {
            console.warn(`[visualise] render ${tier} failed:`, (e as Error)?.message);
            return { tier, imageUrl: null };
          }
        })
      );
    } catch (e) {
      imageError = (e as Error)?.message;
    }
  }

  return NextResponse.json({
    ok: true,
    roomType,
    style,
    suggestedStyle: plan?.suggested_style ?? null,
    styleReason: plan?.style_reason ?? null,
    estimatedSqm: Math.round(estimatedSqm * 10) / 10,
    roomDescription,
    renders,
    imageGenAvailable: isImageGenConfigured(),
    imageError,
    planAvailable: Boolean(plan),
    model: { vision: ANALYSIS_MODEL, image: IMAGE_MODEL },
  });
}
