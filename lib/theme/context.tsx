"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

type Theme = "dark" | "light";

/**
 * Versioned deliberately. The previous provider wrote "roiq-theme" on every
 * mount, not just on an explicit toggle, so every returning user has "dark"
 * persisted whether or not they ever chose it. Reading a new key lets the
 * light default apply without silently overwriting a real preference.
 */
const STORAGE_KEY = "roiq-theme-v3";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Dark is the default: this design is navy-grounded and the light theme is the
 * alternate. A saved choice always wins. With no saved choice we default to
 * dark rather than following the system, because the brand expression lives
 * there and a light first impression would not read as the same product.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      return;
    }
    setTheme("dark");
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.classList.toggle("light", theme === "light");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
