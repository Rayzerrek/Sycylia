"use client";

import {
  MagnifyingGlassIcon,
  SquaresFourIcon,
  GridFourIcon,
  PlayIcon,
  XIcon,
} from "@phosphor-icons/react";

export type ViewMode = "editorial" | "grid";
export type SortMode = "newest" | "oldest";

export interface ControlDockProps {
  readonly viewMode: ViewMode;
  readonly onViewModeChange: (mode: ViewMode) => void;
  readonly sortMode: SortMode;
  readonly onSortModeChange: (sort: SortMode) => void;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onStartSlideshow: () => void;
  readonly slideshowDisabled: boolean;
}

/** Search, ordering and two gallery layouts with accessible labels. */
export function ControlDock({
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
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
          aria-label="Szukaj po nazwie pliku lub dacie"
          placeholder="Szukaj zdjęć…"
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
      <div className="gallery-tools">
        <select
          aria-label="Kolejność zdjęć"
          value={sortMode}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "newest" || value === "oldest")
              onSortModeChange(value);
          }}
        >
          <option value="newest">Najnowsze</option>
          <option value="oldest">Najstarsze</option>
        </select>
        <fieldset className="view-switch" aria-label="Układ galerii">
          <button
            type="button"
            aria-label="Naturalne proporcje"
            title="Naturalne proporcje"
            aria-pressed={viewMode === "editorial"}
            onClick={() => onViewModeChange("editorial")}
          >
            <SquaresFourIcon size={18} />
          </button>
          <button
            type="button"
            aria-label="Równa siatka"
            title="Równa siatka"
            aria-pressed={viewMode === "grid"}
            onClick={() => onViewModeChange("grid")}
          >
            <GridFourIcon size={18} />
          </button>
        </fieldset>
        <button
          type="button"
          className="slideshow-button"
          disabled={slideshowDisabled}
          onClick={onStartSlideshow}
        >
          <PlayIcon size={14} weight="fill" /> <span>Pokaz zdjęć</span>
        </button>
      </div>
    </div>
  );
}
