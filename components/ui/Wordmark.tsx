import { PRODUCT_NAME } from "@/lib/brand";

/**
 * The product wordmark.
 *
 * A single geometric mark: a square plan outline with a corner survey tick,
 * which is the one drawing convention this whole design language is built on.
 * Kept as a simple primitive shape rather than an illustration, per the rule
 * that hand-rolled decorative SVG is a last resort.
 */
export function Wordmark({
  size = 20,
  showText = true,
}: {
  size?: number;
  showText?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        {/* plan outline */}
        <rect
          x="1.5"
          y="1.5"
          width="17"
          height="17"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* survey tick: the fixed corner every measurement is taken from */}
        <path d="M1.5 13.5H6.5V18.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="4" width="5" height="5" fill="var(--accent)" />
      </svg>
      {showText && (
        <span
          className="text-[19px] font-semibold"
          style={{ letterSpacing: "-0.03em" }}
        >
          {PRODUCT_NAME}
        </span>
      )}
    </span>
  );
}
