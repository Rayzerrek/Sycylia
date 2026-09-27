"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export interface GalleryHeaderProps {
  readonly totalCount?: number;
}

export function GalleryHeader({ totalCount }: GalleryHeaderProps) {
  return (
    <header className="pt-8 pb-5 flex items-center justify-between border-b border-rule mb-8">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl font-normal text-ink tracking-tight">
          Galeria zdjęć
        </h1>
        {totalCount !== undefined && totalCount > 0 && (
          <span className="text-xs font-mono text-ink-muted tabular-nums">
            {totalCount} {totalCount === 1 ? "plik" : "plików"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
