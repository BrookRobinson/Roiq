import "./globals.css";
import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/context";

/**
 * Two families, one job each.
 *
 * Archivo carries every word: a grotesque with enough width and weight range
 * to work as display type and as UI text, without reading as the default
 * system sans. JetBrains Mono carries every figure, with tabular numerals so
 * columns of scores and prices line up.
 *
 * Loaded through next/font so the files are self-hosted and there is no
 * render-blocking request to fonts.googleapis.com.
 */
const display = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
