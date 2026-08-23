import Navbar from "@/components/Navbar";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata = { title: `Privacy Policy — ${PRODUCT_NAME}` };

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. What we collect",
    p: [
      "Account details you provide (email, and your preferences such as role, hold period, budget, and target regions).",
      "Listing URLs you submit and the report data generated from them.",
      "Standard usage and device data for analytics and security.",
    ],
  },
  {
    h: "2. How we use it",
    p: [
      "To generate and store your property reports, operate your account and subscription, improve the product, and contact you about your account.",
      "Listing photos are analysed to produce condition reports. We process publicly available listing content; we do not claim ownership of third-party listing imagery.",
    ],
  },
  {
    h: "3. AI processing",
    p: [
      "Reports are generated using third-party AI services (Anthropic Claude). Listing photos and text are sent to these services to produce the analysis. We do not use your data to train third-party models.",
    ],
  },
  {
    h: "4. Sharing",
    p: [
      `We share data with the service providers needed to run ${PRODUCT_NAME} (hosting, database, payments, email, AI). We do not sell your personal information.`,
      "If you share a report via a private link, anyone with that link can view it until you disable sharing.",
    ],
  },
  {
    h: "5. Your rights",
    p: [
      "You can access, correct, export, or delete your account data at any time from Account settings, or by contacting us. We retain data only as long as needed to provide the service or meet legal obligations.",
    ],
  },
  {
    h: "6. Contact",
    p: ["For privacy requests, contact us via the address listed on our About page."],
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Privacy Policy
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Last updated June 2026 · Draft for review
        </p>

        <div className="space-y-7">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                {s.h}
              </h2>
              {s.p.map((para, i) => (
                <p key={i} className="text-sm mb-2" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 text-sm" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
          See also our <Link href="/terms" style={{ color: "var(--brand)" }}>Terms of Service</Link>.
        </div>
      </main>
    </div>
  );
}
