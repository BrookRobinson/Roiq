"use client";

import { useState } from "react";
import { Upload, CheckCircle2, FileText, Image, AlertTriangle } from "lucide-react";

export default function AgentUploadPage({ params }: { params: { token: string } }) {
  const [files, setFiles]     = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    // TODO: upload to Supabase Storage via API route
    // POST /api/upload/[token] with FormData
    try {
      await new Promise((r) => setTimeout(r, 2000)); // simulate upload
      setDone(true);
    } catch {
      setError("Upload failed — please try again or email the files directly.");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-md">
          <CheckCircle2 size={52} className="mx-auto mb-4" style={{ color: "var(--green)" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Files received
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Thank you. The buyer has been notified and their report will be updated within a few minutes.
          </p>
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            Powered by BDR Report · roiq.co.nz
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="font-bold text-2xl mb-1" style={{ color: "var(--brand)" }}>BDR Report</div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Agent information upload
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Upload photos and documents requested by the buyer&apos;s property analysis.
          </p>
        </div>

        {/* Token validity */}
        <div
          className="rounded-xl p-3 mb-6 flex items-center gap-2 text-xs"
          style={{ background: "var(--brand-light)", border: "1px solid var(--glass-border)" }}
        >
          <CheckCircle2 size={14} style={{ color: "var(--brand)" }} />
          <span style={{ color: "var(--brand)" }}>
            Secure link · Reference: {params.token.slice(0, 8).toUpperCase()} · Expires in 30 days
          </span>
        </div>

        {/* What to upload */}
        <div className="card p-5 mb-6">
          <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            What was requested
          </h3>
          <ul className="space-y-2">
            {[
              "West elevation of the exterior — full wall, no cropping",
              "Electrical switchboard — open panel showing breakers/fuses",
              "Subfloor access — showing foundation piles and ground condition",
              "Any other supporting documents (LIM, consent history, EQC records)",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="font-bold mono text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {i + 1}.
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Drop zone */}
        <div
          className="rounded-2xl p-8 text-center mb-4 cursor-pointer transition-colors"
          style={{
            border: `2px dashed ${files.length > 0 ? "var(--brand)" : "var(--border)"}`,
            background: files.length > 0 ? "var(--brand-light)" : "var(--surface)",
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <Upload size={32} className="mx-auto mb-3" style={{ color: files.length > 0 ? "var(--brand)" : "var(--text-muted)" }} />
          <p className="font-medium text-sm mb-1" style={{ color: "var(--text-primary)" }}>
            Drag photos and documents here
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            JPG, PNG, PDF, HEIC — up to 50MB per file
          </p>
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="card p-4 mb-4 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                {f.type.startsWith("image/") ? (
                  <Image size={15} style={{ color: "var(--brand)", flexShrink: 0 }} />
                ) : (
                  <FileText size={15} style={{ color: "var(--brand)", flexShrink: 0 }} />
                )}
                <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                  {f.name}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {(f.size / 1024 / 1024).toFixed(1)}MB
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-xs cursor-pointer hover:underline flex-shrink-0"
                  style={{ color: "var(--danger)" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl p-3 mb-4 flex items-start gap-2 text-sm"
            style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="btn-primary w-full justify-center py-3 text-base"
          style={{ opacity: files.length === 0 || uploading ? 0.5 : 1 }}
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#050d0d" }} />
              Uploading {files.length} file{files.length > 1 ? "s" : ""}…
            </>
          ) : (
            <>
              <Upload size={16} />
              Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "files"}
            </>
          )}
        </button>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          Files are securely stored and only shared with the buyer who requested them.<br />
          This link expires in 30 days. Powered by BDR Report · roiq.co.nz
        </p>
      </div>
    </div>
  );
}
