"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, Clock } from "lucide-react";
import { TRADE_CATEGORIES, TRADE_BODIES } from "@/lib/marketplace/constants";

export default function VerifyPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [entity, setEntity] = useState<"sole" | "company">("sole");
  const [businessName, setBusinessName] = useState("");
  const [nzbn, setNzbn] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [bodies, setBodies] = useState<string[]>([]);
  const [regFile, setRegFile] = useState<string | null>(null);
  const [qualFile, setQualFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const regRef = useRef<HTMLInputElement>(null);
  const qualRef = useRef<HTMLInputElement>(null);

  // If the current tradesman is already verified, no need to be here.
  useEffect(() => {
    fetch("/api/marketplace/verify").then((r) => r.json()).then((d) => {
      if (d.role !== "TRADESMAN") return;
      if (d.tdVerified) router.replace("/marketplace/listings");
      else if (d.verification?.status === "PENDING") setStep(3);
    }).catch(() => {});
  }, [router]);

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const step1ok = businessName.trim() && nzbn.trim() && categories.length > 0;
  const step2ok = regFile && qualFile;

  async function submit() {
    setBusy(true);
    await fetch("/api/marketplace/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName, nzbn, categories, tradeBodies: bodies,
        businessRegUrl: `uploaded://${regFile}`, qualificationUrl: `uploaded://${qualFile}`,
      }),
    });
    setBusy(false);
    setStep(3);
  }

  return (
    <div className="mp-container" style={{ maxWidth: 640 }}>
      <Link href="/dashboard" className="mp-back">← Dashboard</Link>
      <h1 className="mp-h1">Get verified</h1>
      <p className="mp-muted" style={{ marginTop: 6, marginBottom: 18 }}>Only verified tradesmen can browse and quote on jobs.</p>

      {/* progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {[1, 2, 3].map((n) => (
          <div key={n} className="mp-progress-track" style={{ flex: 1 }}>
            <div className="mp-progress-fill" style={{ width: step >= n ? "100%" : "0%" }} />
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="mp-card mp-card-pad">
          <h2 className="mp-h2" style={{ marginBottom: 14 }}>Business details</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["sole", "company"] as const).map((e) => (
              <button key={e} className={`mp-pill ${entity === e ? "mp-pill-active" : ""}`} onClick={() => setEntity(e)} style={{ flex: 1, justifyContent: "center" }}>
                {e === "sole" ? "Sole trader" : "Company"}
              </button>
            ))}
          </div>

          <label className="mp-label">Business name</label>
          <input className="mp-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Canterbury Roofing & Exteriors" />

          <label className="mp-label" style={{ marginTop: 14 }}>NZBN</label>
          <input className="mp-input" value={nzbn} onChange={(e) => setNzbn(e.target.value.replace(/[^\d]/g, ""))} placeholder="13-digit NZ Business Number" />

          <label className="mp-label" style={{ marginTop: 16 }}>Trades you work in</label>
          <div className="mp-grid-2">
            {TRADE_CATEGORIES.map((c) => {
              const on = categories.includes(c.id);
              return (
                <button key={c.id} onClick={() => setCategories((a) => toggle(a, c.id))} className="mp-card" style={{ padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderColor: on ? "var(--mp-orange)" : "var(--mp-border)", background: on ? "var(--mp-orange-soft)" : "#fff" }}>
                  <span style={{ fontSize: 18 }}>{c.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: on ? 600 : 400 }}>{c.name}</span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
            <button className="mp-btn" disabled={!step1ok} onClick={() => setStep(2)}>Continue →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mp-card mp-card-pad">
          <h2 className="mp-h2" style={{ marginBottom: 14 }}>Upload credentials</h2>

          <UploadCard title="Business registration" sub="Companies Office certificate or sole-trader registration" file={regFile} onPick={() => regRef.current?.click()} />
          <input ref={regRef} type="file" style={{ display: "none" }} onChange={(e) => setRegFile(e.target.files?.[0]?.name ?? null)} />

          <div style={{ height: 12 }} />
          <UploadCard title="Trade qualification / licence" sub="LBP card, EWRB, PGDB registration, etc." file={qualFile} onPick={() => qualRef.current?.click()} />
          <input ref={qualRef} type="file" style={{ display: "none" }} onChange={(e) => setQualFile(e.target.files?.[0]?.name ?? null)} />

          <label className="mp-label" style={{ marginTop: 18 }}>Trade body memberships</label>
          <div style={{ display: "grid", gap: 6 }}>
            <button onClick={() => setBodies([])} className="mp-card" style={{ padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderColor: bodies.length === 0 ? "var(--mp-orange)" : "var(--mp-border)" }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid var(--mp-border)", background: bodies.length === 0 ? "var(--mp-orange)" : "#fff", flexShrink: 0 }} />
              <span style={{ fontSize: 14 }}>None applicable</span>
            </button>
            {TRADE_BODIES.map((b) => {
              const on = bodies.includes(b.id);
              return (
                <button key={b.id} onClick={() => setBodies((a) => toggle(a, b.id))} className="mp-card" style={{ padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderColor: on ? "var(--mp-orange)" : "var(--mp-border)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid var(--mp-border)", background: on ? "var(--mp-orange)" : "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>{on ? "✓" : ""}</span>
                  <span style={{ fontSize: 14 }}><b>{b.short}</b> · <span className="mp-muted">{b.name}</span></span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between" }}>
            <button className="mp-btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="mp-btn" disabled={!step2ok || busy} onClick={submit}>{busy ? "Submitting…" : "Submit for review"}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mp-card mp-card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>⏳</div>
          <h2 className="mp-h2" style={{ marginTop: 8 }}>Application submitted</h2>
          <p className="mp-muted" style={{ marginTop: 6, marginBottom: 18 }}>Our team will review within 1–2 business days.</p>
          <div style={{ display: "grid", gap: 8, textAlign: "left" }}>
            {[["Business registration", regFile], ["Trade qualification", qualFile], ["Trade bodies", bodies.length ? `${bodies.length} selected` : "None"]].map(([label]) => (
              <div key={label as string} className="mp-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14 }}>{label}</span>
                <span className="mp-badge mp-badge-amber"><Clock size={11} /> Under review</span>
              </div>
            ))}
          </div>
          <Link href="/dashboard" className="mp-btn" style={{ marginTop: 18, textDecoration: "none", display: "inline-flex" }}>Back to dashboard</Link>
        </div>
      )}
    </div>
  );
}

function UploadCard({ title, sub, file, onPick }: { title: string; sub: string; file: string | null; onPick: () => void }) {
  return (
    <div onClick={onPick} className="mp-card" style={{ padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, borderStyle: file ? "solid" : "dashed", borderColor: file ? "rgba(5,150,105,0.5)" : "var(--mp-border)" }}>
      {file ? <CheckCircle2 size={22} style={{ color: "#047857", flexShrink: 0 }} /> : <Upload size={22} style={{ color: "var(--mp-orange)", flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="mp-muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file ? `Uploaded · ${file}` : sub}</div>
      </div>
    </div>
  );
}
