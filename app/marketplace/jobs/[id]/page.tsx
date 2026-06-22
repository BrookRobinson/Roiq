"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { categoryById, jobTitle } from "@/lib/marketplace/constants";
import { nzd, stars, timeAgo } from "@/lib/marketplace/format";
import type { Job, Quote, TradesmanPublic } from "@/lib/marketplace/types";

interface QuoteRow { quote: Quote; tradesman: TradesmanPublic | null; reviewed: boolean; }
interface OwnerDetail { role: string; job: Job; quotes: QuoteRow[]; }

export default function HomeownerJobDetail() {
  const id = String(useParams().id);
  const [d, setD] = useState<OwnerDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketplace/jobs/${id}`);
    setD(await res.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function markComplete() {
    setBusy(true);
    await fetch(`/api/marketplace/homeowner/jobs/${id}/complete`, { method: "POST" });
    await load();
    setBusy(false);
  }

  if (!d || !d.job) return <div className="mp-container mp-muted">Loading…</div>;
  const { job } = d;
  const cat = categoryById(job.category);
  const closed = job.status === "CLOSED";

  return (
    <div className="mp-container">
      <Link href="/marketplace/jobs" className="mp-back">← Your jobs</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="mp-badge">{cat?.emoji} {cat?.name}</span>
        {closed && <span className="mp-badge mp-badge-green">Completed</span>}
        {job.urgent && !closed && <span className="mp-badge mp-badge-urgent">Urgent</span>}
        <span className="mp-muted" style={{ fontSize: 13 }}>{timeAgo(job.createdAt)}</span>
      </div>
      <h1 className="mp-h1">{jobTitle(job.category, job.description)}</h1>
      <div className="mp-muted" style={{ marginTop: 4, marginBottom: 16 }}>📍 {job.address}</div>

      <div className="mp-card mp-card-pad" style={{ marginBottom: 16 }}>
        <div className="mp-label">Job description</div>
        <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{job.description}</p>
        {job.photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {job.photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" style={{ width: 110, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--mp-border)" }} />
            ))}
          </div>
        )}
      </div>

      {/* mark complete */}
      {!closed && d.quotes.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
          <button className="mp-btn mp-btn-secondary" disabled={busy} onClick={markComplete}>
            <CheckCircle2 size={15} /> Mark as complete
          </button>
        </div>
      )}

      <h2 className="mp-h2" style={{ marginBottom: 12 }}>
        {d.quotes.length} quote{d.quotes.length === 1 ? "" : "s"}
      </h2>

      {d.quotes.length === 0 ? (
        <div className="mp-card mp-card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>📭</div>
          <div style={{ fontWeight: 600, marginTop: 8 }}>No quotes yet</div>
          <p className="mp-muted" style={{ fontSize: 14, marginTop: 4 }}>Verified tradesmen will visit the site and submit quotes — check back soon.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {d.quotes.map((q) => (
            <QuoteCard key={q.quote.id} row={q} canReview={closed} onReviewed={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteCard({ row, canReview, onReviewed }: { row: QuoteRow; canReview: boolean; onReviewed: () => void }) {
  const t = row.tradesman;
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitReview() {
    setBusy(true);
    await fetch("/api/marketplace/reviews", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: row.quote.id, rating, comment: comment.trim() }),
    });
    setBusy(false);
    setOpen(false);
    onReviewed();
  }

  return (
    <div className="mp-card mp-card-pad">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>
            {t?.businessName ?? "Tradesman"} {t?.tdVerified && <span className="mp-badge mp-badge-green" style={{ marginLeft: 4 }}>✓ Verified</span>}
          </div>
          {(t?.reviewCount ?? 0) > 0 && (
            <div className="mp-muted" style={{ fontSize: 13, marginTop: 2 }}>
              <span style={{ color: "var(--mp-orange)" }}>{stars(t!.avgRating)}</span> {t!.avgRating.toFixed(1)} · {t!.reviewCount} review{t!.reviewCount === 1 ? "" : "s"}
            </div>
          )}
        </div>
        <div className="mono" style={{ fontWeight: 700, fontSize: 20, color: "var(--mp-navy)" }}>{nzd(row.quote.amountNZD)}</div>
      </div>

      <p style={{ lineHeight: 1.6, marginTop: 10 }}>{row.quote.message}</p>

      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 6, fontSize: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--mp-border)" }}>
        <span className="mp-muted">Email</span><span className="mono">{t?.email}</span>
        <span className="mp-muted">Phone</span><span className="mono">{t?.phone}</span>
      </div>

      {/* review */}
      {canReview && (
        row.reviewed ? (
          <div className="mp-badge mp-badge-green" style={{ marginTop: 12 }}>✓ Reviewed</div>
        ) : open ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--mp-border)" }}>
            <div className="mp-label">Your rating</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Star size={26} fill={n <= rating ? "var(--mp-orange)" : "none"} color={n <= rating ? "var(--mp-orange)" : "var(--mp-border)"} />
                </button>
              ))}
            </div>
            <textarea className="mp-textarea" placeholder="How did the job go?" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 80 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button className="mp-btn" disabled={busy} onClick={submitReview}>{busy ? "Saving…" : "Submit review"}</button>
              <button className="mp-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="mp-btn mp-btn-secondary" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Rate this tradesman</button>
        )
      )}
    </div>
  );
}
