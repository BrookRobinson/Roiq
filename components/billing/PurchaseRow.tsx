"use client";

// One receipt line — the account tab shows the latest few, /account/billing all
// of them, and neither should invent its own idea of what a purchase looks like.

import {
  describeGrant,
  formatAccessDate,
  formatAmount,
  PACKAGE_LABEL,
  type PurchaseSummary,
} from "@/lib/billing/plans";

/** One receipt line. Shared by the account tab and the full billing page. */
export default function PurchaseRow({ purchase }: { purchase: PurchaseSummary }) {
  const refunded = purchase.status === "refunded";

  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {formatAccessDate(purchase.createdAt)}
        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
          {/* What it bought, not which rung it was. A receipt saying "Silver"
              is unmatchable to a charge three weeks later; "50 reports and the
              map" is what they remember buying. */}
          {PACKAGE_LABEL[purchase.pkg]} ·{" "}
          {describeGrant({
            reports: purchase.reports,
            map: purchase.map,
            inspections: purchase.inspections,
          })}
          {purchase.mapUntil && <> · map to {formatAccessDate(purchase.mapUntil)}</>}
        </span>
      </div>
      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {formatAmount(purchase.amountCents, purchase.currency)}
      </div>
      <span className={`badge text-xs ${refunded ? "badge-blue" : "badge-green"}`}>
        {refunded ? "Refunded" : "Paid"}
      </span>
      {purchase.receiptUrl ? (
        <a
          href={purchase.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs cursor-pointer hover:underline"
          style={{ color: "var(--brand)" }}
        >
          Receipt
        </a>
      ) : (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
      )}
    </div>
  );
}
