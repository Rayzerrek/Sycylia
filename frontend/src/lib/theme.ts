"use client";

import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "gallery_theme_v1";
const THEME_CHANGE_EVENT = "gallery:theme-changed";

function getSystemIsDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {
    // Local storage access error
  }
  return "system";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else if (theme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    // System default: remove explicit overrides so media query takes effect
    root.classList.remove("dark");
    root.classList.remove("light");
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }),
    );
  } catch {
    // Storage access error
  }
}

export function useTheme(): {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState<boolean>(false);

  useEffect(() => {
    setThemeState(getStoredTheme());
    setSystemDark(getSystemIsDark());

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };

    const handleThemeChange = () => {
      setThemeState(getStoredTheme());
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  };

  const toggleTheme = () => {
    // Toggle between light and dark
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
}
