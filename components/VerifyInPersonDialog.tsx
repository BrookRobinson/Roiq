"use client";

// ============================================================
// "Get this report verified in person."
//
// A buyer who likes a property asks for a building inspection. The request goes
// to the partner inspector covering that region with a link to this report; the
// buyer pays the inspector as normal and the inspector pays Tectara for the
// lead. Rules and wording: lib/inspections/referral.ts.
// ============================================================

import { useState } from "react";
import { X, HardHat, Loader2, Check, AlertTriangle } from "lucide-react";
import type { StoredReport } from "@/lib/report-store";
import { useSession } from "@/lib/auth/session";
import { CONSENT_TEXT, FEE_DISCLOSURE, isEmail } from "@/lib/inspections/referral";

export function VerifyInPersonDialog({ report, onClose }: { report: StoredReport; onClose: () => void }) {
  const { user } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ assigned: boolean; inspectorName: string | null; already?: boolean } | null>(null);

  const address = report.listing.address ?? "this property";
  const ready = name.trim() && isEmail(email) && consent;

  async function submit() {
    if (!ready) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/inspection-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, name, email, phone, message, consent }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setStatus("error");
        setError(j?.error ?? "Something went wrong sending your request.");
        return;
      }
      setResult({ assigned: !!j.assigned, inspectorName: j.inspectorName ?? null, already: !!j.already });
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  const field = "w-full rounded-lg px-3 py-2 text-sm outline-none mb-3";
  const fieldStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" };
  const label = "block text-xs font-medium mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Get this report verified in person"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <HardHat size={16} style={{ color: "var(--brand)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Get this report verified in person</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:opacity-70" style={{ color: "var(--text-muted)" }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {status !== "done" ? (
            <>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
                A qualified building inspector checks <span style={{ color: "var(--text-secondary)" }}>{address}</span> in
                person, with this report in hand. We send your details to our partner inspector for the area and they
                contact you to arrange a time and price.
              </p>

              <label className={label} style={{ color: "var(--text-secondary)" }}>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={field} style={fieldStyle} />

              <label className={label} style={{ color: "var(--text-secondary)" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} style={fieldStyle} />

              <label className={label} style={{ color: "var(--text-secondary)" }}>
                Phone <span style={{ color: "var(--text-muted)" }}>(optional, but faster)</span>
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={field} style={fieldStyle} />

              <label className={label} style={{ color: "var(--text-secondary)" }}>
                Anything the inspector should know <span style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="e.g. auction on Saturday, worried about the roof"
                className={`${field} resize-none`}
                style={fieldStyle}
              />

              <label className="flex items-start gap-2.5 text-xs mb-3 cursor-pointer" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 cursor-pointer flex-shrink-0" />
                <span>{CONSENT_TEXT}</span>
              </label>

              <p className="text-[11px] mb-4 rounded-lg px-3 py-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)", lineHeight: 1.5 }}>
                {FEE_DISCLOSURE}
              </p>

              {status === "error" && error && (
                <div className="flex items-start gap-2 text-xs mb-3 rounded-lg px-3 py-2" style={{ background: "var(--bad-wash)", color: "var(--bad)" }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              <button
                onClick={submit}
                disabled={!ready || status === "sending"}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: "var(--brand)", color: "var(--on-accent)" }}
              >
                {status === "sending" ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><HardHat size={15} /> Request an inspection</>}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-sm mb-4 rounded-lg px-3 py-3" style={{ background: "var(--good-wash)", color: "var(--good)" }}>
                <Check size={16} className="mt-0.5 shrink-0" />
                <span>
                  {result?.already
                    ? "You've already asked for an inspection on this property — the inspector has your details."
                    : result?.assigned
                      ? `Sent to ${result.inspectorName ?? "our partner inspector"}. They'll contact you to arrange a time and price.`
                      : "Request received. We'll connect you with a building inspector for this area and they'll be in touch."}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
