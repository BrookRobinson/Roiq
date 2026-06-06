"use client";

import "./globals.css";
import { useState, useEffect, createContext, useContext } from "react";

const ThemeContext = createContext<{
  theme: "dark" | "light";
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("roiq-theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
    // default to dark — no prefers-color-scheme check, dark is the brand
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.remove("dark");
      html.classList.add("light");
    } else {
      html.classList.remove("light");
      html.classList.add("dark");
    }
    localStorage.setItem("roiq-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RoiQ — Know before you buy.</title>
        <meta name="description" content="AI-powered property analysis for NZ home buyers and investors. Honest, data-driven reports in minutes." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Fira+Code:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeContext.Provider value={{ theme, toggle }}>
          {children}
        </ThemeContext.Provider>
      </body>
    </html>
  );
}
