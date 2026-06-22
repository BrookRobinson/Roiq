"use client";

// Mock "View as" switcher — RoiQ has no working auth in-app, so this sets the
// `mp_view` cookie the marketplace reads to resolve the current user (homeowner vs
// the verified test tradesman). Lets both sides of the two-sided marketplace be
// demoed. Reloads so server route handlers re-read the cookie.

import { useEffect, useState } from "react";

type Role = "HOMEOWNER" | "TRADESMAN";

export function ViewSwitcher() {
  const [role, setRole] = useState<Role>("HOMEOWNER");

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )mp_view=(\w+)/);
    if (m?.[1] === "TRADESMAN") setRole("TRADESMAN");
  }, []);

  function pick(r: Role) {
    document.cookie = `mp_view=${r}; path=/; max-age=31536000`;
    window.location.reload();
  }

  return (
    <div title="Prototype: switch sides (no real auth yet)" style={{ display: "flex", border: "1px solid var(--mp-border)", borderRadius: 999, overflow: "hidden", background: "#fff" }}>
      {(["HOMEOWNER", "TRADESMAN"] as const).map((r) => (
        <button
          key={r}
          onClick={() => pick(r)}
          style={{
            padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: "inherit",
            background: role === r ? "var(--mp-navy)" : "transparent",
            color: role === r ? "#fff" : "var(--mp-muted)",
          }}
        >
          {r === "HOMEOWNER" ? "🏠 Homeowner" : "🔨 Tradesman"}
        </button>
      ))}
    </div>
  );
}
