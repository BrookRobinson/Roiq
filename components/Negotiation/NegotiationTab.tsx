"use client";

// ============================================================
// "For the agent" tab — preview the document, then send it.
//
// The link the agent opens carries ONLY this document. It deliberately does not
// carry the rest of the report: the Financial tab holds the buyer's deposit,
// their hold period and what they'd actually pay, and handing the vendor's agent
// the buyer's walk-away price would be the opposite of helpful.
// ============================================================

import { useMemo, useState } from "react";
import { Check, Copy, Loader2, Mail, Printer, Send } from "lucide-react";

import { buildNegotiationCase } from "@/lib/negotiation/build";
import { NegotiationLetter } from "./NegotiationLetter";
import type { StoredReport } from "@/lib/report-store";

export function NegotiationTab({ report }: { report: StoredReport }) {
  const data = useMemo(() => buildNegotiationCase(report), [report]);

  const [preparedBy, setPreparedBy] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const items = data.critical.length + data.urgent.length + data.remedies.length;

  async function send() {
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/report/negotiation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case: data,
          preparedBy: preparedBy.trim() || undefined,
          note: note.trim() || undefined,
          recipientEmail: email.trim() || undefined,
        }),
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
      if (email.trim() && !j.emailed) {
        setMessage(j.emailError ?? "Couldn't send the email, but the link below works — copy and send it yourself.");
      }
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
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  }

  return (
    <div className="space-y-6">
      {/* What this is */}
      <div className="card p-5">
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Send the findings to the agent
        </h2>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Everything graded critical or urgent, with the evidence behind each finding and what it costs to
          put right. Nothing here is added or embellished — it&rsquo;s the report&rsquo;s own findings, laid
          out as a document you can put in front of a vendor.
        </p>
        <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
          The agent sees only this page. Your deposit, hold period and the numbers on the Financial tab are
          never included.
        </p>
      </div>

      {items === 0 ? (
        <div className="card p-5">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Nothing was graded critical or urgent on this property.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            You can still send the document — it will state plainly that no remedial work is being put
            forward, which is a fair thing to say and better than reaching for an argument that isn&rsquo;t
            there.
          </p>
        </div>
      ) : null}

      {/* Compose */}
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="neg-name">
              Your name <span style={{ color: "var(--text-muted)" }}>· optional</span>
            </label>
            <input
              id="neg-name"
              className="input"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Who the letter is from"
            />
          </div>
          <div>
            <label className="label" htmlFor="neg-email">
              Agent&rsquo;s email address
            </label>
            <input
              id="neg-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@agency.co.nz"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="neg-note">
            Covering note <span style={{ color: "var(--text-muted)" }}>· optional, appears in the letter</span>
          </label>
          <textarea
            id="neg-note"
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. We remain interested in the property and would like to discuss the asking price in light of the findings below."
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={send} disabled={status === "sending"} className="btn-primary gap-2 px-4 py-2 text-sm">
            {status === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {email.trim() ? "Send to agent" : "Create link"}
          </button>
          <button onClick={() => window.print()} className="btn-secondary gap-2 px-4 py-2 text-sm">
            <Printer size={14} /> Print or save as PDF
          </button>
        </div>

        {status === "done" && url && (
          <div className="mt-4 p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {emailed ? <Mail size={14} /> : <Check size={14} />}
              {emailed ? `Sent to ${email.trim()}` : "Link ready"}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="mono flex-1 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                {url}
              </code>
              <button onClick={copyLink} className="btn-secondary gap-1.5 px-3 py-1.5 text-xs">
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-3 text-[13px]" style={{ color: status === "error" ? "var(--bad)" : "var(--text-muted)" }}>
            {message}
          </p>
        )}
      </div>

      {/* Live preview of exactly what they'll receive */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          What the agent will see
        </p>
        <NegotiationLetter data={data} preparedBy={preparedBy} note={note} />
      </div>
    </div>
  );
}
