import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { buildDemoReport } from "@/lib/scoring/demo";
import { SCORING_MODEL } from "@/lib/scoring/model";
import { ArrowRight } from "lucide-react";

/**
 * How it works.
 *
 * Three steps, described the way a buyer experiences them rather than the way
 * the pipeline runs. The internal stages (scrape, downscale, vision, score,
 * compile) are visible on /report/new while a report is generating; nobody
 * needs them before they have decided to run one.
 *
 * The counts are read from the scoring model and the demo report so they stay
 * correct if the engine changes, and the timing matches what /report/new
 * actually tells people while they wait.
 */

const ITEM_COUNT = SCORING_MODEL.length;
const PHOTOS_READ = buildDemoReport().photosAnalysed;

const STEPS = [
  {
    n: "01",
    title: "Paste the listing",
    body: `A OneRoof, realestate.co.nz or agency link. Not listed? Enter the address, or upload your own photos.`,
  },
  {
    n: "02",
    title: "We read every photo",
    body: `Each photo is checked against ${ITEM_COUNT} items, from the roof to the hot water. The demo above read ${PHOTOS_READ}.`,
  },
  {
    n: "03",
    title: "You get the report",
    body: `In one to three minutes: what it's worth, what needs doing and when, and the money over the years you'd own it.`,
  },
];

export function HowItWorks() {
  return (
    <section className="border-b py-24 lg:py-28" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="section-heading max-w-[12ch]">How it works</h2>
        </Reveal>

        {/* A ruled track rather than three cards: the top border runs the whole
            width on desktop, so the steps read as one sequence instead of three
            unrelated tiles. */}
        <ol
          className="mt-12 grid gap-x-10 gap-y-10 border-t pt-0 lg:grid-cols-3"
          style={{ borderColor: "var(--rule-strong)" }}
        >
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08} as="li">
              <div className="pt-7">
                <div
                  className="mono text-[13px] font-semibold"
                  style={{ color: "var(--accent-text)" }}
                >
                  {s.n}
                </div>
                <h3
                  className="mt-3 text-[21px] font-semibold leading-snug"
                  style={{ letterSpacing: "-0.018em", color: "var(--text-primary)" }}
                >
                  {s.title}
                </h3>
                <p
                  className="mt-2.5 max-w-[38ch] text-[15px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.26}>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/report/new" className="btn-primary px-7 py-3.5 text-[15px]">
              Run a property report
              <ArrowRight size={16} />
            </Link>
            <Link href="/report/upload" className="btn-secondary px-7 py-3.5 text-[15px]">
              Upload photos instead
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
