"use client";

import { useState } from "react";
import { VISUAL_TIERS, TIER_DISPLAY, type VisualKind } from "@/lib/visualiser";
import { tierTotal, type ThreeTierCost, type Tier, type LabourMode } from "@/lib/reno-costing/three-tier";
import { Wand2, Upload, Loader2, Check, ChevronRight } from "lucide-react";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

interface RenderResult { tier: Tier; imageUrl: string | null }

export function RenoVisualiser({
  kind, photoUrls, photoRefs, costing, labour, selectedTier, onSelectTier,
}: {
  kind: VisualKind;
  photoUrls: string[];
  photoRefs?: number[];
  costing: ThreeTierCost;
  labour: LabourMode;
  selectedTier: Tier;
  onSelectTier: (tier: Tier) => void;
}) {
  const [open, setOpen] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [renders, setRenders] = useState<RenderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageGenAvailable, setImageGenAvailable] = useState(true);
  const [generated, setGenerated] = useState(false);

  const listingPhoto =
    (photoRefs && photoRefs.length > 0 && photoUrls[photoRefs[0] - 1]?.startsWith("http") ? photoUrls[photoRefs[0] - 1] : null) ??
    photoUrls.find((u) => u?.startsWith("http")) ??
    null;
  const basePhoto = photoBase64 ?? listingPhoto;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visualise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, photoUrl: photoBase64 ? undefined : listingPhoto ?? undefined, photoBase64: photoBase64 ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? `Failed (HTTP ${res.status}).`); return; }
      setImageGenAvailable(Boolean(data.imageGenAvailable));
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
    if (next && !generated && !loading) generate();
  }

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    const b64 = await readBase64(file);
    setPhotoBase64(b64);
    setGenerated(false);
    setTimeout(() => generate(), 0);
  }

  const renderFor = (tier: Tier) => renders.find((r) => r.tier === tier)?.imageUrl ?? null;

  return (
    <div className="mt-3" style={{ borderTop: "1px dashed var(--border)", paddingTop: "0.75rem" }}>
      <button onClick={toggleOpen} className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: "var(--brand)" }}>
        <Wand2 size={14} /> Visualise the 3 options
        <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div className="mt-3 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {basePhoto ? "AI redesign of your listing photo (gpt-image-1)" : "AI concept render (gpt-image-1)"}
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer" style={{ color: "var(--brand)" }}>
              <Upload size={12} /> Upload a photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
            </label>
          </div>

          {error && <div className="text-xs mb-3" style={{ color: "#ff5f5f" }}>{error}</div>}

          <div className="grid sm:grid-cols-3 gap-3">
            {VISUAL_TIERS.map((tier) => {
              const img = renderFor(tier);
              const t = costing[tier];
              const mode: LabourMode = selectedTier === tier ? labour : t.defaultLabour;
              const cost = tierTotal(t, mode);
              const selected = selectedTier === tier;
              return (
                <div key={tier} className="rounded-lg overflow-hidden flex flex-col" style={{ background: "var(--surface-2)", border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}` }}>
                  <div className="aspect-square flex items-center justify-center" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                    ) : img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={`${TIER_DISPLAY[tier].label} render`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center px-3">
                        <Wand2 size={18} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {!imageGenAvailable ? "Add OPENAI_API_KEY for AI renders" : generated ? "No render" : "Concept"}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{TIER_DISPLAY[tier].icon} {TIER_DISPLAY[tier].label}</span>
                      <span className="text-sm font-bold mono" style={{ color: "var(--brand)" }}>{fmt(cost)}</span>
                    </div>
                    <button onClick={() => onSelectTier(tier)}
                      className="mt-2 w-full text-xs font-semibold py-1.5 rounded-md cursor-pointer transition-colors flex items-center justify-center gap-1"
                      style={{ background: selected ? "var(--brand)" : "transparent", color: selected ? "#04110f" : "var(--brand)", border: "1px solid var(--brand)" }}>
                      {selected ? <><Check size={12} /> Selected</> : "Use this tier"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
            AI-generated concepts (gpt-image-1){basePhoto ? " from your listing photo" : " — upload a photo for a render based on your space"}. Patch Up keeps the existing material; Replace Budget and Replace High End show new materials. Cost under each reflects that tier under your current DIY / Pay-someone choice.
          </p>
        </div>
      )}
    </div>
  );
}
