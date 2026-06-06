"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface HoldPeriodContextType {
  holdYears: number;
  setHoldYears: (y: number) => void;
  /** Returns true if an item with the given urgency timeline falls within the hold period */
  withinHold: (urgencyYears: number) => boolean;
  /** Label: "At your 7-year hold period:" */
  holdLabel: string;
}

const HoldPeriodContext = createContext<HoldPeriodContextType>({
  holdYears: 10,
  setHoldYears: () => {},
  withinHold: () => true,
  holdLabel: "At your 10-year hold period:",
});

export function HoldPeriodProvider({
  children,
  defaultYears = 10,
}: {
  children: ReactNode;
  defaultYears?: number;
}) {
  const [holdYears, setHoldYears] = useState(defaultYears);

  return (
    <HoldPeriodContext.Provider
      value={{
        holdYears,
        setHoldYears,
        withinHold: (urgencyYears: number) => urgencyYears <= holdYears,
        holdLabel: `At your ${holdYears}-year hold period:`,
      }}
    >
      {children}
    </HoldPeriodContext.Provider>
  );
}

export function useHoldPeriod() {
  return useContext(HoldPeriodContext);
}

/** Maps a 1–10 urgency score to approximate years-to-action */
export function urgencyScoreToYears(score: number | null): number {
  if (score === null) return 99; // unscored = treat as outside hold
  const map: Record<number, number> = {
    10: 99, 9: 99, 8: 15, 7: 7,
    6: 6,   5: 4,  4: 3,  3: 2,
    2: 1,   1: 0,
  };
  return map[score] ?? 99;
}
