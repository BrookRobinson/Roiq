"use client";

import Navbar from "@/components/Navbar";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, CheckCircle2, ImagePlus, X, AlertTriangle, Plus } from "lucide-react";
import { saveReport, saveReportPersona } from "@/lib/report-store";
import type { Persona } from "@/lib/scoring/model";
import { PersonaChoice, PersonaRequiredDialog } from "@/components/report/PersonaChoice";
import { contributeToMap } from "@/lib/map/contribution";
import { persistReport } from "@/lib/reports/client";
import { MANDATORY_CATEGORIES, OPTIONAL_CATEGORIES, type PhotoCategory } from "@/lib/photo-categories";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";
import { PRODUCT_NAME } from "@/lib/brand";

type Step = "input" | "analysing" | "done";
interface Shot { dataUrl: string; name: string }

/** Read a file's raw bytes as a data URL — the fallback when the browser can't
 * decode the format in-canvas (e.g. HEIC in Chrome/Firefox). The server (sharp,
 * with HEIF support) then converts it to JPEG during analysis. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read that file"));
    r.readAsDataURL(file);
  });
}

// Draw a decoded bitmap/image to a downscaled JPEG data URL.
function drawToJpeg(src: CanvasImageSource, srcW: number, srcH: number, maxDim: number, quality: number): string | null {
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// Decode + downscale a picked photo in the browser before upload — keeps the
// request small and fast (Anthropic downscales >1568px anyway, so quality is
// unaffected). Critically, HEIC (the default iPhone format) must be converted to
// JPEG here: Anthropic doesn't accept HEIC, and sending raw HEIC makes the upload
// tens of MB (which fails). Three decode paths, most reliable first:
//   1. createImageBitmap — Safari decodes HEIC this way, and it honours EXIF rotation.
//   2. <img> element — the classic path for JPEG/PNG on every browser.
//   3. raw bytes — last resort; the server (sharp/HEIF) converts them.
async function resizeToDataUrl(file: File, maxDim = 1400, quality = 0.8): Promise<string> {
  // 1 — createImageBitmap (handles HEIC in Safari)
  try {
    const bitmap = await createImageBitmap(file);
    const out = drawToJpeg(bitmap, bitmap.width, bitmap.height, maxDim, quality);
    bitmap.close?.();
    if (out) return out;
  } catch { /* fall through */ }

  // 2 — <img> element
  const viaImg = await new Promise<string | null>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(drawToJpeg(img, img.width, img.height, maxDim, quality)); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
  if (viaImg) return viaImg;

  // 3 — raw bytes; the server converts (e.g. HEIC on a browser that decodes neither way)
  return fileToDataUrl(file);
}

