"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({
  className = "",
}: {
  readonly className?: string;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`size-8 rounded-full border border-rule opacity-50 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`size-8 rounded-full border border-rule flex items-center justify-center text-ink-muted hover:text-ink hover:border-rule-strong transition-all duration-150 cursor-pointer ${className}`}
      title={
        resolvedTheme === "dark" ? "Włącz jasny motyw" : "Włącz ciemny motyw"
      }
      aria-label="Przełącz motyw"
    >
      {resolvedTheme === "dark" ? (
        <SunIcon size={14} weight="regular" />
      ) : (
        <MoonIcon size={14} weight="regular" />
      )}
    </button>
  );
}
