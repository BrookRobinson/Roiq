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

export { urgencyScoreToYears } from "./years";
