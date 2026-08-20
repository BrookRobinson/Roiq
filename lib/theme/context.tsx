"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

type Theme = "dark" | "light";

/**
 * Versioned deliberately. The previous provider wrote "roiq-theme" on every
 * mount, not just on an explicit toggle, so every returning user has "dark"
 * persisted whether or not they ever chose it. Reading a new key lets the
 * light default apply without silently overwriting a real preference.
 */
const STORAGE_KEY = "roiq-theme-v4";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Light is the default: the palette is white and gold, so the white ground is
 * the brand expression and the black-and-gold dark theme is the alternate.
 * A saved choice always wins.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      return;
    }
    setTheme("light");
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
