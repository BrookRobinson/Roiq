import type { Config } from "tailwindcss";

/**
 * "Survey Report" scale.
 *
 * Radius is 0 everywhere by design (one shape system, no exceptions), so
 * borderRadius is pinned rather than extended. Colours resolve through the
 * CSS variables in globals.css so both themes come for free.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        paper: {
          DEFAULT: "var(--paper)",
          2: "var(--paper-2)",
          raised: "var(--paper-raised)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        rule: {
          DEFAULT: "var(--rule)",
          strong: "var(--rule-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          wash: "var(--accent-wash)",
        },
        good: "var(--good)",
        warn: "var(--warn)",
        bad: "var(--bad)",

        // Legacy aliases, still referenced across the app.
        brand: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          light: "var(--accent-wash)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
      },
      borderColor: {
        DEFAULT: "var(--rule)",
      },
      letterSpacing: {
        tightest: "-0.035em",
        label: "0.11em",
      },
      maxWidth: {
        measure: "62ch",
        page: "1320px",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out both",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s infinite linear",
      },
    },
  },
  plugins: [],
};

export default config;
