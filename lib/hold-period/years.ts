// Pure — importable on the server as well as by the hold-period React context.

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
