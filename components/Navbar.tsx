"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/lib/theme/context";
import { Wordmark } from "@/components/ui/Wordmark";
import { Sun, Moon, Menu, X } from "lucide-react";

/**
 * Navigation IA is unchanged from the previous build: same routes, same
 * labels, same signed-in/signed-out split. Only the visual language moved.
 *
 * A single rule under the bar replaces the frosted-glass panel, and the
 * active item is marked with an underline rather than a filled pill.
 */
export default function Navbar({
  user,
  plan,
}: {
  user?: { email: string } | null;
  plan?: "free" | "starter" | "pro";
}) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/report/new", label: "New report" },
        ...(plan === "pro"
          ? [{ href: "/map", label: "Map" }]
          : [{ href: "/pricing", label: "Upgrade" }]),
        { href: "/account", label: "Account" },
      ]
    : [
        { href: "/pricing", label: "Pricing" },
        { href: "/about", label: "About" },
      ];

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{
        background: "var(--glass-bg)",
        borderBottom: "1px solid var(--rule)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <div className="flex h-[68px] items-center justify-between">
          <Link
            href="/"
            className="cursor-pointer"
            style={{ color: "var(--text-primary)" }}
            aria-label="BDR Report home"
          >
            <Wordmark />
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="cursor-pointer py-1 text-sm transition-colors"
                  style={{
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: active ? 600 : 400,
                    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
              className="flex h-9 w-9 cursor-pointer items-center justify-center transition-colors"
              style={{
                border: "1px solid var(--rule)",
                color: "var(--text-secondary)",
              }}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {user ? (
              <div className="hidden items-center gap-2.5 md:flex">
                {plan && (
                  <span className="badge badge-blue">{plan}</span>
                )}
                <div
                  className="mono flex h-9 w-9 items-center justify-center text-sm font-medium"
                  style={{
                    border: "1px solid var(--rule-strong)",
                    color: "var(--text-primary)",
                  }}
                  aria-label={user.email}
                >
                  {user.email[0].toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link href="/login" className="btn-secondary px-4 py-2 text-sm">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary px-4 py-2 text-sm">
                  Get started
                </Link>
              </div>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center md:hidden"
              style={{
                border: "1px solid var(--rule)",
                color: "var(--text-primary)",
              }}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="space-y-1 border-t px-4 py-4 md:hidden"
          style={{ borderColor: "var(--rule)", background: "var(--bg)" }}
        >
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block cursor-pointer px-1 py-2.5 text-sm"
              style={{ color: "var(--text-primary)" }}
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {!user && (
            <div className="flex flex-col gap-2 pt-3">
              <Link href="/login" className="btn-secondary justify-center">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary justify-center">
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
