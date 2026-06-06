"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Choose a new password
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Must be at least 8 characters.
          </p>

          {error && (
            <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="label">New password</label>
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
              className="btn-primary w-full justify-center py-3"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Updating…" : <>Set new password <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
