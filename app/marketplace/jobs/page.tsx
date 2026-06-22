"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categoryById } from "@/lib/marketplace/constants";
import { timeAgo } from "@/lib/marketplace/format";
import type { Job } from "@/lib/marketplace/types";

type JobRow = Job & { quoteCount: number };

export default function HomeownerJobsPage() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/marketplace/homeowner/jobs");
      if (res.status === 403) { setBlocked(true); return; }
      const d = await res.json();
      setJobs(d.jobs ?? []);
    })();
  }, []);

  if (blocked) {
    return (
      <div className="mp-container">
        <div className="mp-card mp-card-pad">
          <h2 className="mp-h2">Homeowner view only</h2>
          <p className="mp-muted" style={{ marginTop: 6 }}>Switch to <b>🏠 Homeowner</b> (top right) to see your posted jobs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mp-container">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 className="mp-h1">Your jobs</h1>
        <Link href="/marketplace/post/category" className="mp-btn" style={{ marginLeft: "auto", textDecoration: "none" }}>+ Post a job</Link>
      </div>

      {jobs === null ? (
        <div className="mp-muted">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="mp-card mp-card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🧰</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>No jobs yet</div>
          <p className="mp-muted" style={{ fontSize: 14, marginTop: 4 }}>Post a renovation job and verified tradesmen will quote.</p>
          <Link href="/marketplace/post/category" className="mp-btn" style={{ marginTop: 14, textDecoration: "none", display: "inline-flex" }}>Post your first job</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {jobs.map((j) => {
            const cat = categoryById(j.category);
            return (
              <Link key={j.id} href={`/marketplace/jobs/${j.id}`} className="mp-card mp-card-pad mp-card-hover" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="mp-badge">{cat?.emoji} {cat?.name}</span>
                  {j.status === "DRAFT" && <span className="mp-badge mp-badge-grey">Draft</span>}
                  {j.status === "CLOSED" && <span className="mp-badge mp-badge-green">Completed</span>}
                  {j.urgent && j.status === "LIVE" && <span className="mp-badge mp-badge-urgent">Urgent</span>}
                  <span className="mp-muted" style={{ fontSize: 13, marginLeft: "auto" }}>{timeAgo(j.createdAt)}</span>
                </div>
                <div style={{ fontWeight: 600 }}>{j.address || "—"}</div>
                <div className="mp-muted" style={{ fontSize: 14, marginTop: 6 }}>
                  {j.status === "DRAFT" ? "Draft — not yet posted" : `${j.quoteCount} quote${j.quoteCount === 1 ? "" : "s"} received`}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
