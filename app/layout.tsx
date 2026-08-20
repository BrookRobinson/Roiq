import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/context";

/**
 * Inter, matching the LMCT+ reference, loaded through weight 900 for the heavy
 * uppercase display treatment. The slant is a synthesized oblique: Google's
 * Inter has no separate italic face exposed through next/font, and for solid
 * uppercase display type the synthetic slant is visually equivalent. JetBrains Mono
 * carries every figure, with tabular numerals so columns of scores and prices
 * line up: a departure from the reference, kept because RoiQ is a scoring and
 * money product.
 *
 * Self-hosted via next/font, so there is no render-blocking request to
 * fonts.googleapis.com.
 */
const display = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RoiQ — Know before you buy.",
  description:
    "Property analysis for New Zealand buyers and investors. Every photo assessed, every score sourced, scored out of 1,000.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} light`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
