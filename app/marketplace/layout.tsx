import Link from "next/link";
import "./marketplace.css";
import { ViewSwitcher } from "@/components/marketplace/ViewSwitcher";

export const metadata = { title: "RoiQ Marketplace — find verified tradesmen" };

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mp-root">
      <header className="mp-header">
        <div className="mp-header-inner">
          <Link href="/marketplace/listings" style={{ textDecoration: "none", color: "var(--mp-navy)", fontWeight: 700, fontSize: 18 }}>
            RoiQ <span style={{ color: "var(--mp-orange)" }}>Marketplace</span>
          </Link>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <ViewSwitcher />
            <Link href="/dashboard" className="mp-btn-ghost" style={{ fontSize: 14, textDecoration: "none" }}>
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
