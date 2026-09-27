"use client";

import { useState, useCallback, useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import {
  DownloadSimpleIcon,
  HeartIcon,
  InfoIcon,
  CopyIcon,
  CheckIcon,
  CalendarBlankIcon,
  QuestionIcon,
  XIcon,
} from "@phosphor-icons/react";

import { downloadFile } from "@/lib/files";
import { useFavorites } from "@/lib/favorites";

import type { FileEntry } from "@/lib/files";
import type { Slide } from "yet-another-react-lightbox";

export interface GalleryLightboxProps {
  readonly open: boolean;
  readonly index: number;
  readonly slides: Slide[];
  readonly files: FileEntry[];
  readonly onClose: () => void;
  readonly onIndexChange: (index: number) => void;
  readonly autoPlaySlideshow?: boolean;
}

export default function GalleryLightbox({
  open,
  index,
  slides,
  files,
  onClose,
  onIndexChange,
  autoPlaySlideshow = false,
}: GalleryLightboxProps) {
  const currentFile =
    index >= 0 && index < files.length ? files[index] : undefined;
  const { isFav, toggle: toggleFav } = useFavorites();

  const [showInfo, setShowInfo] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [copied, setCopied] = useState(false);

  const isFavorite = currentFile ? isFav(currentFile.name) : false;

  const handleCopyLink = useCallback(async () => {
    if (!currentFile) return;
    const url = currentFile.previewUrl ?? currentFile.url;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard write failed
    }
  }, [currentFile]);

  const formattedDate = useMemo(() => {
    if (!currentFile?.createdAt) return null;
    try {
      const d = new Date(currentFile.createdAt);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, [currentFile]);

  return (
    <>
      <Lightbox
        open={open}
        index={index}
        slides={slides}
        close={onClose}
        plugins={[Video, Zoom, Fullscreen, Slideshow, Thumbnails]}
        carousel={{ preload: 2 }}
        slideshow={{
          autoplay: autoPlaySlideshow,
          delay: 3800,
        }}
        thumbnails={{
          position: "bottom",
          width: 80,
          height: 54,
          border: 1,
          borderRadius: 8,
          gap: 8,
        }}
        zoom={{
          maxZoomPixelRatio: 4,
          scrollToZoom: true,
        }}
        on={{
          view: ({ index: currentIndex }) => onIndexChange(currentIndex),
        }}
        toolbar={{
          buttons: [
            // Favorite Button
            <button
              key="favorite"
              type="button"
              className={`yarl__button ${isFavorite ? "!text-rose-400 !bg-white/15" : ""}`}
              title={
                isFavorite ? "Usuń z ulubionych (L)" : "Dodaj do ulubionych (L)"
              }
              disabled={!currentFile}
              onClick={() => {
                if (currentFile) toggleFav(currentFile.name);
              }}
            >
              <HeartIcon
                size={18}
                weight={isFavorite ? "fill" : "regular"}
                className={isFavorite ? "text-rose-400" : "text-neutral-300"}
              />
            </button>,

            // Copy Link
            <button
              key="copy"
              type="button"
              className="yarl__button"
              title="Kopiuj bezpośredni link"
              disabled={!currentFile}
              onClick={handleCopyLink}
            >
              {copied ? (
                <CheckIcon size={18} className="text-emerald-400" />
              ) : (
                <CopyIcon size={18} />
              )}
            </button>,

            // Download
            <button
              key="download"
              type="button"
              className="yarl__button"
              title="Pobierz plik"
              disabled={!currentFile}
              onClick={() => {
                if (currentFile) {
                  void downloadFile(currentFile.name);
                }
              }}
            >
              <DownloadSimpleIcon size={18} />
            </button>,

            // Info Details Drawer Toggle
            <button
              key="info"
              type="button"
              className={`yarl__button ${showInfo ? "!text-white !bg-white/20" : ""}`}
              title="Szczegóły pliku i metadane"
              onClick={() => setShowInfo((prev) => !prev)}
            >
              <InfoIcon size={18} />
            </button>,

            // Shortcuts Help Toggle
            <button
              key="shortcuts"
              type="button"
              className={`yarl__button ${showShortcuts ? "!text-white !bg-white/20" : ""}`}
              title="Skróty klawiszowe"
              onClick={() => setShowShortcuts((prev) => !prev)}
            >
              <QuestionIcon size={18} />
            </button>,

            "close",
          ],
        }}
        render={{
          slideHeader: () => (
            <div className="absolute top-4 left-6 z-20 pointer-events-none hidden sm:flex items-center gap-3">
              {/* Technical index badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/80 border border-white/10 backdrop-blur-md text-neutral-300 font-mono text-xs tabular-nums shadow-lg">
                <span className="text-white font-semibold">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-stone-500">/</span>
                <span className="text-stone-400">
                  {String(files.length).padStart(2, "0")}
                </span>
              </div>

              {/* Filename & Type badge */}
              {currentFile && (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/80 border border-white/10 backdrop-blur-md text-xs font-mono text-neutral-300 shadow-lg">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 uppercase tracking-widest text-neutral-200 font-semibold">
                    {currentFile.type === "video" ? "WIDEO" : "FOTO"}
                  </span>
                  <span className="truncate max-w-[200px] text-stone-200">
                    {currentFile.name}
                  </span>
                </div>
              )}
            </div>
          ),
        }}
      />

      {/* Copy link toast */}
      {copied && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full bg-neutral-900/95 border border-white/20 text-neutral-200 text-xs font-mono tracking-wider shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <CheckIcon size={14} className="text-emerald-400" />
          <span>LINK SKOPIOWANY DO SCHOWKA</span>
        </div>
      )}

      {/* Metadata / Info Drawer */}
      {open && showInfo && currentFile && (
        <div className="fixed top-20 right-6 z-[90] w-80 rounded-2xl bg-neutral-900/90 border border-white/15 backdrop-blur-2xl p-5 text-neutral-200 shadow-2xl ring-1 ring-black/40 text-xs font-mono animate-rise">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2 text-white font-semibold uppercase tracking-wider text-[11px]">
              <InfoIcon size={16} />
              <span>METADANE KADRU</span>
            </div>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-stone-400 hover:text-white"
            >
              <XIcon size={14} />
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-0.5">
                Nazwa pliku
              </span>
              <p className="text-stone-100 font-mono break-all">
                {currentFile.name}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-0.5">
                  Format
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-amber-300 uppercase">
                  {currentFile.mimeType ||
                    (currentFile.type === "video" ? "Wideo" : "Obraz")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-0.5">
                  Status
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-stone-300">
                  {isFavorite ? "♥ W Ulubionych" : "Standardowy"}
                </span>
              </div>
            </div>

            {formattedDate && (
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-0.5">
                  Data dodania
                </span>
                <div className="flex items-center gap-1.5 text-stone-200">
                  <CalendarBlankIcon size={14} className="text-stone-400" />
                  <span>{formattedDate}</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-white/10 flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 font-mono transition-colors"
              >
                <CopyIcon size={14} />
                <span>Kopiuj link</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile(currentFile.name)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-semibold font-mono transition-colors cursor-pointer"
              >
                <DownloadSimpleIcon size={14} />
                <span>Pobierz</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Guide Drawer */}
      {open && showShortcuts && (
        <div className="fixed top-20 right-6 z-[90] w-80 rounded-2xl bg-stone-900/90 border border-white/15 backdrop-blur-2xl p-5 text-stone-200 shadow-2xl ring-1 ring-black/40 text-xs font-mono animate-rise">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold uppercase tracking-wider text-[11px]">
              <QuestionIcon size={16} />
              <span>SKRÓTY KLAWISZOWE</span>
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-stone-400 hover:text-white"
            >
              <XIcon size={14} />
            </button>
          </div>

          <div className="space-y-2.5 text-stone-300">
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span>Poprzedni / Następny kadr</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-stone-100">
                ← / →
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span>Pokaz slajdów (Play/Pause)</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-stone-100">
                Spacja
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span>Pełny ekran</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-stone-100">
                F
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span>Dodaj do ulubionych</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-stone-100">
                L
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span>Przybliżenie (Zoom)</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-stone-100">
                Kółko myszy / 2x klik
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Zamknij podgląd</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-stone-100">
                ESC
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
