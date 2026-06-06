"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl cursor-pointer" style={{ color: "var(--brand)" }}>
            RoiQ
          </Link>
        </div>
        <div className="rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {!sent ? (
            <>
              <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Reset password</h1>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Enter your email and we&apos;ll send a reset link.</p>
              {error && (
                <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">Email address</label>
                  <input id="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3" style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Sending…" : <><span>Send reset link</span> <ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--success-bg)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17L4 12" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Check your email</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>We sent a reset link to <strong>{email}</strong>.</p>
            </div>
          )}
          <Link href="/login" className="flex items-center gap-1.5 justify-center mt-6 text-sm cursor-pointer hover:underline" style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
