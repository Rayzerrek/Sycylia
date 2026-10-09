"use client";

import { MagnifyingGlassIcon, PlayIcon, XIcon } from "@phosphor-icons/react";

export interface ControlDockProps {
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onStartSlideshow: () => void;
  readonly slideshowDisabled: boolean;
}

/** Gallery search and slideshow playback controls. */
export function ControlDock({
  searchQuery,
  onSearchQueryChange,
  onStartSlideshow,
  slideshowDisabled,
}: ControlDockProps) {
  return (
    <div className="gallery-controls">
      <div className="gallery-search">
        <MagnifyingGlassIcon size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label="Szukaj po zawartości zdjęcia, nazwie lub dacie"
          placeholder="Szukaj np. pies, samochód…"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Wyczyść wyszukiwanie"
            onClick={() => onSearchQueryChange("")}
          >
            <XIcon size={16} />
          </button>
        )}
      </div>
      <button
        type="button"
        className="slideshow-button"
        disabled={slideshowDisabled}
        onClick={onStartSlideshow}
      >
        <PlayIcon size={14} weight="fill" /> <span>Pokaz zdjęć</span>
      </button>
    </div>
  );
}
