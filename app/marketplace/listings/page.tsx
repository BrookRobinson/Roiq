"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TRADE_CATEGORIES, categoryById } from "@/lib/marketplace/constants";
import { timeAgo } from "@/lib/marketplace/format";
import type { JobListItem } from "@/lib/marketplace/types";

export default function ListingsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      setJobs(null); setBlocked(false);
      const res = await fetch(`/api/marketplace/jobs${filter !== "all" ? `?category=${filter}` : ""}`);
      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "not_verified") { router.replace("/marketplace/verify"); return; }
        if (live) setBlocked(true);
        return;
      }
      const d = await res.json();
      if (live) setJobs(d.jobs ?? []);
    })();
    return () => { live = false; };
  }, [filter, router]);

  if (blocked) {
    return (
      <div className="mp-container">
        <div className="mp-card mp-card-pad">
          <h2 className="mp-h2">Tradesman view only</h2>
          <p className="mp-muted" style={{ marginTop: 6 }}>
            Switch to <b>🔨 Tradesman</b> (top right) to browse and quote on jobs. Homeowners post jobs from the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mp-container">
      <h1 className="mp-h1">Available jobs</h1>
      <p className="mp-muted" style={{ marginTop: 6, marginBottom: 16 }}>
        Jobs you're qualified for, near you. Submit a quote to reveal the homeowner's contact details.
      </p>

      {/* category filter */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        <button className={`mp-pill ${filter === "all" ? "mp-pill-active" : ""}`} onClick={() => setFilter("all")}>All trades</button>
        {TRADE_CATEGORIES.map((c) => (
          <button key={c.id} className={`mp-pill ${filter === c.id ? "mp-pill-active" : ""}`} onClick={() => setFilter(c.id)}>{c.name}</button>
        ))}
      </div>

      {jobs === null ? (
        <div className="mp-muted">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="mp-card mp-card-pad mp-muted">No open jobs for this trade right now. Check back soon.</div>
      ) : (
        <>
          <div className="mp-muted" style={{ fontSize: 14, marginBottom: 10 }}>{jobs.length} job{jobs.length > 1 ? "s" : ""} · Christchurch &amp; Canterbury</div>
          <div style={{ display: "grid", gap: 12 }}>
            {jobs.map((j) => {
              const cat = categoryById(j.category);
              return (
                <Link key={j.id} href={`/marketplace/listings/${j.id}`} className="mp-card mp-card-pad mp-card-hover" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span className="mp-badge">{cat?.emoji} {cat?.name}</span>
                    {j.urgent && <span className="mp-badge mp-badge-urgent">Urgent</span>}
                    {j.alreadyQuoted && <span className="mp-badge mp-badge-green">✓ Quoted</span>}
                    <span className="mp-muted" style={{ fontSize: 13, marginLeft: "auto" }}>{timeAgo(j.createdAt)}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--mp-ink)" }}>{j.title}</div>
                  <div className="mp-muted" style={{ fontSize: 14, marginTop: 2 }}>📍 {j.suburb}</div>
                  <p className="mp-muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{j.descriptionPreview}</p>
                  <div style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
                    <span className="mp-muted" style={{ fontSize: 13 }}>{j.quoteCount} quote{j.quoteCount === 1 ? "" : "s"} so far</span>
                    <span className="mp-link" style={{ marginLeft: "auto" }}>View &amp; quote →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
