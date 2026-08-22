"use client";

// One receipt line — the account tab shows the latest few, /account/billing all
// of them, and neither should invent its own idea of what a purchase looks like.

import {
  formatAccessDate,
  formatAmount,
  PLAN_LABEL,
  type Plan,
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
          {PLAN_LABEL[purchase.plan as Plan] ?? purchase.plan} · access to {formatAccessDate(purchase.accessUntil)}
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
