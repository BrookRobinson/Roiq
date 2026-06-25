"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  ArrowRight, Shield, TrendingUp, Camera, Map, Calculator,
  Home, AlertTriangle, CheckCircle2, XCircle, Star,
  ChevronRight, BarChart3, Zap, Lock,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)" }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <HeroBackground />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-28 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div
              className="badge badge-teal mb-6 inline-flex"
              style={{ fontSize: 12, letterSpacing: "0.06em" }}
            >
              <Zap size={12} />
              AI-POWERED PROPERTY ANALYSIS · NEW ZEALAND
            </div>

            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6"
              style={{ color: "var(--text-primary)", lineHeight: 1.06, letterSpacing: "-0.035em" }}
            >
              Know before
              <br />
              <span
                style={{
                  color: "var(--brand)",
                  textShadow: "0 0 40px var(--brand-glow)",
                }}
              >
                you buy.
              </span>
            </h1>

            <p
              className="text-lg sm:text-xl max-w-2xl mx-auto mb-10"
              style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}
            >
              Paste any NZ listing URL. RoiQ analyses every photo with AI,
              pulls live market data, scores the property out of 1,000, and
              delivers a full investor or buyer report — in minutes.
            </p>

            <UrlHeroInput />

            <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
              Free for 3 reports/month · No credit card required
            </p>
          </div>

          {/* Stats strip */}
          <div
            className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--border)", background: "var(--border)" }}
          >
            {[
              { stat: "1,000", label: "Point quality score" },
              { stat: "6",     label: "Report tabs" },
              { stat: "24hr",  label: "NZ map refresh" },
              { stat: "90%",   label: "AI cost savings" },
            ].map((s) => (
              <div
                key={s.stat}
                className="text-center py-6 px-4"
                style={{ background: "var(--surface)" }}
              >
                <div
                  className="text-3xl font-bold mono mb-1"
                  style={{ color: "var(--brand)", textShadow: "0 0 16px var(--brand-glow)" }}
                >
                  {s.stat}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Report preview ─────────────────────────────────── */}
      <section className="py-24" style={{ background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-label">What you get</div>
          <h2 className="section-heading">A report agents don&apos;t want you to have</h2>
          <p className="section-sub">Every finding sourced. Every flag explained. The honest picture before you make an offer.</p>
          <ReportPreview />
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-label">Core features</div>
          <h2 className="section-heading">Everything in one report</h2>
          <p className="section-sub">Six analysis tabs covering every angle of a property decision.</p>
          <FeaturesGrid />
        </div>
      </section>

      {/* ── Map teaser ─────────────────────────────────────── */}
      <section className="py-24" style={{ background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="section-label">Pro feature</div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
                Find the best investment in NZ. Right now.
              </h2>
              <p className="text-lg mb-8" style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}>
                Every property currently for sale, colour-coded by opportunity score. Set your deposit, filter by yield, find deals the market hasn&apos;t priced in.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  "Live NZ-wide coverage — all portals scraped",
                  "10-year profit estimate on every pin",
                  "Filter by deposit, yield, suburb, type",
                  "Alert system for new high-score listings",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" style={{ color: "var(--green)" }} />
                    <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="btn-primary">
                Get Pro — $99/mo
                <ArrowRight size={16} />
              </Link>
            </div>
            <MapTeaser />
          </div>
        </div>
      </section>

      {/* ── Score explainer ────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-label">Scoring system</div>
          <h2 className="section-heading">1,000 points. Nothing hidden.</h2>
          <p className="section-sub">Six weighted categories. Every point justified by photo evidence or data. No black box.</p>
          <ScoreBreakdown />
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "var(--surface)" }} id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-label">Pricing</div>
          <h2 className="section-heading">Simple, honest pricing</h2>
          <p className="section-sub">No per-report charges. No hidden fees. Cancel anytime.</p>
          <PricingCards />
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-label">From users</div>
          <h2 className="section-heading">They knew before they bought</h2>
          <TestimonialsGrid />
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section
        className="py-28 relative overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        {/* glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/4 w-96 h-96 rounded-full -translate-y-1/2 blur-3xl opacity-10"
            style={{ background: "var(--brand)" }} />
          <div className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full -translate-y-1/2 blur-3xl opacity-10"
            style={{ background: "var(--green)" }} />
        </div>
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
            Your next offer.{" "}
            <span style={{ color: "var(--brand)", textShadow: "0 0 30px var(--brand-glow)" }}>
              Made with data.
            </span>
          </h2>
          <p className="text-lg mb-10" style={{ color: "var(--text-secondary)" }}>
            Start free. Get your first report in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="btn-primary text-lg px-8 py-3.5"
              style={{ boxShadow: "0 0 30px var(--brand-glow)" }}
            >
              Start free
              <ArrowRight size={20} />
            </Link>
            <Link
              href="/report/rpt_001"
              className="btn-secondary text-base px-8 py-3.5"
            >
              View sample report
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function UrlHeroInput() {
  return (
    <div className="max-w-2xl mx-auto">
      <div
        className="flex items-center gap-3 p-2.5 rounded-2xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 0 0 1px var(--glass-border), 0 16px 40px rgba(0,0,0,0.4)",
          transition: "box-shadow 0.2s",
        }}
        onFocus={() => {}}
      >
        <input
          className="flex-1 bg-transparent outline-none text-base px-3"
          style={{ color: "var(--text-primary)", fontFamily: "inherit" }}
          placeholder="Paste a Trade Me, realestate.co.nz or Ray White URL…"
          readOnly
          onClick={() => (window.location.href = "/report/new")}
        />
        <Link
          href="/report/new"
          className="btn-primary whitespace-nowrap"
          style={{ borderRadius: 11, padding: "10px 18px", boxShadow: "0 0 16px var(--brand-glow)" }}
        >
          Analyse
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* large ambient glows */}
      <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "var(--brand)" }} />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-3xl"
        style={{ background: "var(--green)" }} />
      {/* grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="var(--brand)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

function ReportPreview() {
  return (
    <div
      className="mt-12 rounded-2xl overflow-hidden"
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "0 0 0 1px var(--glass-border), 0 32px 80px rgba(0,0,0,0.5)",
      }}
    >
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-4 pt-4 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {["Overview", "Photos", "Renovations", "Financial", "Hazard", "Healthy Homes"].map((tab, i) => (
          <button
            key={tab}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer border-b-2 transition-all"
            style={{
              color: i === 0 ? "var(--brand)" : "var(--text-muted)",
              borderBottomColor: i === 0 ? "var(--brand)" : "transparent",
              textShadow: i === 0 ? "0 0 12px var(--brand-glow)" : "none",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 grid md:grid-cols-3 gap-6">
        {/* Score dial */}
        <div className="flex flex-col items-center justify-center">
          <ScoreDial score={724} />
          <div className="text-sm font-medium mt-2" style={{ color: "var(--text-secondary)" }}>Quality Score</div>
          <div className="text-3xl font-bold mono mt-1" style={{ color: "var(--text-primary)" }}>
            724<span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>/1,000</span>
          </div>
          <div className="badge badge-teal mt-2">Above average</div>
        </div>

        {/* Category scores */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>Category breakdown</h3>
          {[
            { label: "Structure & materials", score: 298, max: 400, color: "#00d4c8" },
            { label: "Location",              score: 165, max: 200, color: "#00e676" },
            { label: "Land",                  score: 110, max: 150, color: "#2dd4bf" },
            { label: "Legal / Title",         score: 70,  max: 100, color: "#fbbf24" },
            { label: "Financial",             score: 57,  max: 100, color: "#fb923c" },
            { label: "Liveability",           score: 24,  max: 50,  color: "#a78bfa" },
          ].map((c) => (
            <div key={c.label}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: "var(--text-secondary)" }}>{c.label}</span>
                <span className="mono font-semibold" style={{ color: c.color }}>{c.score}/{c.max}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${(c.score / c.max) * 100}%`, background: c.color, boxShadow: `0 0 6px ${c.color}88` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Key findings */}
        <div>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>Key findings</h3>
          <div className="space-y-2">
            {[
              { type: "positive", text: "Freehold title confirmed" },
              { type: "positive", text: "Heat pump: main living area" },
              { type: "positive", text: "Double-glazed throughout" },
              { type: "warning",  text: "Roof: iron shows surface rust" },
              { type: "warning",  text: "Cross-slope section limits extension" },
              { type: "negative", text: "No ceiling insulation visible" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {f.type === "positive"
                  ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--green)" }} />
                  : f.type === "warning"
                  ? <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warning)" }} />
                  : <XCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--danger)" }} />}
                <span style={{ color: "var(--text-secondary)" }}>{f.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--text-secondary)" }}>VFM Grade</span>
              <span className="text-2xl font-bold grade-b-plus mono">B+</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span style={{ color: "var(--text-secondary)" }}>Est. gross yield</span>
              <span className="mono font-semibold" style={{ color: "var(--green)" }}>4.8%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 text-xs border-t" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg)" }}>
        AI-generated analysis of publicly available listing data. Not a registered valuation or building inspection.
      </div>
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 1000);
  const color = score >= 750 ? "#00e676" : score >= 600 ? "#00d4c8" : score >= 450 ? "#fbbf24" : "#ff5f5f";
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
      />
      <text x="60" y="56" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text-primary)" fontFamily="Fira Code">{score}</text>
      <text x="60" y="72" textAnchor="middle" fontSize="11" fill="var(--text-muted)" fontFamily="Fira Code">/1,000</text>
    </svg>
  );
}

function FeaturesGrid() {
  const features = [
    { icon: Camera,      title: "AI photo analysis",       desc: "Every photo scored with confidence tiers. Materials identified, defects flagged. Tier 1 findings stated as fact.",                    color: "#00d4c8" },
    { icon: BarChart3,   title: "1,000-point score",        desc: "Six weighted categories: structure, location, land, legal, financial, liveability. Every point justified.",                          color: "#00e676" },
    { icon: Calculator,  title: "Financial calculator",     desc: "Buyer and investor modes. P&I vs IO. Equity timeline with renovation costs overlaid. 10-year cashflow.",                              color: "#2dd4bf" },
    { icon: Home,        title: "Renovation planner",       desc: "Toggle renovations on/off. Size-dependent costs with full working. Patch vs replace. Rent uplift per item.",                          color: "#a78bfa" },
    { icon: Shield,      title: "Healthy Homes checker",    desc: "Five standards assessed per build era and photo evidence. Remediation costs. Fine risk up to $7,200 per breach.",                     color: "#fbbf24" },
    { icon: AlertTriangle,title: "Hazard report",           desc: "TC zones, FENZ flood zones, coastal designations, alpine fault proximity. Street-specific, sourced findings only.",                   color: "#fb923c" },
    { icon: TrendingUp,  title: "Market comparables",       desc: "Recent sales of comparable properties. Price vs suburb benchmark. Days on market signal. VFM grade A+ to F.",                         color: "#38bdf8" },
    { icon: Map,         title: "NZ investment map",        desc: "Every active listing colour-coded by opportunity score. Filter by deposit, yield, suburb. 10-year profit on every pin.",              color: "#00e676", badge: "Pro" },
    { icon: Lock,        title: "Private shareable links",  desc: "Share your report via private token URL. Download as PDF. Email directly. Save to your dashboard.",                                   color: "#6b7280" },
  ];

  return (
    <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((f) => (
        <div
          key={f.title}
          className="card p-6 cursor-pointer"
          style={{ transition: "all 0.2s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: `${f.color}14`, border: `1px solid ${f.color}22` }}>
            <f.icon size={19} style={{ color: f.color }} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
            {f.badge && <span className="badge badge-green text-xs">{f.badge}</span>}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
        </div>
      ))}
    </div>
  );
}

function MapTeaser() {
  const pins = [
    { x: 30, y: 35, grade: "A+", color: "#00e676",  price: "$645k",   yld: "5.8%" },
    { x: 55, y: 25, grade: "B+", color: "#00d4c8",  price: "$820k",   yld: "4.2%" },
    { x: 45, y: 55, grade: "A",  color: "#2dd4bf",  price: "$590k",   yld: "6.1%" },
    { x: 70, y: 45, grade: "C+", color: "#fbbf24",  price: "$1.1m",   yld: "3.1%" },
    { x: 20, y: 65, grade: "D",  color: "#ff5f5f",  price: "$950k",   yld: "2.4%" },
    { x: 80, y: 65, grade: "B",  color: "#38bdf8",  price: "$710k",   yld: "4.7%" },
    { x: 60, y: 75, grade: "A+", color: "#00e676",  price: "$480k",   yld: "6.8%" },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        height: 380,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        boxShadow: "0 0 0 1px var(--glass-border), 0 24px 60px rgba(0,0,0,0.5)",
      }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 100 100" preserveAspectRatio="none">
        {Array.from({ length: 12 }).map((_, i) => (
          <g key={i}>
            <line x1={i * 9} y1="0" x2={i * 9} y2="100" stroke="var(--brand)" strokeWidth="0.3" />
            <line x1="0" y1={i * 9} x2="100" y2={i * 9} stroke="var(--brand)" strokeWidth="0.3" />
          </g>
        ))}
      </svg>

      {pins.map((pin, i) => (
        <div key={i} className="absolute flex flex-col items-center cursor-pointer group"
          style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -100%)" }}>
          <div
            className="px-2.5 py-1 rounded-full text-xs font-bold transition-transform group-hover:scale-110"
            style={{
              background: pin.color,
              color: "#050d0d",
              boxShadow: `0 2px 12px ${pin.color}99`,
              fontFamily: "Fira Code, monospace",
            }}
          >
            {pin.grade}
          </div>
          <div className="w-px h-3" style={{ background: pin.color, opacity: 0.6 }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: pin.color }} />
          <div
            className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "7px 12px",
              boxShadow: "0 0 0 1px var(--glass-border)",
            }}
          >
            <div className="text-xs font-bold mono" style={{ color: "var(--text-primary)" }}>{pin.price}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Yield: {pin.yld}</div>
          </div>
        </div>
      ))}

      <div
        className="absolute bottom-4 left-4 right-4 rounded-xl p-3 text-xs"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", backdropFilter: "blur(12px)" }}
      >
        <div className="font-semibold mb-2" style={{ color: "var(--brand)" }}>Filters</div>
        <div className="flex flex-wrap gap-1.5">
          {["Deposit: 30%", "Min yield: 4%", "Freehold only", "Auckland"].map((f) => (
            <span key={f} className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: "var(--brand-light)", color: "var(--brand)", border: "1px solid var(--glass-border)" }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute top-4 right-4 text-xs font-bold px-3 py-1.5 rounded-full"
        style={{ background: "rgba(0,230,118,0.12)", border: "1px solid rgba(0,230,118,0.25)", color: "var(--green)" }}>
        Pro · $99/mo
      </div>
    </div>
  );
}

function ScoreBreakdown() {
  const categories = [
    { name: "Structure & materials", pts: "400 pts", items: ["Roof", "Cladding", "Windows", "Heating", "Kitchen", "Bathrooms"], color: "#00d4c8", icon: Home },
    { name: "Location",              pts: "200 pts", items: ["Aspect", "Street character", "Walkability", "School zones"],       color: "#00e676", icon: Map },
    { name: "Land",                  pts: "150 pts", items: ["Section size", "Usability", "Hazard status", "Dev potential"],     color: "#2dd4bf", icon: TrendingUp },
    { name: "Legal / Title",         pts: "100 pts", items: ["Freehold 100", "Cross-lease 70", "Unit title 60", "Leasehold 25"], color: "#fbbf24", icon: Shield },
    { name: "Financial",             pts: "100 pts", items: ["Price vs market", "VFM grade", "Days on market"],                  color: "#fb923c", icon: Calculator },
    { name: "Liveability",           pts: "50 pts",  items: ["Presentation", "Outdoor space", "Subjective quality"],            color: "#a78bfa", icon: Star },
  ];
  return (
    <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((c) => (
        <div key={c.name} className="card p-5" style={{ borderLeft: `2px solid ${c.color}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <c.icon size={15} style={{ color: c.color }} />
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{c.name}</h3>
            </div>
            <span className="mono text-sm font-bold" style={{ color: c.color }}>{c.pts}</span>
          </div>
          <ul className="space-y-1">
            {c.items.map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs">
                <ChevronRight size={11} style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-secondary)" }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PricingCards() {
  const plans = [
    {
      name: "Free",  price: "$0",  desc: "Try before you commit", href: "/signup",              cta: "Start free",   highlight: false,
      features: ["3 reports/month", "Market value estimate", "Quality score preview", "Basic equity calculator"],
      missing:  ["Photo analysis", "Renovation planner", "Healthy Homes", "Map"],
    },
    {
      name: "Starter", price: "$49", desc: "Full reports, unlimited", href: "/signup?plan=starter", cta: "Get Starter", highlight: false,
      features: ["Unlimited reports", "Full photo analysis", "Score breakdown + VFM", "Renovation planner", "Healthy Homes checker", "Financial calculator", "PDF + shareable links"],
      missing:  ["NZ investment map"],
    },
    {
      name: "Pro", price: "$99", desc: "For serious investors", href: "/signup?plan=pro", cta: "Get Pro", highlight: true,
      features: ["Everything in Starter", "NZ investment map", "Map filters + alerts", "10-yr profit per pin", "Batch reports (×10)", "Compare mode (×3)", "CSV export"],
      missing:  [],
    },
  ];

  return (
    <div className="mt-12 grid md:grid-cols-3 gap-5">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className="rounded-2xl p-6 relative"
          style={{
            background: plan.highlight
              ? "linear-gradient(160deg, #091e1e 0%, #0a2420 100%)"
              : "var(--surface)",
            border: plan.highlight
              ? "1px solid var(--brand)"
              : "1px solid var(--border)",
            boxShadow: plan.highlight
              ? "0 0 0 1px var(--brand-light), 0 24px 60px rgba(0,212,200,0.1)"
              : "none",
          }}
        >
          {plan.highlight && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full"
              style={{ background: "var(--brand)", color: "#050d0d" }}>
              Most popular
            </div>
          )}
          <div className="text-xl font-bold mb-0.5" style={{ color: plan.highlight ? "var(--brand)" : "var(--text-primary)" }}>
            {plan.name}
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold mono" style={{ color: "var(--text-primary)" }}>{plan.price}</span>
            {plan.price !== "$0" && <span className="text-sm" style={{ color: "var(--text-muted)" }}>/mo</span>}
          </div>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>{plan.desc}</p>
          <ul className="space-y-2.5 mb-8">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--green)" }} />
                <span style={{ color: "var(--text-secondary)" }}>{f}</span>
              </li>
            ))}
            {plan.missing.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm opacity-30">
                <XCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)" }}>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={plan.href}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm cursor-pointer transition-all"
            style={{
              background: plan.highlight ? "var(--brand)" : "var(--brand-light)",
              color: plan.highlight ? "#050d0d" : "var(--brand)",
              border: plan.highlight ? "none" : "1px solid var(--glass-border)",
              boxShadow: plan.highlight ? "0 0 20px var(--brand-glow)" : "none",
            }}
          >
            {plan.cta}
            <ArrowRight size={15} />
          </Link>
        </div>
      ))}
    </div>
  );
}

