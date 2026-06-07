"use client";

import { useState } from "react";
import {
  tierPrice, TIER_ORDER, TIER_META, TIER_SCOPE, RENO_STYLES, DEFAULT_SQM,
  type RoomType, type RenoStyle, type RenoTier,
} from "@/lib/reno-visualiser";
import { Wand2, Upload, Loader2, Check, ImageOff, Sparkles, ChevronRight } from "lucide-react";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

interface RenderResult { tier: RenoTier; imageUrl: string | null }

export function RenoVisualiser({
  roomType, photoUrls, photoRefs, region, buildYear, currentCustomCost, onSelectTier,
}: {
  roomType: RoomType;
  photoUrls: string[];
  photoRefs?: number[];
  region?: string;
  buildYear?: number | null;
  currentCustomCost?: number | null;
  onSelectTier: (price: number, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [style, setStyle] = useState<RenoStyle>("Modern");
  const [suggestedStyle, setSuggestedStyle] = useState<RenoStyle | null>(null);
  const [styleReason, setStyleReason] = useState<string | null>(null);
  const [sqm, setSqm] = useState<number>(DEFAULT_SQM[roomType]);
  const [renders, setRenders] = useState<RenderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageGenAvailable, setImageGenAvailable] = useState(true);
  const [generated, setGenerated] = useState(false);

  const listingPhoto = photoRefs && photoRefs.length > 0 && photoUrls[photoRefs[0] - 1]?.startsWith("http")
    ? photoUrls[photoRefs[0] - 1]
    : null;
  const basePhoto = photoBase64 ?? listingPhoto;

  async function generate(styleArg?: RenoStyle, firstRun = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visualise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomType,
          style: styleArg,
          photoUrl: photoBase64 ? undefined : listingPhoto ?? undefined,
          photoBase64: photoBase64 ?? undefined,
          region,
          buildYear,
          sqm,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? `Failed (HTTP ${res.status}).`); return; }
      setImageGenAvailable(Boolean(data.imageGenAvailable));
      setStyle(data.style);
      if (data.suggestedStyle) { setSuggestedStyle(data.suggestedStyle); setStyleReason(data.styleReason); }
      if (firstRun && data.estimatedSqm) setSqm(data.estimatedSqm);
      setRenders(data.renders ?? []);
      setGenerated(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !generated && !loading) generate(undefined, true);
  }

  function pickStyle(s: RenoStyle) {
    setStyle(s);
    generate(s);
  }

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    const b64 = await readBase64(file);
    setPhotoBase64(b64);
    setGenerated(false);
    // regenerate from the new photo
    setTimeout(() => generate(style, true), 0);
  }

  const renderFor = (tier: RenoTier) => renders.find((r) => r.tier === tier)?.imageUrl ?? null;

  return (
    <div className="mt-3" style={{ borderTop: "1px dashed var(--border)", paddingTop: "0.75rem" }}>
      <button onClick={toggleOpen} className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: "var(--brand)" }}>
        <Wand2 size={14} /> Visualise Renovation
        <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div className="mt-3 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {/* Before photo + upload + dimensions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="sm:w-48 flex-shrink-0">
              <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Your room</div>
              <div className="rounded-lg overflow-hidden aspect-square flex items-center justify-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {basePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={basePhoto} alt="room" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center px-2">
                    <ImageOff size={20} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>No room photo found</div>
                  </div>
                )}
              </div>
              <label className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer" style={{ color: "var(--brand)" }}>
                <Upload size={12} /> Upload a better photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              {/* Suggested style */}
              {suggestedStyle && (
                <div className="text-xs mb-2 flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                  <Sparkles size={12} className="mt-0.5 flex-shrink-0" style={{ color: "var(--brand)" }} />
                  <span>We suggest <strong style={{ color: "var(--text-primary)" }}>{suggestedStyle}</strong>{styleReason ? ` — ${styleReason}` : ""}</span>
                </div>
              )}
              {/* Style picker */}
              <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Style</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {RENO_STYLES.map((s) => (
                  <button key={s} onClick={() => pickStyle(s)} disabled={loading}
                    className="text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                    style={{
                      background: style === s ? "var(--brand)" : "var(--surface-2)",
                      color: style === s ? "#04110f" : "var(--text-secondary)",
                      border: `1px solid ${style === s ? "var(--brand)" : "var(--border)"}`,
                    }}>
                    {s}{suggestedStyle === s ? " ★" : ""}
                  </button>
                ))}
              </div>
              {/* Dimensions */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Room size</span>
                <input type="number" value={sqm} min={1} step={0.5} onChange={(e) => setSqm(Math.max(1, Number(e.target.value) || 0))}
                  className="rounded px-2 py-1 text-sm w-20 mono" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>m² — prices update as you type</span>
              </div>
            </div>
          </div>

          {error && <div className="text-xs mb-3" style={{ color: "#ff5f5f" }}>{error}</div>}

          {/* Tier cards */}
          <div className="grid sm:grid-cols-3 gap-3">
            {TIER_ORDER.map((tier) => {
              const price = tierPrice(roomType, tier, sqm);
              const img = renderFor(tier);
              const selected = currentCustomCost != null && Math.abs(currentCustomCost - price) < 1;
              return (
                <div key={tier} className="rounded-lg overflow-hidden flex flex-col" style={{ background: "var(--surface-2)", border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}` }}>
                  {/* Render image */}
                  <div className="aspect-square flex items-center justify-center" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                    ) : img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={`${tier} render`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center px-3">
                        <Wand2 size={18} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {!imageGenAvailable ? "Add OPENAI_API_KEY for AI renders" : generated ? "No render" : "Concept render"}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Tier detail */}
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{TIER_META[tier].icon} {TIER_META[tier].label}</span>
                      <span className="text-sm font-bold mono" style={{ color: "var(--brand)" }}>{fmt(price)}</span>
                    </div>
                    <ul className="space-y-0.5 mb-3 flex-1">
                      {TIER_SCOPE[roomType][tier].map((b) => (
                        <li key={b} className="text-[11px] flex items-start gap-1" style={{ color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--brand)" }}>·</span>{b}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => onSelectTier(price, TIER_META[tier].label)}
                      className="w-full text-xs font-semibold py-1.5 rounded-md cursor-pointer transition-colors flex items-center justify-center gap-1"
                      style={{ background: selected ? "var(--brand)" : "transparent", color: selected ? "#04110f" : "var(--brand)", border: "1px solid var(--brand)" }}>
                      {selected ? <><Check size={12} /> Selected</> : "Use this tier"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
            AI renders (gpt-image-1){basePhoto ? " — redesigned from your actual room photo" : " — styled concept (add a room photo for a render based on your space)"}. Illustrative of the style at each budget.
            Selecting a tier sets this line&apos;s cost, which flows into the budget, yield, and predicted sale price.
          </p>
        </div>
      )}
    </div>
  );
}
