import type { Config } from "tailwindcss";

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
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
      colors: {
        brand: {
          DEFAULT: "#00d4c8",
          hover:   "#00bfb4",
          dark:    "#008a84",
          light:   "rgba(0,212,200,0.12)",
        },
        green: {
          neon: "#00e676",
          DEFAULT: "#00d479",
        },
        surface: {
          DEFAULT: "#091919",
          2: "#0e2525",
        },
        border: {
          DEFAULT: "#153632",
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #00d4c8 0%, #00e676 100%)",
        "gradient-dark":  "linear-gradient(135deg, #050d0d 0%, #091919 100%)",
        "gradient-hero":  "linear-gradient(135deg, #050d0d 0%, #071e1c 50%, #050d0d 100%)",
      },
      animation: {
        "fade-in":   "fadeIn 0.5s ease-out",
        "slide-up":  "slideUp 0.4s ease-out",
        "pulse-teal":"pulse-teal 2s ease-in-out infinite",
        shimmer:     "shimmer 2s infinite linear",
        "spin-slow": "spin 8s linear infinite",
      },
      boxShadow: {
        glow:       "0 0 20px rgba(0,212,200,0.25)",
        "glow-lg":  "0 0 40px rgba(0,212,200,0.2)",
        "glow-green":"0 0 20px rgba(0,230,118,0.25)",
        glass:      "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,200,0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