export default function UploadReportPage() {
  const router = useRouter();
  const acctReady = useRequireAuth("/report/upload");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState(""); // formatted, e.g. "310,000"
  const [scrapedPrice, setScrapedPrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Record<string, Shot[]>>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  // Same rule as /report/new: an explicit choice, never a default.
  const [persona, setPersona] = useState<Persona | null>(null);
  const [askPersona, setAskPersona] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState<string | null>(null);
  // Background data resolved from the address while the user picks photos.
  const prefetch = useRef<{ key: string; data: Record<string, unknown> | null } | null>(null);

  const addressOk = address.trim().length > 0;
  const priceNum = Number(price.replace(/[^0-9]/g, "")) || 0;
  const priceOk = priceNum > 0;
  // The web search found a listing price that differs from what the user typed.
  const priceDiffers = scrapedPrice != null && priceOk && priceNum !== scrapedPrice;
  const missingMandatory = MANDATORY_CATEGORIES.filter((c) => !photos[c.id]?.length);
  const mandatoryDone = missingMandatory.length === 0;
  const canSubmit = addressOk && priceOk && mandatoryDone;

  const buttonLabel = !addressOk || !priceOk
    ? "Add address and price to continue"
    : !mandatoryDone
      ? "Add required photos to continue"
      : "Analyse property";

  // Numbers only, formatted as currency as the user types (no $ needed).
  const onPriceChange = (v: string) => {
    const digits = v.replace(/[^0-9]/g, "").slice(0, 9);
    setPrice(digits ? Number(digits).toLocaleString("en-US") : "");
  };

  // Prefill address + price when arriving from the "No photos found" report banner
  // (/report/upload?address=…&price=…).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get("address");
    const p = params.get("price");
    if (a) setAddress(a);
    if (p) { const d = p.replace(/[^0-9]/g, ""); if (d) setPrice(Number(d).toLocaleString("en-US")); }
  }, []);

  // Add one or more photos to a slot (a file input can pick several at once).
  const addShots = async (catId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const resized = await Promise.all(
        Array.from(files).map((f) => resizeToDataUrl(f).then((dataUrl) => ({ dataUrl, name: f.name })))
      );
      setPhotos((p) => ({ ...p, [catId]: [...(p[catId] ?? []), ...resized] }));
    } catch {
      setError("One of those files couldn't be read as an image — try a JPEG, PNG or HEIC photo.");
    }
  };
  const removeShotAt = (catId: string, index: number) =>
    setPhotos((p) => {
      const arr = (p[catId] ?? []).filter((_, i) => i !== index);
      const n = { ...p };
      if (arr.length) n[catId] = arr; else delete n[catId];
      return n;
    });

  // Kick off address-based data loading in the background (council/suburb/comparables)
  // so it's ready by the time the user finishes selecting photos.
  const startPrefetch = useCallback(async () => {
    const key = address.trim();
    if (!key || prefetch.current?.key === key) return;
    prefetch.current = { key, data: null };
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: key, prefetch: true }),
      });
      if (res.ok && prefetch.current?.key === key) {
        const data = await res.json();
        prefetch.current.data = data;
        // If the search found a listing price, remember it + auto-fill (unless the
        // user already typed one — they can always override).
        const sp = (data as { listing?: { askingPrice?: number } })?.listing?.askingPrice;
        if (typeof sp === "number" && sp > 0) {
          setScrapedPrice(sp);
          setPrice((prev) => (prev.trim() ? prev : sp.toLocaleString("en-US")));
        }
      }
    } catch {
      /* non-fatal — the analyse call will fetch it if the prefetch didn't land */
    }
  }, [address]);

  async function analyse(withPersona: Persona | null = persona) {
    setTriedSubmit(true);
    setError(null);
    if (!addressOk || !priceOk) return; // inline address/price errors render below
    if (!mandatoryDone) return; // missing-photos block renders below
    if (!withPersona) {
      setAskPersona(true);
      return;
    }

    setStep("analysing");
    try {
      const payload = {
        address: address.trim(),
        askingPrice: priceNum, // the user's price is authoritative → Finance tab + Value Verdict
        photos: Object.entries(photos).flatMap(([category, arr]) => arr.map((s) => ({ category, dataUrl: s.dataUrl }))),
        prefetched: prefetch.current?.key === address.trim() ? prefetch.current?.data : undefined,
      };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 503
          ? `${PRODUCT_NAME} analysis isn't configured — add a funded ANTHROPIC_API_KEY to .env.local and restart the server.`
          : data.message ?? data.error ?? `Analysis failed (HTTP ${res.status}).`);
        setStep("input");
        return;
      }
      const id = crypto.randomUUID();
      const report = {
        id,
        createdAt: new Date().toISOString(),
        listing: data.listing,
        context: data.context,
        subItems: data.subItems ?? [],
        extraDwellings: data.extraDwellings ?? [],
        penalties: data.penalties ?? [],
        scores: data.scores,
        gaps: data.gaps ?? [],
        marketRent: data.marketRent,
        capitalGrowth: data.capitalGrowth,
        suburbValue: data.suburbValue,
        photoCoverage: data.photoCoverage,
        photosAnalysed: data.photosAnalysed ?? 0,
        model: data.model,
      };
      // Open the report in the lens they chose, not the "buyer" default.
      saveReportPersona(id, withPersona);

      const saved = saveReport(report);
      if (!saved) {
        // Don't navigate to /report/[id] — with nothing stored it would show the demo.
        setError("Your report was generated but couldn't be saved in this browser. Try again with fewer photos.");
        setStep("input");
        return;
      }

      // Outlive the tab: sessionStorage above is the fast path, this is the
      // durable copy that puts the report on the dashboard tomorrow.
      persistReport(report);

      // Every pin on the map comes from a report someone ran — there is no
      // listings feed. Fire-and-forget, and only for properties that are
      // publicly for sale (the helper drops uploads).
      contributeToMap(report);
      setStep("done");
      router.push(`/report/${id}`);
    } catch {
      setError("Network error — check your connection and try again.");
      setStep("input");
    }
  }

  // Must have a (free) account to run a report.
  if (!acctReady) return <div style={{ background: "var(--bg)", minHeight: "100vh" }} />;

  if (step === "analysing" || step === "done") {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          {step === "done"
            ? <><CheckCircle2 size={56} className="mx-auto mb-4" style={{ color: "var(--success)" }} /><h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Report ready</h2><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Redirecting…</p></>
            : <><Loader2 size={48} className="mx-auto mb-4 animate-spin" style={{ color: "var(--brand)" }} /><h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Analysing your photos…</h2><p className="text-sm" style={{ color: "var(--text-secondary)" }}>{PRODUCT_NAME} vision is scoring every area. This can take 1–3 minutes.</p></>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Upload property photos</h1>
          <p className="text-base" style={{ color: "var(--text-secondary)" }}>For a property you can&apos;t link to — enter the address and upload photos of each area, and {PRODUCT_NAME} runs the full analysis.</p>
        </div>

        {error && <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(255,95,95,0.2)" }}>{error}</div>}

        {/* Address + asking price — BOTH MANDATORY */}
        <div className="rounded-2xl p-6 mb-4" style={{ background: "var(--surface)", border: `1px solid ${triedSubmit && (!addressOk || !priceOk) ? "var(--danger)" : "var(--border)"}` }}>
          <label className="text-sm font-semibold mb-2 block" style={{ color: "var(--text-primary)" }}>
            Property address <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            className="input text-base w-full"
            placeholder="e.g. 6 Ocean Beach Road, Bluff"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={startPrefetch}
          />
          {triedSubmit && !addressOk && (
            <p className="text-sm mt-2 flex items-start gap-1.5" style={{ color: "var(--danger)" }}><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> Property address is required. We need this to retrieve council records, legal information, land data, suburb statistics and comparable sales.</p>
          )}

          <label className="text-sm font-semibold mb-2 mt-4 block" style={{ color: "var(--text-primary)" }}>
            Asking price <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base" style={{ color: "var(--text-muted)" }}>$</span>
            <input
              className="input text-base w-full"
              style={{ paddingLeft: 26 }}
              inputMode="numeric"
              placeholder="e.g. 310,000"
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
            />
          </div>
          {triedSubmit && !priceOk && (
            <p className="text-sm mt-2 flex items-start gap-1.5" style={{ color: "var(--danger)" }}><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> Asking price is required — it drives the financial calculator and the value verdict.</p>
          )}
          {priceDiffers && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Using your entered price of ${priceNum.toLocaleString("en-US")} — listing shows ${scrapedPrice!.toLocaleString("en-US")}</p>
          )}

          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>* Both fields required</p>
        </div>

        {/* Mandatory photos */}
        <PhotoGroup
          title="Required photos"
          subtitle="The report can't run without these — they drive condition scoring and renovation estimates."
          categories={MANDATORY_CATEGORIES}
          photos={photos}
          onAdd={addShots}
          onRemove={removeShotAt}
          danger={triedSubmit && !mandatoryDone}
        />

        {/* Missing-mandatory block (Spec 2) */}
        {triedSubmit && addressOk && !mandatoryDone && (
          <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,95,95,0.06)", border: "1px solid rgba(255,95,95,0.3)" }}>
            <div className="flex items-center gap-2 font-semibold text-sm mb-2" style={{ color: "var(--danger)" }}><AlertTriangle size={15} /> Missing required photos</div>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>{PRODUCT_NAME} needs photos of these areas to run an accurate report:</p>
            <div className="space-y-1">
              {missingMandatory.map((c) => (
                <div key={c.id} className="text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>📷 {c.label} — <span style={{ color: "var(--text-muted)" }}>not uploaded</span></div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>These areas are critical for condition scoring and renovation estimates.</p>
          </div>
        )}

        {/* Optional photos */}
        <PhotoGroup
          title="Optional photos"
          subtitle="The report runs without these, but every extra area makes it more accurate."
          categories={OPTIONAL_CATEGORIES}
          photos={photos}
          onAdd={addShots}
          onRemove={removeShotAt}
        />

        {/* Coverage + submit */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-4 text-sm mb-4">
            <span style={{ color: mandatoryDone ? "var(--success)" : "var(--text-secondary)" }}>{mandatoryDone ? "✅" : "📷"} {MANDATORY_CATEGORIES.length - missingMandatory.length} of {MANDATORY_CATEGORIES.length} required areas covered</span>
            <span style={{ color: "var(--text-muted)" }}>💡 {OPTIONAL_CATEGORIES.filter((c) => !photos[c.id]?.length).length} optional areas not photographed</span>
          </div>
          <div className="mb-4">
            <PersonaChoice value={persona} onChange={setPersona} />
          </div>

          {/* Greyed until address + all required photos are in, but still clickable so
              a tap surfaces exactly what's missing (the address error / photo list). */}
          <button
            onClick={() => analyse()}
            aria-disabled={!canSubmit}
            className="btn-primary w-full justify-center py-3 text-base"
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            {buttonLabel}{canSubmit && <ArrowRight size={18} />}
          </button>
        </div>
      </div>

      {askPersona && (
        <PersonaRequiredDialog
          onClose={() => setAskPersona(false)}
          onChoose={(chosen) => {
            setPersona(chosen);
            setAskPersona(false);
            analyse(chosen);
          }}
        />
      )}
    </div>
  );
}

function PhotoGroup({ title, subtitle, categories, photos, onAdd, onRemove, danger }: {
  title: string; subtitle: string; categories: PhotoCategory[];
  photos: Record<string, Shot[]>; onAdd: (id: string, files: FileList | null) => void; onRemove: (id: string, index: number) => void; danger?: boolean;
}) {
  return (
    <div className="rounded-2xl p-6 mb-4" style={{ background: "var(--surface)", border: `1px solid ${danger ? "rgba(255,95,95,0.3)" : "var(--border)"}` }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {categories.map((c) => <PhotoSlot key={c.id} cat={c} shots={photos[c.id] ?? []} onAdd={onAdd} onRemove={onRemove} />)}
      </div>
    </div>
  );
}

// One slot = one room/area, holding any number of photos.
function PhotoSlot({ cat, shots, onAdd, onRemove }: {
  cat: PhotoCategory; shots: Shot[]; onAdd: (id: string, files: FileList | null) => void; onRemove: (id: string, index: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const has = shots.length > 0;
  return (
    <div className="rounded-xl p-3" style={{ border: `1.5px solid ${has ? "var(--brand)" : "var(--border)"}`, background: "var(--surface-2)" }}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {cat.label}{cat.mandatory && <span style={{ color: "var(--danger)" }}> *</span>}
        </span>
        {has && <span className="text-[11px] flex-shrink-0" style={{ color: "var(--brand)" }}>{shots.length} photo{shots.length > 1 ? "s" : ""} ✅</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {shots.map((s, i) => (
          <div key={i} className="relative rounded-md overflow-hidden flex-shrink-0" style={{ width: 60, height: 60 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.dataUrl} alt={`${cat.label} ${i + 1}`} className="w-full h-full object-cover" />
            <button onClick={() => onRemove(cat.id, i)} aria-label={`Remove ${cat.label} photo ${i + 1}`}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
              <X size={10} color="white" />
            </button>
          </div>
        ))}
        <button
          onClick={() => ref.current?.click()}
          className="rounded-md flex flex-col items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ width: 60, height: 60, border: "1.5px dashed var(--border)", background: "var(--surface)" }}
          aria-label={`Add ${cat.label} photo`}
        >
          {has ? <Plus size={18} style={{ color: "var(--text-muted)" }} /> : <ImagePlus size={18} style={{ color: "var(--text-muted)" }} />}
          <span className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>Add</span>
        </button>
      </div>
      {!has && cat.hint && <div className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>{cat.hint}</div>}
      <input ref={ref} type="file" accept="image/*,.heic,.heif,image/heic,image/heif" multiple className="hidden" onChange={(e) => { onAdd(cat.id, e.target.files); e.target.value = ""; }} />
    </div>
  );
}
