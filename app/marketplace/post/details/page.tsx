"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { categoryById, ROOFING_MATERIALS, ROOF_COLOURS, type TradeCategory } from "@/lib/marketplace/constants";
import { loadDraft, saveDraft } from "@/lib/marketplace/draft";
import { RoofVisualiser } from "@/components/marketplace/RoofVisualiser";

export default function DetailsPage() {
  const router = useRouter();
  const [cat, setCat] = useState<TradeCategory | null>(null);
  const [material, setMaterial] = useState<string | undefined>(undefined);
  const [colour, setColour] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = loadDraft();
    if (!d.category) { router.replace("/marketplace/post/category"); return; }
    setCat(categoryById(d.category) ?? null);
    setMaterial(d.material);
    setColour(d.colour);
    setDescription(d.description ?? "");
    setAddress(d.address ?? "");
    setPhotos(d.photos ?? []);
  }, [router]);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((p) => [...p, reader.result as string]);
      reader.readAsDataURL(f);
    });
  }

  if (!cat) return null;
  const colourObj = ROOF_COLOURS.find((c) => c.id === colour) ?? null;
  const canContinue = description.trim().length > 0 && address.trim().length > 0;

  function cont() {
    saveDraft({
      material: cat!.id === "roofing" ? material : undefined,
      colour: cat!.hasVisualiser ? colour : undefined,
      description,
      address,
      photos,
    });
    router.push("/marketplace/post/review");
  }

  return (
    <div className="mp-container">
      <Link href="/marketplace/post/category" className="mp-back">← Back</Link>

      {/* progress */}
      <div style={{ marginBottom: 18 }}>
        <div className="mp-muted" style={{ fontSize: 13, marginBottom: 6 }}>Step 1 of 2 · {cat.name}</div>
        <div className="mp-progress-track"><div className="mp-progress-fill" style={{ width: "50%" }} /></div>
      </div>

      {cat.hasVisualiser ? (
        <div className="mp-card mp-card-pad" style={{ marginBottom: 20 }}>
          <h2 className="mp-h2">AI visualiser</h2>
          <p className="mp-muted" style={{ fontSize: 14, marginTop: 4, marginBottom: 16 }}>
            Preview a colour on your own home before you post. Upload a photo, outline the area, and apply a colour — this is just for your reference; tradesmen still quote on the real job.
          </p>

          {cat.id === "roofing" && (
            <div style={{ marginBottom: 16 }}>
              <label className="mp-label">Roofing material</label>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {ROOFING_MATERIALS.map((m) => (
                  <button key={m.id} onClick={() => setMaterial(m.id)} className={`mp-pill ${material === m.id ? "mp-pill-active" : ""}`}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="mp-label">{cat.id === "roofing" ? "Roof colour" : "Colour"}</label>
          <div className="mp-grid-4" style={{ marginBottom: 16 }}>
            {ROOF_COLOURS.map((c) => {
              const on = colour === c.id;
              return (
                <button key={c.id} onClick={() => setColour(c.id)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center", padding: 0 }}>
                  <div style={{ height: 56, borderRadius: 10, background: c.hex, border: on ? "3px solid var(--mp-orange)" : "1px solid var(--mp-border)", boxShadow: on ? "0 0 0 2px var(--mp-orange-soft)" : "none" }} />
                  <div style={{ fontSize: 12, marginTop: 4, color: on ? "var(--mp-orange)" : "var(--mp-muted)", fontWeight: on ? 600 : 400 }}>{c.name}</div>
                </button>
              );
            })}
          </div>

          <RoofVisualiser colorHex={colourObj?.hex ?? null} colorName={colourObj?.name ?? null} />
        </div>
      ) : (
        <div className="mp-card mp-card-pad" style={{ marginBottom: 20 }}>
          <label className="mp-label">Photos</label>
          <p className="mp-muted" style={{ fontSize: 13, marginTop: -2, marginBottom: 10 }}>Add photos of the area so tradesmen can see what's involved.</p>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
            style={{ border: "2px dashed var(--mp-border)", borderRadius: 12, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: "#fff" }}
          >
            <div style={{ fontWeight: 600 }}>Click to upload or drag photos here</div>
            <div className="mp-muted" style={{ fontSize: 13 }}>JPG or PNG</div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => addPhotos(e.target.files)} />
          </div>
          {photos.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--mp-border)" }} />
                  <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: "none", background: "var(--mp-navy)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mp-card mp-card-pad" style={{ marginBottom: 20 }}>
        <label className="mp-label">Describe the job</label>
        <textarea className="mp-textarea" placeholder="What needs doing? Include size, materials, access, timing — anything that helps a tradesman quote accurately." value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="mp-label" style={{ marginTop: 16 }}>Property address</label>
        <input className="mp-input" placeholder="12 Example Street, Riccarton, Christchurch" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="mp-btn" disabled={!canContinue} onClick={cont}>Continue →</button>
      </div>
    </div>
  );
}
