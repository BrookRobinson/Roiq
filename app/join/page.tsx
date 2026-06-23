"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { saveAccount } from "@/lib/account/account";

const PERKS = [
  "3 property reports every month",
  "Post unlimited jobs to the Renovation Marketplace",
  "No credit card required",
];

function JoinInner() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const valid = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    saveAccount(name, email);
    router.replace(next);
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px" }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 28 }}>
        <span style={{ fontWeight: 700, fontSize: 22, color: "var(--brand)" }}>RoiQ</span>
      </Link>

      <div className="card" style={{ width: "100%", maxWidth: 460, padding: 28 }}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Create your free account</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          You&apos;ll need a free account to run a property report or post a job. Takes 10 seconds — no credit card.
        </p>

        {/* free perks */}
        <div className="mt-5 mb-5 rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {PERKS.map((p, i) => (
            <div key={p} className="flex items-center gap-2" style={{ marginTop: i ? 8 : 0 }}>
              <Check size={15} style={{ color: "var(--green)", flexShrink: 0 }} />
              <span className="text-sm" style={{ color: i === 2 ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: i === 2 ? 600 : 400 }}>{p}</span>
            </div>
          ))}
        </div>

        <form onSubmit={submit}>
          <label className="label text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Name</label>
          <input className="input mt-1 mb-4" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Email</label>
          <input className="input mt-1 mb-5" type="email" placeholder="you@example.co.nz" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn-primary w-full justify-center py-3" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>
            Create free account <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
          Free plan. Upgrade any time for more reports — that&apos;s the only time you add a card.
        </p>
      </div>

      <p className="text-sm mt-5" style={{ color: "var(--text-secondary)" }}>
        Already have an account? <Link href="/login" style={{ color: "var(--brand)", fontWeight: 600 }}>Log in</Link>
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ background: "var(--bg)", minHeight: "100vh" }} />}>
      <JoinInner />
    </Suspense>
  );
}
