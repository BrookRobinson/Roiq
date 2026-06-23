"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { categoryById, materialById, colourById } from "@/lib/marketplace/constants";
import { loadDraft, clearDraft, type JobDraft } from "@/lib/marketplace/draft";

export default function ReviewPage() {
  const router = useRouter();
  const [d, setD] = useState<JobDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dr = loadDraft();
    if (!dr.category || !dr.description) { router.replace("/marketplace/post/category"); return; }
    setD(dr);
  }, [router]);

  if (!d) return null;
  const cat = categoryById(d.category!);
  const mat = materialById(d.material);
  const col = colourById(d.colour);
  const photoCount = d.photos?.length ?? 0;

  async function submit(status: "LIVE" | "DRAFT") {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/marketplace/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, status }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "Could not post the job."); setBusy(false); return; }
      clearDraft();
      router.push(status === "DRAFT" ? "/marketplace/jobs" : `/marketplace/post/success?id=${data.job.id}`);
    } catch {
      setError("Network error — please try again."); setBusy(false);
    }
  }

  return (
    <div className="mp-container">
      <Link href="/marketplace/post/details" className="mp-back">← Back</Link>

      <div style={{ marginBottom: 18 }}>
        <div className="mp-muted" style={{ fontSize: 13, marginBottom: 6 }}>Step 2 of 2</div>
        <div className="mp-progress-track"><div className="mp-progress-fill" style={{ width: "100%" }} /></div>
      </div>

      <h1 className="mp-h1">Ready to post</h1>
      <p className="mp-muted" style={{ marginTop: 6, marginBottom: 20 }}>
        Tradesmen will visit the site and provide their own quotes — you compare them side by side.
      </p>

      {error && <div className="mp-orange-card" style={{ marginBottom: 16, color: "var(--mp-orange)" }}>{error}</div>}

      {/* summary */}
      <div className="mp-card mp-card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span className="mp-badge">{cat?.emoji} {cat?.name}</span>
          {col && <span className="mp-badge mp-badge-grey">{mat ? `${mat.name} · ` : ""}{col.name}</span>}
        </div>
        <p style={{ marginBottom: 12, lineHeight: 1.6 }}>{d.description}</p>
        <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8, fontSize: 14 }}>
          <dt className="mp-muted">Address</dt><dd>{d.address || "—"}</dd>
          <dt className="mp-muted">Region</dt><dd>{d.region || "—"}</dd>
          <dt className="mp-muted">Photos</dt><dd>{photoCount} attached</dd>
          <dt className="mp-muted">Who sees it</dt><dd>Verified {cat?.name} tradesmen in {d.region || "your region"}</dd>
        </dl>
      </div>

      {/* what happens next */}
      <div className="mp-orange-card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "var(--mp-navy)", marginBottom: 10 }}>What happens next</div>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 14, color: "var(--mp-ink)" }}>
          <li>Verified tradesmen see your listing.</li>
          <li>Each tradesman visits and submits their own quote.</li>
          <li>You compare quotes and contact tradesmen directly by email or phone.</li>
          <li>Rate the tradesman once the job is complete.</li>
        </ol>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button className="mp-btn mp-btn-secondary" disabled={busy} onClick={() => submit("DRAFT")}>Save as draft</button>
        <button className="mp-btn" disabled={busy} onClick={() => submit("LIVE")}>{busy ? "Posting…" : "Post this job"}</button>
      </div>
    </div>
  );
}
