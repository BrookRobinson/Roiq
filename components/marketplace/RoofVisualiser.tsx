"use client";

// Client-side roof/exterior colour visualiser — pure Canvas 2D, no AI/network.
// Upload a photo → outline the roof by clicking its corners → apply the selected
// colour (grayscale the region, then multiply + overlay the colour into the clip).

import { useEffect, useRef, useState } from "react";
import { Camera, Undo2, Check } from "lucide-react";

type Mode = "upload" | "select" | "done";
type View = "before" | "after";
interface Pt { x: number; y: number; }

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function RoofVisualiser({ colorHex, colorName }: { colorHex: string | null; colorName: string | null }) {
  const [mode, setMode] = useState<Mode>("upload");
  const [view, setView] = useState<View>("before");
  const [pts, setPts] = useState<Pt[]>([]);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // ── load uploaded photo into the canvas ──
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoDataUrl(dataUrl);
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        const canvas = canvasRef.current;
        if (canvas) {
          const maxW = 1000;
          const scale = img.width > maxW ? maxW / img.width : 1;
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
        }
        setPts([]);
        setView("before");
        setMode("select");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // ── click to place outline points ──
  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mode !== "select") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    setPts((p) => [...p, { x, y }]);
  }

  function undo() { setPts((p) => p.slice(0, -1)); }

  function apply() {
    setMode("done");
    setView("after");
  }

  function reset() {
    imgRef.current = null;
    setPhotoDataUrl(null);
    setPts([]);
    setMode("upload");
    setView("before");
  }

  // ── redraw on every relevant change ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (mode === "done" && view === "after" && colorHex && pts.length >= 3) {
      const { r, g, b } = hexToRgb(colorHex);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.clip();
      try { ctx.filter = "grayscale(1) brightness(1.08) contrast(1.05)"; } catch { /* older browsers */ }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    }

    if (pts.length > 0) {
      if (mode === "select") {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = "#e8622a";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#e8622a";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#fff";
          ctx.stroke();
        });
      } else if (mode === "done") {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [mode, view, pts, colorHex, photoDataUrl]);

  // ── upload state ──
  if (mode === "upload") {
    return (
      <label
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
          gap: 8, padding: "48px 24px", border: "2px dashed var(--mp-border)", borderRadius: 14, cursor: "pointer", background: "#fff",
        }}
      >
        <Camera size={32} style={{ color: "var(--mp-orange)" }} />
        <div style={{ fontWeight: 600, color: "var(--mp-ink)" }}>Upload a photo of your home</div>
        <div className="mp-muted" style={{ fontSize: 14 }}>Our AI will generate a realistic colour preview</div>
        <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      </label>
    );
  }

  // ── select / done ──
  return (
    <div>
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 14, border: "1px solid var(--mp-border)", cursor: mode === "select" ? "crosshair" : "default" }}
        />

        {/* Before/After toggle */}
        {mode === "done" && (
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", background: "rgba(255,255,255,0.95)", borderRadius: 999, padding: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            {(["before", "after"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  background: view === v ? "var(--mp-navy)" : "transparent", color: view === v ? "#fff" : "var(--mp-muted)",
                }}
              >
                {v === "before" ? "Before" : `After · ${colorName ?? "colour"}`}
              </button>
            ))}
          </div>
        )}

        {/* instruction overlay (select mode) */}
        {mode === "select" && (
          <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, background: "rgba(11,46,79,0.88)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13, textAlign: "center" }}>
            {pts.length === 0 ? "Click the corners of your roof to outline the area" : `${pts.length} point${pts.length > 1 ? "s" : ""} placed · Add more or apply when ready`}
          </div>
        )}
      </div>

      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {mode === "select" && pts.length > 0 && (
          <button className="mp-btn-secondary mp-btn" onClick={undo} style={{ padding: "8px 14px", fontSize: 14 }}>
            <Undo2 size={14} /> Undo
          </button>
        )}
        {mode === "select" && pts.length >= 3 && colorHex && (
          <button className="mp-btn" onClick={apply} style={{ padding: "8px 16px", fontSize: 14 }}>
            <Check size={14} /> Apply {colorName ?? "colour"}
          </button>
        )}
        {mode === "select" && pts.length < 3 && (
          <span className="mp-muted" style={{ fontSize: 13 }}>Place at least 3 points to apply a colour.</span>
        )}
        <button className="mp-link" onClick={reset} style={{ marginLeft: "auto", fontSize: 13 }}>
          Use a different photo
        </button>
      </div>
    </div>
  );
}
