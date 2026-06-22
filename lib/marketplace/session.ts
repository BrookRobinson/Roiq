// Mock identity for the marketplace. RoiQ has no working auth in the running app
// (REVIEW_MODE bypasses login), so for the two-sided prototype we resolve the
// "current user" from a `mp_view` cookie that a small "View as" switcher sets.
// Server-only (route handlers / server components) — uses next/headers.

import { cookies } from "next/headers";
import type { MarketUser, Role } from "./types";
import { getUser, SEED_HOMEOWNER_ID, SEED_TRADESMAN_ID } from "./store";

export const MP_VIEW_COOKIE = "mp_view";

export function getViewRole(): Role {
  const v = cookies().get(MP_VIEW_COOKIE)?.value;
  return v === "TRADESMAN" ? "TRADESMAN" : "HOMEOWNER";
}

/** The seeded user for the current view (homeowner or the verified tradesman). */
export function currentUser(): MarketUser {
  const id = getViewRole() === "TRADESMAN" ? SEED_TRADESMAN_ID : SEED_HOMEOWNER_ID;
  // The seeded users always exist; fall back defensively.
  return (
    getUser(id) ?? {
      id,
      name: "Guest",
      email: "guest@example.co.nz",
      phone: "",
      role: getViewRole(),
    }
  );
}
