"use client";

import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import "yet-another-react-lightbox/styles.css";

const lightboxPlugins = [Video, Slideshow];
const lightboxLabels = {
  Close: "Zamknij",
  Next: "Następne zdjęcie",
  Previous: "Poprzednie zdjęcie",
  Play: "Uruchom pokaz",
  Pause: "Wstrzymaj pokaz",
};

export interface GalleryLightboxProps {
  readonly index: number;
  readonly slides: Slide[];
  readonly onClose: () => void;
  readonly onIndexChange: (index: number) => void;
  readonly autoPlaySlideshow?: boolean;
}

/** Photo preview with navigation, slideshow playback and close controls. */
export default function GalleryLightbox({
  index,
  slides,
  onClose,
  onIndexChange,
  autoPlaySlideshow = false,
}: GalleryLightboxProps) {
  return (
    <Lightbox
      open
      index={index}
      slides={slides}
      close={onClose}
      plugins={lightboxPlugins}
      labels={lightboxLabels}
      carousel={{ preload: 1, padding: "56px", spacing: "24px" }}
      slideshow={{ autoplay: autoPlaySlideshow, delay: 4000 }}
      video={{ controls: true, autoPlay: autoPlaySlideshow }}
      controller={{ closeOnBackdropClick: true }}
      on={{ view: ({ index: currentIndex }) => onIndexChange(currentIndex) }}
      toolbar={{ buttons: ["slideshow", "close"] }}
      render={{
        slideHeader: () => (
          <span className="lightbox-counter" aria-live="off">
            {index + 1} <span>/</span> {slides.length}
          </span>
        ),
      }}
    />
  );
}
