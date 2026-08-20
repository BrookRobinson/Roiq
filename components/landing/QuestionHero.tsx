import Link from "next/link";
import { Enter } from "@/components/ui/Reveal";
import { ArrowRight } from "lucide-react";

/**
 * The landing hook.
 *
 * Previously this ran a live finance calculator. That is now redundant: the
 * demo report sits further down the same page with a full Financial tab, so
 * the hero was asking a visitor to do arithmetic before it had given them a
 * reason to care. This states the question instead and sends them to the
 * report for the answer.
 *
 * A manifesto hero: no asset, the message is the design. That is the one
 * composition where large type carrying the whole viewport is the right call
 * rather than a placeholder for a missing image.
 */
export function QuestionHero() {
  return (
    <section
      className="relative overflow-hidden border-b"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="aura pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-page px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-32 lg:pt-28">
        <Enter>
          {/* The break is explicit rather than width-driven: a `ch` max-width
              on a wrapper resolves against the WRAPPER's font size, not the
              80px display type, which silently clamped this to two words a
              line. Two lines is the cap for a hero headline. */}
          <h1
            className="display text-[2.5rem] sm:text-[3.75rem] lg:text-[4.75rem]"
            style={{ color: "var(--text-primary)" }}
          >
            The million dollar
            <br />
            question
            {/* The aside is small, upright and in the accent, so it reads as a
                wry footnote rather than part of the shout. */}
            <span
              className="ml-3 align-middle text-[0.26em] font-bold uppercase not-italic tracking-[0.14em]"
              style={{ color: "var(--accent-text)" }}
            >
              (literally)
            </span>
          </h1>
        </Enter>

        <Enter delay={0.08}>
          <p
            className="mt-8 max-w-[24ch] text-[1.6rem] font-medium leading-[1.2] sm:text-[2rem] lg:max-w-[26ch]"
            style={{ letterSpacing: "-0.02em", color: "var(--text-primary)" }}
          >
            &ldquo;If I buy this property, am I going to be financially better
            off for it?&rdquo;
          </p>
        </Enter>

        <Enter delay={0.16}>
          <p
            className="mt-6 max-w-measure text-[17px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Do a property report and find out. The end result may shock you.
          </p>
        </Enter>

        <Enter delay={0.24}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/report/new" className="btn-primary px-7 py-4 text-[15px]">
              Run a property report
              <ArrowRight size={16} />
            </Link>
            <Link href="#demo" className="btn-secondary px-7 py-4 text-[15px]">
              See one first
            </Link>
          </div>
        </Enter>
      </div>
    </section>
  );
}
