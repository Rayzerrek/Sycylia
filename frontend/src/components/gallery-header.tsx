"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export interface GalleryHeaderProps {
  readonly totalCount?: number;
}

/** Compact gallery title and file count, without an introductory hero. */
export function GalleryHeader({ totalCount }: GalleryHeaderProps) {
  return (
    <header className="gallery-header">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="gallery-title">
          Galeria <span className="gradient-text">zdjęć</span>
        </h1>
        {totalCount !== undefined && totalCount > 0 && (
          <span className="text-xs text-ink-muted tabular-nums">
            {totalCount} {totalCount === 1 ? "plik" : "plików"}
          </span>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
}
