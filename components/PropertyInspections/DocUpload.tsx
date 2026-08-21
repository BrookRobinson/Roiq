"use client";

import { useRef, useState } from "react";
import type { DocAnalysis } from "@/lib/report-store";
import { Upload, Loader2, AlertTriangle } from "lucide-react";

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ""));
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });
}

export function DocUpload({
  itemId,
  label = "Upload PDF",
  onVerified,
}: {
  itemId: string;
  label?: string;
  onVerified: (doc: DocAnalysis) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base64 = await readBase64(file);
      const res = await fetch("/api/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, fileName: file.name, base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 503
            ? "Document analysis isn't configured (no API key)."
            : data.message ?? `Analysis failed (HTTP ${res.status}).`
        );
        return;
      }
      onVerified(data as DocAnalysis);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        data-doc-upload={itemId}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        disabled={busy}
        className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
        style={{ background: busy ? "var(--surface-2)" : "var(--brand)", color: busy ? "var(--text-muted)" : "var(--on-accent)", opacity: busy ? 0.8 : 1 }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? "Reading document…" : label}
      </button>
      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: "var(--bad)" }}>
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
