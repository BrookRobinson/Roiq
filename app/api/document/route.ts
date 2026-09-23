import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, ANALYSIS_MODEL, isAnalysisConfigured } from "@/lib/ai/client";
import { PRODUCT_NAME } from "@/lib/brand";
import { featureGate } from "@/lib/billing/gate";

export const runtime = "nodejs";
export const maxDuration = 120;

// Documents we accept for a *verified* legal score. Each carries a tailored
// prompt so Claude knows what kind of NZ property document it's reading.
const DOC_KINDS: Record<string, { label: string; what: string; scoreGuide: string }> = {
  leg_lim: {
    label: "LIM report",
    what: "a New Zealand Land Information Memorandum (LIM) issued by a territorial authority (council)",
    scoreGuide:
      "10 = clean LIM, no hazards/notices/unconsented work; 5 = some items to investigate (e.g. minor unpermitted work, a hazard overlay); 1 = serious issues (flooding notices, dangerous-building notice, significant unconsented structural work, contaminated land).",
  },
  leg_consents: {
    label: "Building consent / CCC",
    what: "New Zealand building consent records and Code Compliance Certificates (CCCs) for the property",
    scoreGuide:
      "10 = all work consented with CCCs issued; 5 = consents present but one or more CCCs not issued / work in progress; 1 = significant work with no consent or refused/abandoned CCC.",
  },
  leg_eqc: {
    label: "EQC / insurance history",
    what: "an EQC (Toka Tū Ake) or private-insurer claim history for the property",
    scoreGuide:
      "10 = no claims / fully remediated & signed off; 5 = past claim, remediation status unclear; 1 = open claim, unrepaired damage, or an over-cap claim with structural implications.",
  },
  insp_report: {
    label: "property inspection report",
    what:
      "a New Zealand pre-purchase property (building) inspection report, written by a building " +
      "inspector or surveyor who physically attended the property and inspected it in person",
    scoreGuide:
      "10 = inspected throughout with no significant defects; 5 = defects found that are ordinary for the age and are costed or described; 1 = significant structural, weathertightness or safety defects, or large parts of the house the inspector could not access.",
  },
  leg_title: {
    label: "Record of title",
    what: "a New Zealand record of title (or title search) from Toitū Te Whenua LINZ",
    scoreGuide:
      "10 = clean freehold, no adverse encumbrances; 5 = cross-lease / unit title or notable easements/covenants to review; 1 = leasehold, caveats, or defective cross-lease.",
  },
};

interface RawDocAnalysis {
  doc_type_confirmed: boolean;
  score: number | null;
  summary: string;
  key_findings?: string[];
  red_flags?: string[];
  /** Inspection reports only — see the tool schema. */
  inspector?: string | null;
  inspected_on?: string | null;
}

const DOC_TOOL_NAME = "submit_document_analysis";

function docTool(kind: { label: string; scoreGuide: string }): Anthropic.Tool {
  return {
    name: DOC_TOOL_NAME,
    description: `Submit your analysis of the uploaded ${kind.label}.`,
    input_schema: {
      type: "object",
      properties: {
        doc_type_confirmed: {
          type: "boolean",
          description: `True only if the PDF really is a ${kind.label}. False if it's the wrong document or unreadable.`,
        },
        score: {
          type: ["integer", "null"],
          description: `1-10 verified score. ${kind.scoreGuide} Use null if doc_type_confirmed is false.`,
        },
        summary: {
          type: "string",
          description:
            "Plain-English summary for a non-expert buyer. NO jargon, NO legalese. 3-6 sentences explaining what the document says and what it means for them.",
        },
        key_findings: {
          type: "array",
          items: { type: "string" },
          description: "The most important specific facts from the document (dates, notices, consent numbers, claim amounts).",
        },
        red_flags: {
          type: "array",
          items: { type: "string" },
          description: "Anything the buyer should worry about or follow up. Empty array if none.",
        },
        // Only an inspection report fills these, and the report cites them — so
        // they are read off the document rather than typed by the buyer. Anyone
        // can type a date; this one has to be on the file that was uploaded.
        inspector: {
          type: ["string", "null"],
          description:
            "ONLY for a property inspection report: the inspector or firm named on it, exactly as written. Null for any other document, or if the report names nobody.",
        },
        inspected_on: {
          type: ["string", "null"],
          description:
            "ONLY for a property inspection report: the date of the site visit as the report states it, in YYYY-MM-DD. Null for any other document, or if no date is given.",
        },
      },
      required: ["doc_type_confirmed", "score", "summary"],
    },
  };
}

