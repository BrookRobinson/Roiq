"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { categoryById, categoryName, NZ_REGIONS } from "@/lib/marketplace/constants";
import { timeAgo } from "@/lib/marketplace/format";
import type { JobListItem } from "@/lib/marketplace/types";

export default function ListingsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [region, setRegion] = useState<string>("");
  const [myCategories, setMyCategories] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      setJobs(null); setBlocked(false);
      const qs = new URLSearchParams();
      if (filter !== "all") qs.set("category", filter);
      if (region) qs.set("region", region);
      const res = await fetch(`/api/marketplace/jobs${qs.toString() ? `?${qs}` : ""}`);
      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "not_verified") { router.replace("/marketplace/verify"); return; }
        if (live) setBlocked(true);
        return;
      }
      const d = await res.json();
      if (!live) return;
      setJobs(d.jobs ?? []);
      setMyCategories(d.viewer?.categories ?? []);
      if (!region && d.viewer?.region) setRegion(d.viewer.region); // adopt the tradesman's region on first load
    })();
    return () => { live = false; };
  }, [filter, region, router]);

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
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="mp-h1">Available jobs</h1>
          <p className="mp-muted" style={{ marginTop: 6 }}>
            Jobs in your trades, in your region. Submit a quote to reveal the homeowner&apos;s contact details.
          </p>
        </div>
        {/* region switcher */}
        <label style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="mp-muted" style={{ fontSize: 12, fontWeight: 600 }}>Region</span>
          <select className="mp-input" style={{ width: "auto", padding: "8px 12px" }} value={region} onChange={(e) => setRegion(e.target.value)}>
            {NZ_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {/* category filter — only the tradesman's trades */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, margin: "16px 0" }}>
        <button className={`mp-pill ${filter === "all" ? "mp-pill-active" : ""}`} onClick={() => setFilter("all")}>All my trades</button>
        {myCategories.map((c) => (
          <button key={c} className={`mp-pill ${filter === c ? "mp-pill-active" : ""}`} onClick={() => setFilter(c)}>{categoryName(c)}</button>
        ))}
      </div>

      {jobs === null ? (
        <div className="mp-muted">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="mp-card mp-card-pad mp-muted">
          No open jobs in {region || "your region"} for your trades right now. Try another region above.
        </div>
      ) : (
        <>
          <div className="mp-muted" style={{ fontSize: 14, marginBottom: 10 }}>{jobs.length} job{jobs.length > 1 ? "s" : ""} in {region}</div>
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
                  <div className="mp-muted" style={{ fontSize: 14, marginTop: 2 }}>📍 {j.suburb}, {j.region}</div>
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
