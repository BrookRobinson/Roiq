"use client";

import { useState } from "react";
import { ChevronDown, Monitor, Smartphone } from "lucide-react";

/**
 * "How do I copy the link?" help, collapsed by default.
 *
 * Pasting a URL is the one step in this flow that assumes a skill not every
 * buyer has, and it is the step that gates the whole product. It sits directly
 * under the URL field, closed, so it is there for the people who need it and
 * invisible to the people who do not.
 *
 * Written as a native disclosure plus a small tab group rather than a select:
 * a dropdown would hide the steps behind a second interaction, which is the
 * wrong shape for instructions someone is reading WHILE doing the task on
 * another device.
 */

type Platform = "computer" | "iphone" | "android";

const PLATFORMS: { id: Platform; label: string; icon: React.ElementType }[] = [
  { id: "computer", label: "Computer", icon: Monitor },
  { id: "iphone", label: "iPhone", icon: Smartphone },
  { id: "android", label: "Android", icon: Smartphone },
];

const STEPS: Record<Platform, { steps: string[]; tip?: string }> = {
  computer: {
    steps: [
      "Open the property listing in your web browser, so you can see the photos and the price.",
      "Click once on the address bar at the very top of the window. That is the long box showing something like oneroof.co.nz/property/...",
      "The whole address turns blue, which means it is selected.",
      "Hold Ctrl and press C to copy it. On a Mac, hold Command (⌘) and press C.",
      "Come back to this page, click inside the Listing URL box above, then hold Ctrl and press V to paste. On a Mac, Command (⌘) and V.",
    ],
    tip: "If the address did not turn blue, click the address bar again. One click selects the whole thing.",
  },
  iphone: {
    steps: [
      "Open the property listing in Safari or the app you found it in.",
      "Tap the Share button. It is the square with an arrow pointing up, at the bottom of the Safari screen.",
      "A panel slides up. Scroll down the list of options and tap Copy.",
      "Come back to this page and press and hold inside the Listing URL box above.",
      "A small Paste button appears. Tap it.",
    ],
    tip: "No Share button? Tap the address bar at the top instead, press and hold the address, then tap Copy.",
  },
  android: {
    steps: [
      "Open the property listing in Chrome or the app you found it in.",
      "Tap the address bar at the top of the screen, showing something like oneroof.co.nz/property/...",
      "A copy icon appears at the right of the address bar. Tap it. If you do not see one, tap the three dots (⋮) at the top right, then tap Share, then Copy link.",
      "Come back to this page and press and hold inside the Listing URL box above.",
      "Tap Paste when it appears.",
    ],
    tip: "If a friend sent you the link in a message, press and hold the link itself and choose Copy link address.",
  },
};

export function CopyUrlHelp() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("computer");
  const active = STEPS[platform];

  return (
    <div
      className="mb-6"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-panel)",
        background: "var(--surface)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Not sure how to copy the link? Tap here
        </span>
        <ChevronDown
          size={18}
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.18s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5">
          {/* Device picker */}
          <div
            className="flex gap-1 p-1"
            role="group"
            aria-label="Choose your device"
            style={{ background: "var(--surface-2)", borderRadius: "var(--r-pill)" }}
          >
            {PLATFORMS.map((p) => {
              const on = platform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  aria-pressed={on}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-semibold transition-all"
                  style={{
                    borderRadius: "var(--r-pill)",
                    background: on ? "var(--accent)" : "transparent",
                    color: on ? "var(--on-accent)" : "var(--text-muted)",
                  }}
                >
                  <p.icon size={14} />
                  {p.label}
                </button>
              );
            })}
          </div>

          <ol className="mt-5 space-y-4">
            {active.steps.map((s, i) => (
              <li key={i} className="flex gap-3.5">
                <span
                  className="mono flex h-6 w-6 flex-shrink-0 items-center justify-center text-[12px] font-bold"
                  style={{
                    borderRadius: "var(--r-pill)",
                    background: "var(--accent-wash)",
                    color: "var(--accent-text)",
                  }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span
                  className="pt-0.5 text-[14px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s}
                </span>
              </li>
            ))}
          </ol>

          {active.tip && (
            <p
              className="mt-5 border-t pt-4 text-[13px] leading-relaxed"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
            >
              <strong style={{ color: "var(--text-secondary)" }}>Stuck?</strong>{" "}
              {active.tip}
            </p>
          )}

          <p
            className="mt-3 text-[13px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Still not working? You can type the street address into the box
            instead, and we will find the property for you.
          </p>
        </div>
      )}
    </div>
  );
}
