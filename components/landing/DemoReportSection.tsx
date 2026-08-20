import Link from "next/link";
import { RealReportView } from "@/components/RealReportView";
import { buildDemoReport } from "@/lib/scoring/demo";
import { Reveal } from "@/components/ui/Reveal";
import { ArrowRight, MousePointerClick } from "lucide-react";

/**
 * The demo report, embedded live on the landing page.
 *
 * This is not a screenshot and not a mock. It is the actual RealReportView
 * component fed by buildDemoReport(), which runs the real v3.1 scoring engine
 * over seeded data for a real Auckland property. Every tab, the persona
 * toggle, the hold-period slider and the renovation controls work exactly as
 * they do in a paid report, because they ARE the paid report.
 *
 * It renders inside a bounded window with its own scroll rather than inline at
 * full height: the report is roughly 4000px tall, and dropping that into the
 * middle of a landing page would bury everything below it.
 */
const DEMO_REPORT = buildDemoReport();

export function DemoReportSection() {
  return (
    <section
      className="border-b py-20 lg:py-24"
      style={{ borderColor: "var(--border)" }}
      id="demo"
    >
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex items-center gap-2" style={{ color: "var(--accent-text)" }}>
            <MousePointerClick size={16} />
            <span className="text-[12px] font-bold uppercase tracking-[0.12em]">
              Click through it yourself
            </span>
          </div>

          <h2 className="section-heading mt-3 max-w-[18ch]">
            This is the whole report
          </h2>

          <p className="section-sub">
            A real Auckland property, scored by the live engine. Open every tab,
            switch between buyer and investor, drag the hold period. Nothing is
            locked and nothing is a placeholder, so you can see exactly what you
            get before you pay for one.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div
            className="mt-10 overflow-hidden"
            style={{
              border: "1px solid var(--rule-strong)",
              borderRadius: "var(--r-panel)",
              background: "var(--surface)",
            }}
          >
            {/* Window chrome, so the frame reads as the product rather than as
                a page section that happens to scroll. */}
            <div
              className="flex items-center justify-between gap-4 border-b px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: "var(--accent)" }}
                  aria-hidden="true"
                />
                <span
                  className="text-[12px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Live demo report
                </span>
              </div>
              <Link
                href="/report/rpt_001"
                className="text-[13px] font-semibold hover:underline"
                style={{ color: "var(--accent-text)" }}
              >
                Open full size
              </Link>
            </div>

            {/* The report itself. Bounded height with its own scroll; the
                inner view is the real component in embedded mode. */}
            <div
              className="relative overflow-y-auto overscroll-contain"
              style={{ maxHeight: "min(78vh, 860px)" }}
            >
              <RealReportView report={DEMO_REPORT} embedded />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/report/new" className="btn-primary px-6 py-3.5 text-[15px]">
              Run one on your listing
              <ArrowRight size={16} />
            </Link>
            <Link href="/pricing" className="btn-secondary px-6 py-3.5 text-[15px]">
              See pricing
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
