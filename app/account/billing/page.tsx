"use client";

import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import { ExternalLink } from "lucide-react";

export default function BillingRedirectPage() {
  // TODO: call /api/billing/portal to get a real Stripe Customer Portal URL
  // then redirect. For now show a placeholder.

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="card p-8">
          <ExternalLink size={36} className="mx-auto mb-4" style={{ color: "var(--brand)" }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Manage your billing
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Your subscription is managed through Stripe. Click below to open the
            billing portal where you can update your card, download invoices, or
            cancel your subscription.
          </p>
          <a
            href="https://billing.stripe.com/p/login/test_placeholder"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary justify-center"
          >
            Open Stripe billing portal
            <ExternalLink size={15} />
          </a>
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            You will be redirected to Stripe's secure billing portal.
          </p>
        </div>
        <a href="/account" className="text-sm mt-4 inline-block cursor-pointer hover:underline" style={{ color: "var(--text-muted)" }}>
          ← Back to account settings
        </a>
      </div>
    </div>
  );
}
