"use client";

// ============================================================
// "Has this one been done already?"
//
// Sits above the listing-URL box, because it's the cheaper question. Typing an
// address searches saved analyses and offers what matches; picking one skips
// paying for an analysis that already exists. When nothing matches — the common
// case, and not a failure — it says so and points at the URL box below.
//
// Nothing here reveals a report. The list carries an address, a suburb and a
// date; opening one goes through the same gates as pasting the link would.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, MapPin, ArrowDown, CheckCircle2 } from "lucide-react";
import { MIN_QUERY_LENGTH, type AnalysedMatch } from "@/lib/reports/search-shared";

/** "today" / "3 days ago" — enough to judge whether it's still current. */
function analysedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "recently";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function AnalysedAddressSearch({
  onSelect,
  onPasteUrl,
}: {
  onSelect: (match: AnalysedMatch) => void;
  /** Send them to the URL box — the only way forward when nothing matched. */
  onPasteUrl: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AnalysedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  /** A search has completed for the current query — until then, "no results"
   *  would be a lie told while the request is still in flight. */
  const [settled, setSettled] = useState(false);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const ready = query.trim().length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!ready) {
      setMatches([]);
      setSettled(false);
      setLoading(false);
      return;
    }

    // Debounced, and every earlier request is abandoned — otherwise a slow
    // response for "14 f" can land after "14 ferndale" and replace the better
    // list with a worse one.
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reports/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setMatches(Array.isArray(data.matches) ? data.matches : []);
        setSettled(true);
        setActive(-1);
        setOpen(true);
      } catch {
        // Aborted, or the network is away. Either way this box is optional —
        // stay quiet and leave the URL input as the way through.
        if (!controller.signal.aborted) {
          setMatches([]);
          setSettled(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, ready]);

  // Click anywhere else and the list gets out of the way.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (m: AnalysedMatch) => {
    setOpen(false);
    onSelect(m);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const nothingFound = ready && settled && !loading && matches.length === 0;

  return (
    <div
      className="rounded-2xl p-6 mb-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <label
        htmlFor="analysed-address-search"
        className="label text-sm font-semibold block"
        style={{ color: "var(--text-primary)", marginBottom: 10 }}
      >
        <Search size={14} className="inline mr-2" style={{ color: "var(--brand)" }} />
        Already analysed?
      </label>
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        Start typing an address — if this property has been analysed before, the report is
        ready to open.
      </p>

      <div ref={boxRef} className="relative">
        <input
          id="analysed-address-search"
          className="input text-base w-full"
          placeholder="e.g. 14 Ferndale Road"
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls="analysed-address-results"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `analysed-match-${active}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setSettled(false);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />

        {loading && (
          <Loader2
            size={16}
            className="animate-spin absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
        )}

        {open && matches.length > 0 && (
          <ul
            id="analysed-address-results"
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 z-20 rounded-xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}
          >
            {matches.map((m, i) => (
              <li key={`${m.address}-${m.analysedAt}`} role="none">
                <button
                  id={`analysed-match-${i}`}
                  role="option"
                  aria-selected={i === active}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(m)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                  style={{
                    background: i === active ? "var(--brand-light)" : "transparent",
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <MapPin
                    size={15}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: "var(--brand)" }}
                  />
                  <span className="flex-1 min-w-0">
                    <span
                      className="block text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {m.address}
                    </span>
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                      {[m.suburb, m.region].filter(Boolean).join(", ") || "New Zealand"} · analysed{" "}
                      {analysedAgo(m.analysedAt)}
                    </span>
                  </span>
                  {m.mine && (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                      style={{ background: "var(--brand-light)", color: "var(--brand)" }}
                    >
                      <CheckCircle2 size={11} /> Your report
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The usual outcome, and the whole point of the prompt: no saved analysis,
          so the listing URL is the way to get one. */}
      {nothingFound && (
        <div
          className="rounded-xl p-4 mt-3 text-sm"
          style={{ background: "var(--accent-wash)", border: "1px solid var(--brand)" }}
        >
          <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            No report on that address yet
          </div>
          <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
            Nobody has analysed <strong style={{ color: "var(--text-primary)" }}>{query.trim()}</strong>{" "}
            yet. Paste the listing URL below and we&apos;ll run the full analysis on it.
          </p>
          <button type="button" onClick={onPasteUrl} className="btn-secondary text-sm">
            Paste a listing URL <ArrowDown size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
