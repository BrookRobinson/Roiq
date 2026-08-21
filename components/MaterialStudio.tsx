"use client";

import { blurOnWheel } from "@/lib/ui/number-input";
import { useMemo, useState } from "react";
import { Wand2, Upload, Loader2, ChevronRight, ExternalLink } from "lucide-react";
import {
  materialsFor, estimateMaterial, type Surface, type MaterialType,
} from "@/lib/materials-catalogue";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-NZ")}`;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

/**
 * Interactive material + colour picker with a live estimate and a gpt-image-1 preview
 * of the buyer's actual room in the chosen material. "Preview" renders one image
 * (the estimate updates instantly — only the image costs/waits).
 */
export function MaterialStudio({
  surface, photoUrls, photoRefs, defaultAreaSqm,
}: {
  surface: Surface;
  photoUrls: string[];
  photoRefs?: number[];
  defaultAreaSqm?: number;
}) {
  const materials = useMemo(() => materialsFor(surface), [surface]);
  const [open, setOpen] = useState(false);
  const [matId, setMatId] = useState(materials[0]?.id ?? "");
  const [colourId, setColourId] = useState(materials[0]?.colours[0]?.id ?? "");
  const [area, setArea] = useState<number>(Math.max(1, Math.round(defaultAreaSqm ?? 20)));
  const [paySomeone, setPaySomeone] = useState(true);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageGenAvailable, setImageGenAvailable] = useState(true);

  const mat: MaterialType | undefined = materials.find((m) => m.id === matId) ?? materials[0];
  const colour = mat?.colours.find((c) => c.id === colourId) ?? mat?.colours[0];

  const listingPhoto =
    (photoRefs && photoRefs.length > 0 && photoUrls[photoRefs[0] - 1]?.startsWith("http") ? photoUrls[photoRefs[0] - 1] : null) ??
    photoUrls.find((u) => u?.startsWith("http")) ??
    null;
  const basePhoto = photoBase64 ?? listingPhoto;

  const est = mat ? estimateMaterial(mat, area, paySomeone) : { material: 0, install: 0, total: 0 };

  function pickMaterial(id: string) {
    setMatId(id);
    const m = materials.find((x) => x.id === id);
    setColourId(m?.colours[0]?.id ?? "");
    setImageUrl(null); // stale render no longer matches the selection
  }

  async function preview() {
    if (!mat || !colour) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visualise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface, materialId: mat.id, colourId: colour.id,
          photoUrl: photoBase64 ? undefined : listingPhoto ?? undefined,
          photoBase64: photoBase64 ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? `Failed (HTTP ${res.status}).`); return; }
      setImageGenAvailable(Boolean(data.imageGenAvailable));
      setImageUrl(data.imageUrl ?? null);
      if (data.imageGenAvailable && !data.imageUrl) {
        setError(data.imageError ? `Preview unavailable: ${data.imageError}` : "Couldn't render this one — try again.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    setPhotoBase64(await readBase64(file));
    setImageUrl(null);
  }

  if (materials.length === 0) return null;

  return (
    <div className="mt-3" style={{ borderTop: "1px dashed var(--border)", paddingTop: "0.75rem" }}>
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: "var(--brand)" }}>
        <Wand2 size={14} /> Customise materials &amp; preview
        <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div className="mt-3 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Preview image */}
            <div>
              <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                {loading ? (
                  <div className="text-center">
                    <Loader2 size={22} className="animate-spin mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Rendering…</div>
                  </div>
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={`${mat?.label} preview`} className="w-full h-full object-cover" />
                ) : basePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={basePhoto} alt="Your space" className="w-full h-full object-cover" style={{ opacity: 0.5 }} />
                ) : (
                  <div className="text-center px-3">
                    <Wand2 size={18} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Upload a photo of the room to preview</div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer" style={{ color: "var(--brand)" }}>
                  <Upload size={12} /> Upload room photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
                </label>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {imageUrl ? "AI preview (gpt-image-1)" : basePhoto ? "Your listing photo" : ""}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3">
              {/* Material type */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Material</label>
                <select value={matId} onChange={(e) => pickMaterial(e.target.value)} className="input mt-1 w-full text-sm">
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.label} — {fmt(m.pricePerSqm)}/m²</option>
                  ))}
                </select>
              </div>

              {/* Colour / finish */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Colour / finish{colour ? ` — ${colour.label}` : ""}
                </label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {mat?.colours.map((c) => {
                    const sel = c.id === colour?.id;
                    return (
                      <button key={c.id} title={c.label} aria-label={c.label}
                        onClick={() => { setColourId(c.id); setImageUrl(null); }}
                        className="w-7 h-7 rounded-full cursor-pointer transition-transform"
                        style={{ background: c.swatch, border: "1px solid rgba(255,255,255,0.2)", outline: sel ? "2px solid var(--brand)" : "none", outlineOffset: 2, transform: sel ? "scale(1.08)" : "none" }} />
                    );
                  })}
                </div>
              </div>

              {/* Area + labour */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Area (m²)</label>
                  <input type="number" onWheel={blurOnWheel} min={1} value={area} onChange={(e) => setArea(Math.max(1, Number(e.target.value) || 0))} className="input mt-1 w-full text-sm" />
                </div>
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {(["diy", "pay"] as const).map((m) => {
                    const active = (m === "pay") === paySomeone;
                    return (
                      <button key={m} onClick={() => setPaySomeone(m === "pay")}
                        className="text-xs px-2.5 py-2 cursor-pointer"
                        style={{ background: active ? "var(--brand)" : "transparent", color: active ? "var(--on-accent)" : "var(--text-secondary)" }}>
                        {m === "diy" ? "DIY" : "Pay someone"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live estimate */}
              <div className="rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>Material ({fmt(mat?.pricePerSqm ?? 0)}/m² × {area}m²)</span><span className="mono">{fmt(est.material)}</span>
                </div>
                {paySomeone && (
                  <div className="flex items-center justify-between text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    <span>Install ({fmt(mat?.installPerSqm ?? 0)}/m²)</span><span className="mono">{fmt(est.install)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-bold mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  <span>Estimated total</span><span className="mono" style={{ color: "var(--brand)" }}>{fmt(est.total)}</span>
                </div>
                {mat?.note && <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>{mat.note}{mat.lifespan ? ` · ${mat.lifespan}` : ""}</div>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button onClick={preview} disabled={loading} className="btn-primary flex-1 justify-center text-sm py-2" style={{ opacity: loading ? 0.6 : 1 }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {imageUrl ? "Re-render" : "Preview in my room"}
                </button>
                {mat?.shop && colour && (
                  <a href={mat.shop.url(colour.label)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg"
                    style={{ border: "1px solid var(--brand)", color: "var(--brand)" }}>
                    Shop {mat.shop.retailer} <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {error && <div className="text-xs" style={{ color: "var(--bad)" }}>{error}</div>}
              {!imageGenAvailable && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Add OPENAI_API_KEY to enable AI previews — the estimate and shopping links work without it.</div>}
            </div>
          </div>

          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
            Estimate uses indicative NZ material prices (material + install). Preview is an AI concept from your photo (gpt-image-1) — a guide, not an exact product match. &ldquo;Shop&rdquo; opens a live product search for the selected material and colour.
          </p>
        </div>
      )}
    </div>
  );
}
