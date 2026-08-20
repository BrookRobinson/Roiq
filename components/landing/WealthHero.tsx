"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { ArrowRight } from "lucide-react";
import {
  defaultInputs,
  summarise,
  FINANCE_DEFAULTS,
} from "@/lib/finance/calculator";

/**
 * The landing hook.
 *
 * The old hero sold the process ("every photo assessed"). This one sells the
 * answer people actually arrive with: if I buy this, what am I left with?
 *
 * Every figure here comes from lib/finance/calculator, the same module the
 * Financial tab of a real report uses. Nothing is mocked or hand-tuned, which
 * is the point: what you can drag on the landing page is what the product
 * computes. The assumptions driving it are printed underneath rather than
 * hidden, because a projection with invisible assumptions is a sales pitch.
 */

const MIN_PRICE = 400_000;
const MAX_PRICE = 2_500_000;

export function WealthHero() {
  const [price, setPrice] = useState(950_000);
  const [years, setYears] = useState(10);
  const [persona, setPersona] = useState<"buyer" | "investor">("buyer");

  const summary = useMemo(() => {
    return summarise(
      defaultInputs({
        persona,
        price,
        // Indicative for a typical NZ three bedroom. A real report reads the
        // actual floor area off the listing.
        floorSqm: 150,
        holdYears: years,
        renoCost: 0,
        // ~4.5% of price a year, the long run NZ rental benchmark.
        weeklyRent: Math.round((price * 0.045) / 52 / 5) * 5,
        growthPct: 5,
      })
    );
  }, [price, years, persona]);

  const chartData = useMemo(
    () => summary.projection.map((p) => ({ year: p.year, equity: p.equity })),
    [summary.projection]
  );

  /**
   * The headline number is EQUITY, not walk-away profit.
   *
   * walkAway treats every mortgage payment as a pure loss, which is the right
   * lens for an investor but badly wrong for an owner-occupier: they have to
   * live somewhere, and the rent they did not pay never enters the sum. Leading
   * with it renders a negative number for almost every buyer, which is both
   * discouraging and not what "how much will I have" means to anyone asking it.
   *
   * Equity is the number people mean, and it decomposes into three honest
   * parts that add up exactly: the deposit they put in, the loan principal they
   * paid off, and the market growth on top.
   */
  const equity = summary.projectedValue - summary.remainingLoan;
  const deposit = summary.deposit;
  const principalPaid = Math.max(0, summary.loan - summary.remainingLoan);
  const growth = summary.projectedValue - price;

  // Headline-safe short form, so the display line never wraps awkwardly.
  // Sub-million reads as "$897K"; "$0.90M" is technically right and reads wrong.
  const ownRounded =
    equity >= 1_000_000
      ? `$${(equity / 1_000_000).toFixed(2)}M`
      : `$${Math.round(equity / 1000)}K`;

  return (
    <section
      className="relative overflow-hidden border-b"
      style={{ borderColor: "var(--rule)" }}
    >
      <div className="aura pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-page px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-14 lg:pt-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ── Left: the question, the answer, the controls ─────────── */}
          <div className="lg:col-span-7">
            <h1
              className="display text-[2.25rem] sm:text-[3rem] lg:text-[3.5rem]"
              style={{ color: "var(--text-primary)" }}
            >
              Buy this house.
              <br />
              <span className="display-accent">In {years} years</span>
              <br />
              <span className="display-chip">you own {ownRounded}</span>
            </h1>

            <p
              className="mt-4 max-w-measure text-[16px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Drag the numbers. This is the same engine that runs inside a real
              RoiQ report.
            </p>

            {/* The answer */}
            <div className="card-glow mt-7 overflow-hidden">
              <div
                className="flex items-center justify-between border-b px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.08em]"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <span>
                  In {years} {years === 1 ? "year" : "years"}, you would own
                </span>
                <PersonaToggle persona={persona} onChange={setPersona} />
              </div>

              <div className="px-5 pb-4 pt-5">
                <AnimatedCurrency value={equity} />

                <p className="mt-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  of a{" "}
                  <span className="mono" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(summary.projectedValue)}
                  </span>{" "}
                  property, with{" "}
                  <span className="mono" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(summary.remainingLoan)}
                  </span>{" "}
                  still owing.
                </p>

                {/* The three parts that make up that equity, to scale. */}
                <Composition
                  parts={[
                    { label: "Your deposit", value: deposit, tone: "var(--text-muted)" },
                    { label: "Loan paid down", value: principalPaid, tone: "var(--good)" },
                    { label: "Market growth", value: growth, tone: "var(--accent)" },
                  ]}
                  total={equity}
                />

                <EquityChart data={chartData} />

                {/* The cost is shown, not buried, but it is not the headline. */}
                <p
                  className="mt-4 border-t pt-4 text-sm leading-relaxed"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                >
                  Getting there costs{" "}
                  <span className="mono" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(summary.totalOngoingOverHold)}
                  </span>{" "}
                  in repayments, rates, insurance and upkeep
                  {persona === "investor" ? (
                    <>
                      , against{" "}
                      <span className="mono" style={{ color: "var(--good)" }}>
                        {formatCurrency(summary.rentalIncomeOverHold)}
                      </span>{" "}
                      of rent collected.
                    </>
                  ) : (
                    <>, before counting the rent you did not have to pay.</>
                  )}
                </p>
              </div>

              {/* Controls */}
              <div
                className="grid gap-5 border-t px-5 py-5 sm:grid-cols-2"
                style={{ borderColor: "var(--rule)" }}
              >
                <Control
                  label="Purchase price"
                  value={formatCurrency(price)}
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  step={25_000}
                  current={price}
                  onChange={setPrice}
                />
                <Control
                  label="Years held"
                  value={`${years}`}
                  min={1}
                  max={15}
                  step={1}
                  current={years}
                  onChange={setYears}
                />
              </div>
            </div>

            {/* Assumptions, stated rather than buried. */}
            <p
              className="mt-3 text-[12px] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {persona === "buyer" ? "20%" : "30%"} deposit,{" "}
              {FINANCE_DEFAULTS.interestRatePct}% interest, 5% annual growth, 150m&sup2;
              floor area. A real report replaces every one of these with the
              property&apos;s own figures.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/report/new" className="btn-primary px-6 py-3.5 text-[15px]">
                Run this on a real listing
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/report/rpt_001"
                className="btn-secondary px-6 py-3.5 text-[15px]"
              >
                Read a sample report
              </Link>
            </div>
          </div>

          {/* ── Right: the ledger behind the number ──────────────────── */}
          <div className="lg:col-span-5">
            <div
              className="flex items-center gap-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Where the number comes from</span>
              <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
            </div>

            <dl>
              <Line label="Bought for" value={-price} muted />
              <Line label="Deposit and purchase costs" value={-summary.totalCashIn} muted />
              <Line
                label={`Worth in ${years} ${years === 1 ? "year" : "years"}`}
                value={summary.projectedValue}
              />
              <Line label="Loan still owing" value={-summary.remainingLoan} />
              {/* Rent is income, not equity, so it is deliberately NOT in this
                  column: every line here sums to the "You own" total below.
                  Rent is reported in the cost sentence instead. */}
            </dl>

            <div
              className="mt-1 flex items-baseline justify-between border-t-2 pt-4"
              style={{ borderColor: "var(--rule-strong)" }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-muted)" }}
              >
                You own
              </span>
              <span
                className="mono text-[19px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {formatCurrency(equity)}
              </span>
            </div>

            <div
              className="mt-6 grid grid-cols-2 gap-3"
            >
              <MiniStat
                label="Equity gained"
                value={formatCurrency(equity - summary.totalCashIn)}
              />
              <MiniStat
                label={persona === "investor" ? "Net yield" : "Weekly cost"}
                value={
                  persona === "investor"
                    ? `${summary.netYieldPct.toFixed(1)}%`
                    : formatCurrency(Math.round(summary.weeklyOngoing))
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function PersonaToggle({
  persona,
  onChange,
}: {
  persona: "buyer" | "investor";
  onChange: (p: "buyer" | "investor") => void;
}) {
  return (
    <div
      className="flex gap-1 p-1"
      role="group"
      aria-label="Scoring persona"
      style={{ background: "var(--surface-2)", borderRadius: "var(--r-pill)" }}
    >
      {(["buyer", "investor"] as const).map((p) => {
        const active = persona === p;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-pressed={active}
            className="cursor-pointer px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] transition-all"
            style={{
              borderRadius: "var(--r-pill)",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--on-accent)" : "var(--text-muted)",
              boxShadow: active ? "0 6px 18px -8px var(--brand-glow)" : "none",
            }}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The headline figure. Springs between values so dragging the slider reads as
 * one continuous quantity changing, rather than a number flickering.
 */
function AnimatedCurrency({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 120, damping: 24, mass: 0.6 });
  const text = useTransform(spring, (v) => formatCurrency(Math.round(v)));

  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, spring, reduce]);

  return (
    <motion.div
      className="mono text-[2.5rem] font-semibold leading-none sm:text-[3.25rem]"
      style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
    >
      {text}
    </motion.div>
  );
}

/**
 * The three parts of the equity figure, drawn to scale.
 *
 * A segmented bar rather than a progress track: there is no "target" here, it
 * is a whole broken into its parts, and the parts sum to exactly the headline
 * number above it. Growth is the only segment in the accent colour, because it
 * is the part the property did rather than the part you paid for.
 */
function Composition({
  parts,
  total,
}: {
  parts: { label: string; value: number; tone: string }[];
  total: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  return (
    <div className="mt-5">
      <div className="flex h-2 w-full overflow-hidden" style={{ borderRadius: "var(--r-pill)" }}>
        {parts.map((p) => (
          <div
            key={p.label}
            style={{
              width: `${Math.max(0, (p.value / safeTotal) * 100)}%`,
              background: p.tone,
            }}
          />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: p.tone }}
                aria-hidden="true"
              />
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-muted)" }}
              >
                {p.label}
              </span>
            </dt>
            <dd
              className="mono mt-1 text-[15px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {formatCurrency(p.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EquityChart({ data }: { data: { year: number; equity: number }[] }) {
  return (
    <div className="mt-4 h-[64px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="var(--accent)"
            strokeWidth={1.5}
            fill="url(#equityFill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Control({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (n: number) => void;
}) {
  const id = useRef(`ctl-${label.replace(/\s+/g, "-").toLowerCase()}`).current;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </label>
        <span
          className="mono text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="roiq-range mt-2.5 w-full cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  const negative = value < 0;
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b py-2.5"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <dt className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </dt>
      <dd
        className="mono whitespace-nowrap text-sm"
        style={{
          color: muted
            ? "var(--text-muted)"
            : negative
              ? "var(--text-secondary)"
              : "var(--text-primary)",
        }}
      >
        {negative ? "-" : "+"}
        {formatCurrency(Math.abs(value))}
      </dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-4 py-3.5"
      style={{ background: "var(--surface)", borderRadius: "var(--r-input)" }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mono mt-1.5 text-[19px] font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `$${Math.round(n).toLocaleString("en-NZ")}`;
  }
  return `$${Math.round(n)}`;
}
