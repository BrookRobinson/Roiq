"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "free";

  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const planLabels: Record<string, { name: string; price: string; color: string }> = {
    free: { name: "Free", price: "$0", color: "#6b7280" },
    starter: { name: "Starter", price: "$49 once", color: "#3b82f6" },
    pro: { name: "Pro", price: "$99 once", color: "#f59e0b" },
  };
  const planInfo = planLabels[plan] ?? planLabels.free;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: { plan },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    // After email confirmation the callback will redirect to /auth/callback
    // which redirects to /dashboard. For Pro users we later redirect to /onboarding.
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--bg)" }}
      >
        <div className="w-full max-w-md text-center">
          <CheckCircle2 size={52} className="mx-auto mb-4" style={{ color: "var(--success)" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Check your email
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account and get started.
          </p>
          <Link href="/login" className="btn-secondary">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-bold text-2xl cursor-pointer"
            style={{ color: "var(--brand)" }}
          >
            <LogoIcon />
            RoiQ
          </Link>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Create your account
          </h1>

          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Plan:</span>
            <span
              className="text-sm font-semibold px-3 py-0.5 rounded-full"
              style={{ background: `${planInfo.color}18`, color: planInfo.color }}
            >
              {planInfo.name} — {planInfo.price}
            </span>
            <Link
              href="/pricing"
              className="text-xs cursor-pointer hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Change
            </Link>
          </div>

          {error && (
            <div
              className="rounded-lg p-3 mb-4 text-sm"
              style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  className="input pr-10"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  aria-label={show ? "Hide" : "Show"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base mt-2"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <><SpinnerIcon /> Creating account…</>
              ) : (
                <>Create account <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div
            className="mt-6 pt-6 space-y-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {[
              "No credit card required for Free plan",
              "Cancel or upgrade anytime",
              "Your data is private by default",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
                {f}
              </div>
            ))}
          </div>

          <p className="text-center text-sm mt-4" style={{ color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold cursor-pointer hover:underline"
              style={{ color: "var(--brand)" }}
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          By creating an account you agree to our{" "}
          <a href="/terms" className="underline cursor-pointer">Terms</a> and{" "}
          <a href="/privacy" className="underline cursor-pointer">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="currentColor" opacity="0.15" />
      <path d="M7 20L11 14L14 17L18 10L21 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
