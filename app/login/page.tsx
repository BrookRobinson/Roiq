"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Eye, EyeOff, ArrowRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_NAME } from "@/lib/brand";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = next;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
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
            {PRODUCT_NAME}
          </Link>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Know before you buy.
          </p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Welcome back
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Log in to your {PRODUCT_NAME} account
          </p>

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
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label" style={{ marginBottom: 0 }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs cursor-pointer hover:underline"
                  style={{ color: "var(--brand)" }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <><SpinnerIcon /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold cursor-pointer hover:underline"
              style={{ color: "var(--brand)" }}
            >
              Sign up free
            </Link>
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          <Lock size={11} className="inline mr-1" />
          Secured by Supabase Auth.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
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
