"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { Settings } from "lucide-react";
import { ModeToggle } from "@/components/map/ModeToggle";
import { MapLegend } from "@/components/map/MapLegend";
import { PropertySheet } from "@/components/map/PropertySheet";
import { VariablesScreen } from "@/components/map/VariablesScreen";
import { loadVariables, DEFAULT_VARIABLES } from "@/lib/map/variables";
import { useSession } from "@/lib/auth/session";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { MapMode, UserVariables } from "@/lib/map/types";

/** Remembers that the Variables nudge has been seen, so it never nags. */
const HINT_KEY = "bdr:map:variables-hint";

// Mapbox GL touches `window` — load it client-side only.
const PropertyMap = dynamic(() => import("@/components/map/PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Loading map…</div>
  ),
});

/**
 * The map, whole. Two routes render this:
 *   /map       — real listings; non-Pro sees blurred pins and an upgrade prompt
 *   /map/demo  — the same experience end to end, on demo listings, fully open
 *
 * The demo route exists so someone can set their deposit, rate and hold period
 * and watch the colours move before paying for anything. That only works if it
 * behaves exactly like the real thing, so this is one component rather than a
 * simplified copy that would drift.
 */
export function MapExperience({ demo = false }: { demo?: boolean }) {
  const [ready, setReady] = useState(false);
  const [vars, setVars] = useState<UserVariables | null>(null);
  // Today's mortgage rate, fetched for first-time users — it drives every deal
  // colour, so starting from a stale constant would mis-colour the whole map.
  const [liveRatePct, setLiveRatePct] = useState<number | null>(null);
  const [rateNote, setRateNote] = useState<{ label: string; source: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<MapMode>("homebuyer");
  const [selected, setSelected] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [locked, setLocked] = useState(false);
  // One-time nudge toward the Variables button. Every pin is coloured against
  // the viewer's own numbers, which is the whole idea and completely invisible
  // if you don't know the button is there.
  const [showHint, setShowHint] = useState(false);
  const { isPro, loading: sessionLoading } = useSession();

  // Demo listings are nobody's paid analysis, so there is nothing to withhold.
  const unlocked = demo || isPro;

  useEffect(() => {
    const v = loadVariables();
    if (v) {
      setVars(v);
      setMode(v.defaultMode);
      setReady(true);
      return;
    }

    // No saved numbers yet. Render the setup screen straight away with its built-in
    // defaults, and fetch the current mortgage rate alongside it — the lookup is a
    // web search, and blanking the map for twenty seconds to pre-fill one field is
    // a bad trade. The screen adopts the rate when it lands.
    setReady(true);

    let live = true;
    fetch("/api/map/user-variables")
      .then((r) => r.json())
      .then((d) => {
        if (!live || !d?.interestRate || d.interestRate.isFallback) return;
        setRateNote({ label: d.interestRate.label as string, source: d.interestRate.source as string });
        setLiveRatePct(d.interestRate.ratePct as number);
      })
      .catch(() => {
        /* the screen keeps its own default rate */
      });

    return () => {
      live = false;
    };
  }, []);

  function handleSaved(v: UserVariables) {
    setVars(v);
    setMode(v.defaultMode);
    setEditing(false);
  }

  // A locked visitor gets the blurred preview, so don't make them fill in their
  // deposit and interest rate first — those only matter once the pins are readable.
  const showSetup = unlocked && ready && (!vars || editing);

  // Shown once the map itself is on screen, and never again after it's dismissed.
  useEffect(() => {
    if (!unlocked || showSetup) return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      /* storage blocked — showing it each visit is the lesser evil */
    }
    const t = setTimeout(() => setShowHint(true), 900);
    return () => clearTimeout(t);
  }, [unlocked, showSetup]);

  function dismissHint() {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* non-fatal */
    }
  }


  return (
    <div className="flex flex-col" style={{ background: "var(--bg)", height: "100vh", overflow: "hidden" }}>
      <Navbar />

      {/* Wait for the plan before building the map: the locked/unlocked layers are
          created once at mount, so a Pro user who renders early would be stuck with
          the blurred version. */}
      {!ready || (!demo && sessionLoading) ? (
        <div className="flex-1" />
      ) : showSetup ? (
        <div className="flex-1 overflow-y-auto">
          <VariablesScreen
            initial={vars}
            liveRatePct={liveRatePct}
            rateNote={rateNote?.label ?? null}
            rateSource={rateNote?.source ?? null}
            onSaved={handleSaved}
            onClose={vars ? () => setEditing(false) : undefined}
          />
        </div>
      ) : (
        (vars || !unlocked) && (
          <>
            {/* Mode toggle + settings */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <ModeToggle mode={mode} onChange={setMode} />
              {unlocked && (
                <div className="relative">
                  <button
                    onClick={() => {
                      dismissHint();
                      setEditing(true);
                    }}
                    className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                    aria-label="Edit your variables"
                  >
                    <Settings size={13} /> Variables
                  </button>

                  {showHint && (
                    <div
                      role="dialog"
                      aria-label="Adjust your numbers"
                      className="absolute right-0 z-20 mt-2 w-72 p-4 text-left"
                      style={{
                        top: "100%",
                        background: "var(--surface)",
                        border: "1px solid var(--rule-strong)",
                        boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
                      }}
                    >
                      {/* Points back at the button it's talking about. */}
                      <span
                        aria-hidden="true"
                        className="absolute h-2.5 w-2.5 rotate-45"
                        style={{
                          top: -6,
                          right: 22,
                          background: "var(--surface)",
                          borderLeft: "1px solid var(--rule-strong)",
                          borderTop: "1px solid var(--rule-strong)",
                        }}
                      />
                      <div className="flex items-start gap-2">
                        <Settings size={14} style={{ color: "var(--brand)", marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                            These colours are yours, not ours
                          </p>
                          <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                            Every pin is scored against <strong>your</strong> budget, deposit, interest rate
                            and how long you&rsquo;d hold it. Change them and the whole map re-colours.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => {
                            dismissHint();
                            setEditing(true);
                          }}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Set my numbers
                        </button>
                        <button
                          onClick={dismissHint}
                          className="cursor-pointer px-2 py-1.5 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Got it
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* The seeded note means "the real map has no real pins yet". On the
                demo map that's not news — the banner below already says so. */}
            <MapLegend mode={mode} seeded={!demo && seeded} />

            <div className="flex-1 min-h-0 relative flex">
              <PropertyMap
                mode={mode}
                vars={vars ?? DEFAULT_VARIABLES}
                demo={demo}
                teaser={!unlocked}
                onSelect={setSelected}
                onSeeded={setSeeded}
                onLocked={() => setLocked(true)}
              />

              {/* Demo: say so plainly and permanently. Someone tuning their
                  numbers here needs to know these aren't real listings. */}
              {demo && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
                  <div
                    className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 px-4 py-2.5"
                    style={{ background: "var(--surface)", border: "1px solid var(--rule-strong)" }}
                  >
                    <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      Demo listings — change your numbers and the colours move, exactly like the real map.
                    </span>
                    <Link href="/map" className="btn-primary px-3 py-1.5 text-xs" style={{ textDecoration: "none" }}>
                      See the real map
                    </Link>
                  </div>
                </div>
              )}

              {/* Locked: a slim bar that stays out of the way, and the full
                  prompt only once they actually reach for a property. */}
              {!unlocked && !locked && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
                  <div
                    className="pointer-events-auto flex items-center gap-3 px-4 py-2.5"
                    style={{ background: "var(--surface)", border: "1px solid var(--rule-strong)" }}
                  >
                    <Lock size={13} style={{ color: "var(--brand)" }} />
                    <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      Pins are blurred — Pro opens every report.
                    </span>
                    <Link
                      href="/pricing?plan=pro"
                      className="btn-primary px-3 py-1.5 text-xs"
                      style={{ textDecoration: "none" }}
                    >
                      Get Pro
                    </Link>
                  </div>
                </div>
              )}

              {!unlocked && locked && (
                <div className="absolute inset-0 flex items-center justify-center p-5">
                  <div
                    className="max-w-sm px-6 py-5 text-center"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--rule-strong)",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
                    }}
                  >
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <Lock size={15} style={{ color: "var(--brand)" }} />
                      <span className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        Upgrade to Pro to fully view the map
                      </span>
                    </div>
                    <p className="mb-5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                      Every pin is a real report on a property that&rsquo;s for sale — condition,
                      renovation costs, valuation and five-year return, scored out of 1,000.
                    </p>
                    <Link
                      href="/pricing?plan=pro"
                      className="btn-primary inline-flex px-5 py-2 text-sm"
                      style={{ textDecoration: "none" }}
                    >
                      Get Pro
                    </Link>
                    <button
                      onClick={() => setLocked(false)}
                      className="mt-4 block w-full cursor-pointer text-[12px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Keep looking around
                    </button>
                    <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Or{" "}
                      <Link href="/map/demo" style={{ color: "var(--brand)" }}>
                        try the demo map
                      </Link>{" "}
                      — the same thing on demo listings, free.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {unlocked && selected && vars && (
              <PropertySheet id={selected} mode={mode} vars={vars} demo={demo} onClose={() => setSelected(null)} />
            )}
          </>
        )
      )}
    </div>
  );
}
