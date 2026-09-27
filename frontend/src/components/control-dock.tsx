"use client";

import {
  MagnifyingGlassIcon,
  SquaresFourIcon,
  GridFourIcon,
  RowsIcon,
  PlayIcon,
  ShuffleIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  XIcon,
} from "@phosphor-icons/react";

export type ViewMode = "editorial" | "grid" | "showcase";
export type SortMode = "newest" | "oldest" | "random";

export interface ControlDockProps {
  readonly viewMode: ViewMode;
  readonly onViewModeChange: (mode: ViewMode) => void;
  readonly sortMode: SortMode;
  readonly onSortModeChange: (sort: SortMode) => void;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onStartSlideshow: () => void;
}

export function ControlDock({
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
  searchQuery,
  onSearchQueryChange,
  onStartSlideshow,
}: ControlDockProps) {
  return (
    <div className="mb-6 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rule text-xs font-mono">
        {/* Search */}
        <div className="relative w-full sm:w-56">
          <MagnifyingGlassIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Szukaj..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-full border border-rule bg-paper text-xs font-mono text-ink placeholder:text-ink-faint focus:border-rule-strong focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-0.5 cursor-pointer"
              title="Wyczyść szukanie"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>

        {/* Right side: Sort + View modes + Slideshow */}
        <div className="flex items-center gap-2">
          {/* Sort Mode */}
          <div className="flex items-center rounded-full border border-rule bg-paper p-0.5">
            <button
              type="button"
              onClick={() => onSortModeChange("newest")}
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                sortMode === "newest"
                  ? "bg-paper-card text-ink shadow-2xs font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Sortuj: Od najnowszych"
            >
              <SortDescendingIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => onSortModeChange("oldest")}
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                sortMode === "oldest"
                  ? "bg-paper-card text-ink shadow-2xs font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Sortuj: Od najstarszych"
            >
              <SortAscendingIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => onSortModeChange("random")}
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                sortMode === "random"
                  ? "bg-paper-card text-ink shadow-2xs font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Wymieszaj losowo"
            >
              <ShuffleIcon size={14} />
            </button>
          </div>

          {/* View Mode */}
          <div className="flex items-center rounded-full border border-rule bg-paper p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("editorial")}
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                viewMode === "editorial"
                  ? "bg-paper-card text-ink shadow-2xs font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Widok: Siatka autorska"
            >
              <SquaresFourIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-paper-card text-ink shadow-2xs font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Widok: Równa siatka kwadratowa"
            >
              <GridFourIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("showcase")}
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                viewMode === "showcase"
                  ? "bg-paper-card text-ink shadow-2xs font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
              title="Widok: Duże kadry"
            >
              <RowsIcon size={14} />
            </button>
          </div>

          {/* Slideshow button */}
          <button
            type="button"
            onClick={onStartSlideshow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rule bg-paper-card hover:bg-paper text-ink text-xs transition-colors cursor-pointer shadow-2xs"
            title="Uruchom pokaz slajdów"
          >
            <PlayIcon size={12} weight="fill" />
            <span className="hidden sm:inline">POKAZ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
