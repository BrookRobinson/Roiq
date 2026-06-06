"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/app/layout";
import { Sun, Moon, Menu, X, BarChart3, Map, Home, User } from "lucide-react";

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

  const planStyles: Record<string, string> = {
    free:    "bg-[var(--surface-2)] text-[var(--text-muted)]",
    starter: "bg-[var(--brand-light)] text-[var(--brand)]",
    pro:     "bg-[rgba(0,230,118,0.12)] text-[var(--green)]",
  };

  const navLinks = user
    ? [
        { href: "/dashboard",      label: "Dashboard",  icon: Home      },
        { href: "/report/new",     label: "New Report", icon: BarChart3 },
        ...(plan === "pro"
          ? [{ href: "/map",       label: "Map",        icon: Map       }]
          : [{ href: "/pricing",   label: "Upgrade",    icon: User      }]),
        { href: "/account",        label: "Account",    icon: User      },
      ]
    : [
        { href: "/pricing", label: "Pricing" },
        { href: "/about",   label: "About"   },
      ];

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{
        background: "var(--glass-bg)",
        borderBottom: "1px solid var(--glass-border)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-xl cursor-pointer group"
            style={{ color: "var(--brand)" }}
          >
            <LogoIcon />
            <span className="tracking-tight" style={{ letterSpacing: "-0.02em" }}>RoiQ</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                  style={{
                    color: active ? "var(--brand)" : "var(--text-muted)",
                    background: active ? "var(--brand-light)" : "transparent",
                    boxShadow: active ? "0 0 12px var(--brand-glow)" : "none",
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {user ? (
              <div className="hidden md:flex items-center gap-2">
                {plan && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${planStyles[plan]}`}>
                    {plan}
                  </span>
                )}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "var(--brand-light)",
                    border: "1.5px solid var(--brand)",
                    color: "var(--brand)",
                    boxShadow: "0 0 8px var(--brand-glow)",
                  }}
                >
                  {user.email[0].toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login"  className="btn-secondary text-sm py-2 px-4">Log in</Link>
                <Link href="/signup" className="btn-primary  text-sm py-2 px-4">Get started</Link>
              </div>
            )}

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t px-4 py-4 space-y-1"
          style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        >
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
              style={{ color: "var(--text-primary)" }}
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {!user && (
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login"  className="btn-secondary justify-center">Log in</Link>
              <Link href="/signup" className="btn-primary  justify-center">Get started</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function LogoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="currentColor" opacity="0.15" />
      <path
        d="M7 20L11 14L14 17L18 10L21 14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}