function TestimonialsGrid() {
  const testimonials = [
    { quote: "We nearly paid $850k for a leaky cladding risk. RoiQ flagged it in the photo analysis. Saved us from an absolute disaster.", name: "Sarah T.", role: "First-home buyer, Auckland", score: 5 },
    { quote: "I use the map every Sunday morning. Found three positive cashflow properties last month I'd never have spotted otherwise.", name: "James K.", role: "Property investor, Wellington", score: 5 },
    { quote: "The Healthy Homes checker alone is worth the Starter sub. Identified $14k of compliance costs I negotiated off the price.", name: "Priya M.", role: "Landlord, Christchurch", score: 5 },
  ];
  return (
    <div className="mt-12 grid md:grid-cols-3 gap-5">
      {testimonials.map((t, i) => (
        <div key={i} className="card p-6">
          <div className="flex gap-0.5 mb-4">
            {Array.from({ length: t.score }).map((_, j) => (
              <Star key={j} size={15} fill="var(--brand)" style={{ color: "var(--brand)" }} />
            ))}
          </div>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            &ldquo;{t.quote}&rdquo;
          </p>
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{t.name}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t.role}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-12" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="font-bold text-lg mb-3" style={{ color: "var(--brand)", textShadow: "0 0 12px var(--brand-glow)" }}>RoiQ</div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              AI-powered property analysis for NZ home buyers and investors. Know before you buy.
            </p>
          </div>
          {([
            {
              title: "Product",
              links: [
                { label: "Features",      href: "/#pricing"          },
                { label: "Pricing",       href: "/pricing"           },
                { label: "Sample report", href: "/report/rpt_001"    },
                { label: "Map",           href: "/map"               },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About",          href: "/about"            },
                { label: "Blog",           href: "#"                 },
                { label: "Privacy Policy", href: "#"                 },
                { label: "Terms",          href: "#"                 },
              ],
            },
            {
              title: "Support",
              links: [
                { label: "Get started",   href: "/signup"            },
                { label: "Contact",       href: "mailto:hello@roiq.co.nz" },
                { label: "Login",         href: "/login"             },
                { label: "Changelog",     href: "#"                  },
              ],
            },
          ] as const).map((col) => (
            <div key={col.title}>
              <div className="font-semibold text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>{col.title}</div>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm cursor-pointer hover:text-[var(--brand)] transition-colors" style={{ color: "var(--text-secondary)" }}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>© 2026 RoiQ Limited. Not a registered valuer or building inspector.</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>roiq.co.nz</p>
        </div>
      </div>
    </footer>
  );
}
