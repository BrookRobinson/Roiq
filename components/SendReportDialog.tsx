"use client";

import { useState } from "react";
import { X, Send, Copy, Check, Link2, Loader2, Mail, AlertTriangle } from "lucide-react";
import type { StoredReport } from "@/lib/report-store";

/**
 * "Send report" dialog. Creates a shareable snapshot of the current report on
 * the server, shows a copyable link, and can optionally email that link to
 * someone. The link is the primary deliverable; email is a convenience that
 * needs RESEND_API_KEY configured server-side.
 */
export function SendReportDialog({
  report,
  onClose,
}: {
  report: StoredReport;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/report/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, recipientEmail: email.trim() || undefined, note: note.trim() || undefined }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setStatus("error");
        setMessage(j?.error ?? "Something went wrong creating the link.");
        return;
      }
      setUrl(j.url);
      setEmailed(Boolean(j.emailed));
      setStatus("done");
      // If email was requested but couldn't send, surface why (link still works).
      if (email.trim() && !j.emailed) setMessage(j.emailError ?? "Couldn't send the email, but the link below works.");
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Please try again.");
    }
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the link is visible for manual copy */
    }
  }

  const address = report.listing.address ?? "this property";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Send size={16} style={{ color: "var(--brand)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Send this report</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:opacity-70" style={{ color: "var(--text-muted)" }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Share your analysis of <span style={{ color: "var(--text-secondary)" }}>{address}</span>. Anyone with the link can
            view the full report — no account needed.
          </p>

          {status !== "done" ? (
            <>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Email it to someone <span style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3"
                   style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <Mail size={14} style={{ color: "var(--text-muted)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>

              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Add a note <span style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Thought you'd want to see this one…"
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none mb-4"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />

              {status === "error" && message && (
                <div className="flex items-start gap-2 text-xs mb-3 rounded-lg px-3 py-2"
                     style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{message}</span>
                </div>
              )}

              <button
                onClick={submit}
                disabled={status === "sending"}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
                style={{ background: "var(--brand)", color: "var(--on-accent)" }}
              >
                {status === "sending" ? <><Loader2 size={15} className="animate-spin" /> Creating link…</>
                  : email.trim() ? <><Send size={15} /> Send report</>
                  : <><Link2 size={15} /> Create shareable link</>}
              </button>
            </>
          ) : (
            <>
              {emailed && (
                <div className="flex items-center gap-2 text-xs mb-3 rounded-lg px-3 py-2"
                     style={{ background: "rgba(16,185,129,0.10)", color: "var(--success, #10b981)" }}>
                  <Check size={14} /> Sent to {email.trim()}.
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2 text-xs mb-3 rounded-lg px-3 py-2"
                     style={{ background: "rgba(245,158,11,0.10)", color: "#f59e0b" }}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{message}</span>
                </div>
              )}

              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Shareable link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={url ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                  style={{ background: copied ? "var(--success)" : "var(--brand)", color: copied ? "#fff" : "var(--on-accent)" }}
                >
                  {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                This link stays live for 60 days.
              </p>

              <button
                onClick={onClose}
                className="w-full mt-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
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
