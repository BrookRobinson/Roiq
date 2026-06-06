"use client";

import { useHoldPeriod } from "@/lib/hold-period/context";
import { Clock } from "lucide-react";

export function HoldPeriodSlider() {
  const { holdYears, setHoldYears } = useHoldPeriod();

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <Clock size={15} style={{ color: "var(--brand)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          You plan to own for
        </span>
        <span
          className="text-sm font-bold mono px-2 py-0.5 rounded-lg"
          style={{
            color: "var(--brand)",
            background: "var(--brand-light)",
            minWidth: 36,
            textAlign: "center",
          }}
        >
          {holdYears}yr{holdYears !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>1</span>
        <input
          type="range"
          min={1}
          max={40}
          value={holdYears}
          onChange={(e) => setHoldYears(Number(e.target.value))}
          className="flex-1 cursor-pointer"
          style={{ accentColor: "var(--brand)" }}
          aria-label="Hold period in years"
        />
        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>40</span>
      </div>

      <div className="hidden sm:flex flex-col items-end flex-shrink-0">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Costs shown within your hold period
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Items after {holdYears} yrs will be greyed out
        </span>
      </div>
    </div>
  );
}
