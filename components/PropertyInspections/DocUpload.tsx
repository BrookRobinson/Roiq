"use client";

// ============================================================
// Upload a LIM / consent file / EQC history / title and have it read.
//
// The refusal path is the important one. Claude is asked first whether the PDF
// really is the document it was slotted against, and a "no" must reach the
// person who uploaded it: it used to be handed straight to onVerified, stored,
// and then quietly ignored downstream because nothing scores an unconfirmed
// document — so uploading a plumber's invoice to the LIM slot looked exactly
// like uploading nothing at all, twice, before anyone thought to check the file.
// ============================================================

import { useRef, useState } from "react";
import type { DocAnalysis } from "@/lib/report-store";
import { Upload, Loader2, AlertTriangle, FileWarning } from "lucide-react";

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
  /** Claude read it and said it isn't the document. Shown, never stored. */
  const [wrongDoc, setWrongDoc] = useState<DocAnalysis | null>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setBusy(true);
    setError(null);
    setWrongDoc(null);
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
      const doc = data as DocAnalysis;
      if (!doc.docTypeConfirmed) {
        // Nothing downstream scores an unconfirmed document, so storing it would
        // just leave the item looking unuploaded with no explanation.
        setWrongDoc(doc);
        return;
      }
      onVerified(doc);
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

      {/* Read, and it isn't what it was slotted against. Claude's own words on
          what the file actually is, so the person can see the mix-up rather than
          wonder why the upload did nothing. */}
      {wrongDoc && (
        <div
          className="mt-2.5 rounded-lg p-3"
          style={{ background: "var(--warn-wash)", border: "1px solid var(--warn-wash)" }}
        >
          <div className="flex items-start gap-2">
            <FileWarning size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warn)" }} />
            <div>
              <div className="text-xs font-semibold" style={{ color: "var(--warn)" }}>
                That isn&rsquo;t the {wrongDoc.docType} — nothing has been scored
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {wrongDoc.summary}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
