import type { UrgentAction, ActionScope } from "./depreciation";

const SCOPES: readonly ActionScope[] = ["maintenance", "repair", "replace"];

/** The analysis's urgent action, or undefined when it is missing any part of it. */
export function normAction(raw: { work?: string; scope?: string; share?: number } | null | undefined): UrgentAction | undefined {
  const work = raw?.work?.trim();
  const scope = raw?.scope as ActionScope | undefined;
  if (!work || !scope || !SCOPES.includes(scope)) return undefined;
  const share = scope === "replace" ? 1 : Number(raw?.share);
  if (!Number.isFinite(share) || share <= 0) return undefined;
  return { work, scope, share: Math.min(1, share) };
}
