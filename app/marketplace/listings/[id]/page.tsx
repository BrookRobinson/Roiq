"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { categoryById, bodyById, jobTitle } from "@/lib/marketplace/constants";
import { timeAgo, nzd, stars, initials } from "@/lib/marketplace/format";
import type { Job, HomeownerPublic, Quote } from "@/lib/marketplace/types";

interface Detail {
  role: string;
  job: Job;
  requiredBodies: string[];
  qualified: boolean;
  alreadyQuoted: boolean;
  myQuote: Quote | null;
  homeowner: HomeownerPublic | null;
  quoteCount: number;
  myContact: { email: string; phone: string };
}

export default function TradesmanJobDetail() {
  const id = String(useParams().id);
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketplace/jobs/${id}`);
    const data = await res.json();
    if (data.role === "owner") { router.replace(`/marketplace/jobs/${id}`); return; }
    setD(data);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (!d || !d.job) return <div className="mp-container mp-muted">Loading…</div>;
  const { job } = d;
  const cat = categoryById(job.category);
  const quoted = d.alreadyQuoted;
  const amountNum = parseInt(amount.replace(/[^\d]/g, ""), 10) || 0;
  const canSubmit = amountNum > 0 && message.trim().length > 0 && !busy;

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/marketplace/jobs/${id}/quotes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountNZD: amountNum, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error === "already_quoted" ? "You've already quoted on this job." : data.error === "not_qualified" ? "You're not qualified for this trade." : "Could not submit the quote."); setBusy(false); return; }
      await load(); // refetch → homeowner contact now revealed
    } catch { setError("Network error."); setBusy(false); }
  }

  return (
    <div className="mp-container">
      <Link href="/marketplace/listings" className="mp-back">← All jobs</Link>

      {/* photo banner */}
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--mp-border)", marginBottom: 16, background: "#e9eef3", height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {job.photos[0]
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={job.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div className="mp-muted" style={{ fontSize: 40 }}>{cat?.emoji}</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="mp-badge">{cat?.emoji} {cat?.name}</span>
        {job.urgent && <span className="mp-badge mp-badge-urgent">Urgent</span>}
        <span className="mp-muted" style={{ fontSize: 13 }}>{timeAgo(job.createdAt)}</span>
      </div>
      <h1 className="mp-h1">{jobTitle(job.category, job.description)}</h1>
      <div className="mp-muted" style={{ marginTop: 4, marginBottom: 16 }}>📍 {job.suburb}</div>

      <div className="mp-card mp-card-pad" style={{ marginBottom: 16 }}>
        <div className="mp-label">The job</div>
        <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{job.description}</p>
        <div className="mp-muted" style={{ fontSize: 14, marginTop: 12 }}>📍 {job.address}</div>
      </div>

      {/* homeowner contact card */}
      <div className="mp-orange-card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: "var(--mp-navy)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          {!quoted && <Lock size={14} />} {quoted ? "Homeowner contact" : "Contact details revealed when you submit a quote"}
        </div>
        <div className="mp-row" style={{ marginBottom: 12 }}>
          <div className="mp-avatar">{initials(d.homeowner?.name ?? "H")}</div>
          <div>
            <div style={{ fontWeight: 600 }}>{d.homeowner?.name ?? "Homeowner"} <span className="mp-badge mp-badge-green" style={{ marginLeft: 4 }}>Verified homeowner</span></div>
            {(d.homeowner?.jobCount ?? 0) > 0 && (
              <div className="mp-muted" style={{ fontSize: 13 }}>
                <span style={{ color: "var(--mp-orange)" }}>{stars(d.homeowner!.avgRating)}</span> · {d.homeowner!.jobCount} job{d.homeowner!.jobCount === 1 ? "" : "s"} posted
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 6, fontSize: 15 }}>
          <span className="mp-muted">Email</span><span className="mono">{quoted ? d.homeowner?.email : "••••••••@••••••"}</span>
          <span className="mp-muted">Phone</span><span className="mono">{quoted ? d.homeowner?.phone : "••• ••• •••"}</span>
        </div>
      </div>

      {/* required qualifications */}
      {d.requiredBodies.length > 0 && (
        <div className="mp-card mp-card-pad" style={{ marginBottom: 16 }}>
          <div className="mp-label">Required qualifications</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {d.requiredBodies.map((b) => (
              <span key={b} className="mp-badge mp-badge-grey" title={bodyById(b)?.name}>{bodyById(b)?.short ?? b}</span>
            ))}
          </div>
        </div>
      )}

      {error && <div className="mp-orange-card" style={{ marginBottom: 16, color: "var(--mp-orange)" }}>{error}</div>}

      {/* quote form OR submitted state */}
      {quoted ? (
        <div className="mp-card mp-card-pad" style={{ borderColor: "rgba(5,150,105,0.4)", background: "rgba(5,150,105,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#047857", fontWeight: 700 }}>
            <CheckCircle2 size={18} /> Quote submitted{d.myQuote ? ` — ${nzd(d.myQuote.amountNZD)}` : ""}
          </div>
          <p className="mp-muted" style={{ fontSize: 14, marginTop: 6 }}>
            The homeowner has been notified. They can now see your contact details.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 6, fontSize: 14, marginTop: 10 }}>
            <span className="mp-muted">Your email</span><span className="mono">{d.myContact.email}</span>
            <span className="mp-muted">Your phone</span><span className="mono">{d.myContact.phone}</span>
          </div>
        </div>
      ) : (
        <div className="mp-card mp-card-pad">
          <div className="mp-h2" style={{ marginBottom: 12 }}>Submit your quote</div>
          <label className="mp-label">Your price (NZD)</label>
          <input className="mp-input" inputMode="numeric" placeholder="13500" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "") ? Number(e.target.value.replace(/[^\d]/g, "")).toLocaleString("en-NZ") : "")} />
          <label className="mp-label" style={{ marginTop: 14 }}>Message to the homeowner</label>
          <textarea className="mp-textarea" placeholder="Outline what's included, your timeline, and anything they should know." value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="mp-muted" style={{ fontSize: 13, marginTop: 8 }}>Your email and phone will be shared with the homeowner on submission.</p>
          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button className="mp-btn" disabled={!canSubmit} onClick={submit}>
              {busy ? "Submitting…" : `Submit quote${amountNum > 0 ? ` — ${nzd(amountNum)}` : ""}`}
            </button>
            <button className="mp-btn-ghost" onClick={() => router.push("/marketplace/listings")}>Not interested</button>
          </div>
        </div>
      )}
    </div>
  );
}