const SYSTEM = `You are ${PRODUCT_NAME}'s document verifier. You read a single uploaded New Zealand property document and return a verified, plain-English assessment for a non-expert buyer.
Rules:
- Base everything ONLY on what the document actually says. Never invent facts, dates, consent numbers, or notices.
- If the PDF is not the expected document type, or is unreadable, set doc_type_confirmed=false, score=null, and say so plainly in the summary.
- Write the summary in plain English with no legal jargon — imagine explaining it to a first-home buyer.
- Be honest about red flags; do not soften genuine risks, and do not manufacture risks that aren't there.
- For a property inspection report specifically: it only counts if a person attended the property. A desktop or drive-by assessment, a valuation, a builder's quote, a council document or a report on a DIFFERENT address is not one — set doc_type_confirmed=false and say which of those it actually is. Its findings are shown beside our own photo analysis and outrank it, so confirming the wrong file puts a stranger's conclusions about a different house into this one's report.
Return your analysis ONLY by calling the submit_document_analysis tool.`;

export async function POST(req: NextRequest) {
  // Before the key check, not after: someone without the tier should be told
  // what to buy, not told the service is down.
  const gate = await featureGate("documents");
  if (gate) return gate;

  if (!isAnalysisConfigured()) {
    return NextResponse.json(
      { error: "analysis_unavailable", message: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let body: { itemId?: string; fileName?: string; base64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const itemId = body.itemId ?? "";
  const kind = DOC_KINDS[itemId];
  if (!kind) {
    return NextResponse.json({ error: "unsupported_item", message: "No document analysis for that item." }, { status: 422 });
  }
  const base64 = (body.base64 ?? "").replace(/^data:application\/pdf;base64,/, "");
  if (!base64) {
    return NextResponse.json({ error: "missing_file", message: "No PDF data received." }, { status: 400 });
  }
  // ~32MB API cap; base64 is ~4/3 of the raw size.
  if (base64.length > 30_000_000) {
    return NextResponse.json({ error: "file_too_large", message: "PDF is too large (max ~22MB)." }, { status: 413 });
  }

  try {
    const client = getAnthropic();
    const content: Anthropic.ContentBlockParam[] = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      {
        type: "text",
        text: `The attached PDF should be ${kind.what}. Read the whole document and call ${DOC_TOOL_NAME} with a plain-English summary, a 1-10 verified score, key findings, and any red flags.`,
      },
    ];

    const resp = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [docTool(kind)],
      tool_choice: { type: "tool", name: DOC_TOOL_NAME },
      messages: [{ role: "user", content }],
    });

    const tool = resp.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === DOC_TOOL_NAME
    );
    if (!tool) throw new Error(`${PRODUCT_NAME} did not return a document analysis.`);
    const raw = tool.input as RawDocAnalysis;

    const score =
      raw.doc_type_confirmed && typeof raw.score === "number"
        ? Math.min(10, Math.max(1, Math.round(raw.score)))
        : null;

    return NextResponse.json({
      ok: true,
      itemId,
      docType: kind.label,
      docTypeConfirmed: Boolean(raw.doc_type_confirmed),
      fileName: body.fileName ?? "document.pdf",
      score,
      summary: raw.summary?.trim() || "No summary returned.",
      keyFindings: Array.isArray(raw.key_findings) ? raw.key_findings.filter(Boolean) : [],
      redFlags: Array.isArray(raw.red_flags) ? raw.red_flags.filter(Boolean) : [],
      // Only meaningful on an inspection report, and only when it was confirmed
      // to BE one — carrying an inspector's name off a rejected document would
      // let a valuation's author end up cited in a letter to an agent.
      inspector: raw.doc_type_confirmed ? raw.inspector?.trim() || null : null,
      inspectedOn: raw.doc_type_confirmed ? raw.inspected_on?.trim() || null : null,
      analysedAt: new Date().toISOString(),
      model: ANALYSIS_MODEL,
    });
  } catch (err) {
    console.error("[document]", err);
    const message = err instanceof Error ? err.message : "Document analysis failed.";
    const overloaded = /overloaded|rate.?limit|\b429\b|\b529\b/i.test(message);
    return NextResponse.json(
      { error: overloaded ? "overloaded" : "analysis_failed", message },
      { status: overloaded ? 503 : 500 }
    );
  }
}
