"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { categoryById } from "@/lib/marketplace/constants";
import type { Job } from "@/lib/marketplace/types";

function SuccessInner() {
  const id = useSearchParams().get("id");
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/marketplace/jobs/${id}`).then((r) => r.json()).then((d) => setJob(d.job ?? null)).catch(() => {});
  }, [id]);

  const cat = job ? categoryById(job.category) : null;

  return (
    <div className="mp-container" style={{ maxWidth: 560, textAlign: "center" }}>
      <div style={{ fontSize: 56, marginTop: 24 }}>🚀</div>
      <h1 className="mp-h1" style={{ marginTop: 8 }}>Your job is live!</h1>
      <p className="mp-muted" style={{ marginTop: 6, marginBottom: 24 }}>
        Verified tradesmen qualified for this trade can now see it and come back with quotes.
      </p>

      <div className="mp-card mp-card-pad" style={{ textAlign: "left", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span className="mp-badge">{cat?.emoji} {cat?.name ?? "Job"}</span>
        </div>
        <div style={{ fontWeight: 600 }}>{job?.address ?? "—"}</div>
        <div className="mp-muted" style={{ fontSize: 14, marginTop: 4 }}>0 quotes received yet</div>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {job && <Link href={`/marketplace/jobs/${job.id}`} className="mp-btn mp-btn-secondary" style={{ textDecoration: "none" }}>View job</Link>}
        <Link href="/dashboard" className="mp-btn" style={{ textDecoration: "none" }}>Back to dashboard</Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="mp-container" />}>
      <SuccessInner />
    </Suspense>
  );
}
