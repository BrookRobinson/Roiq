#!/usr/bin/env node
// Vision resolution / model A-B test for RoiQ.
//
// For each photo you pass, runs the SAME inspection prompt through three arms:
//   1. baseline   — claude-sonnet-4-6 @ 1568px  (current production path)
//   2. hi-model   — <HIRES_MODEL>    @ 1568px  (isolates the model change)
//   3. hi-res     — <HIRES_MODEL>    @ 2576px  (isolates the resolution gain)
//
// Compare arm 2 vs 3 → what resolution buys. Arm 1 vs 2 → what the model swap buys.
//
// Run:  node scripts/vision-resolution-test.mjs path/to/photo1.jpg photo2.heic ...
// Env:  HIRES_MODEL=claude-sonnet-5 (default) | claude-opus-4-7 | claude-opus-5
//
// Cost: 3 short vision calls per photo — cents, not the 8-min full report.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";

// --- config -----------------------------------------------------------------
const BASELINE_MODEL = "claude-sonnet-4-6";
const HIRES_MODEL = process.env.HIRES_MODEL || "claude-sonnet-5";
const PROMPT =
  "You are inspecting this single photo of a residential property for a pre-purchase report. " +
  "List EVERY defect, material, and fine detail you can actually see, most specific first. " +
  "For each, give a short confidence (high / medium / low). Do not speculate about things not " +
  "visible in this photo. Be exhaustive about small details (rust spots, cracks, grout, sealant, " +
  "paint failure, fixings) — the point is to surface how much fine detail is legible.";

const ARMS = [
  { label: "1. baseline  sonnet-4-6 @1568", model: BASELINE_MODEL, dim: 1568 },
  { label: `2. hi-model  ${HIRES_MODEL} @1568`, model: HIRES_MODEL, dim: 1568 },
  { label: `3. hi-res    ${HIRES_MODEL} @2576`, model: HIRES_MODEL, dim: 2576 },
];

// --- key from .env.local (SDK also reads ANTHROPIC_API_KEY from env) --------
function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "").trim();
  } catch {}
  return null;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Pass one or more image paths: node scripts/vision-resolution-test.mjs a.jpg b.heic");
  process.exit(1);
}
const apiKey = loadKey();
if (!apiKey) {
  console.error("No ANTHROPIC_API_KEY (checked env + .env.local).");
  process.exit(1);
}
const client = new Anthropic({ apiKey });

async function resize(buf, dim) {
  // sharp handles HEIC/JPEG/PNG in; downscale to `dim` on the long edge, JPEG out.
  const out = await sharp(buf).rotate().resize(dim, dim, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const meta = await sharp(out).metadata();
  return { out, w: meta.width, h: meta.height };
}

async function runArm(arm, buf) {
  const { out, w, h } = await resize(buf, arm.dim);
  const resp = await client.messages.create({
    model: arm.model,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: out.toString("base64") } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return { text, px: `${w}×${h}`, in: resp.usage.input_tokens, out: resp.usage.output_tokens };
}

for (const file of files) {
  console.log("\n" + "=".repeat(78) + "\nPHOTO: " + basename(file) + "\n" + "=".repeat(78));
  let buf;
  try {
    buf = readFileSync(file);
  } catch (e) {
    console.error("  cannot read " + file + ": " + e.message);
    continue;
  }
  for (const arm of ARMS) {
    process.stdout.write(`\n----- ${arm.label} -----\n`);
    try {
      const r = await runArm(arm, buf);
      console.log(`(sent ${r.px}px · ${r.in} in / ${r.out} out tokens)\n`);
      console.log(r.text.trim());
    } catch (e) {
      console.error("  ARM FAILED: " + (e?.message || e));
      if (/model/i.test(e?.message || "")) console.error("  (try HIRES_MODEL=claude-opus-4-7 if this model isn't on your key)");
    }
  }
}
console.log("\n" + "=".repeat(78) + "\nDone. Compare arm 2 vs 3 for the resolution effect.\n");
