"use client";

import { PlayIcon } from "@phosphor-icons/react";

export interface ControlDockProps {
  readonly onStartSlideshow: () => void;
  readonly slideshowDisabled: boolean;
}

/** Gallery slideshow playback control. */
export function ControlDock({
  onStartSlideshow,
  slideshowDisabled,
}: ControlDockProps) {
  return (
    <div className="gallery-controls">
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
