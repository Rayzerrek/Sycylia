"use client";

import {
  DownloadSimpleIcon,
  PlayIcon,
  HeartIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";
import GalleryLightbox from "@/components/gallery-lightbox";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";

import { downloadFile, fetchAllFiles, fetchFiles } from "@/lib/files";
import { matchesPhotoSearch } from "@/lib/photo-search";
import { useFavorites } from "@/lib/favorites";
import { GalleryHeader } from "@/components/gallery-header";
import { ControlDock } from "@/components/control-dock";
import Upload from "@/components/upload";

import type { FileEntry, Pagination } from "@/lib/files";
import type { Slide } from "yet-another-react-lightbox";

const PAGE_SIZE = 24;
const SKELETON_KEYS = [
  "sk-1",
  "sk-2",
  "sk-3",
  "sk-4",
  "sk-5",
  "sk-6",
  "sk-7",
  "sk-8",
];

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
};

const preloadedPreviews = new Set<string>();
const PRELOAD_CACHE_LIMIT = 200;

export interface GalleryProps {
  readonly className?: string;
}

export default function Gallery({ className }: GalleryProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [allFiles, setAllFiles] = useState<FileEntry[] | null>(null);
  const [index, setIndex] = useState(-1);
  const [autoPlaySlideshow, setAutoPlaySlideshow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const { isFav, toggle: toggleFav } = useFavorites();

  const filesRef = useRef(files);
  filesRef.current = files;
  const allFilesRef = useRef(allFiles);
  allFilesRef.current = allFiles;
  const indexRef = useRef(index);
  indexRef.current = index;

  const fetchedAllRef = useRef(false);
  const allFilesControllerRef = useRef<AbortController | null>(null);
  const lightboxOpenRef = useRef(false);

  const fetchPage = useCallback(
    async (page: number, replace: boolean, signal: AbortSignal) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError("");

      try {
        const { files: nextFiles, pagination: nextPagination } =
          await fetchFiles(page, PAGE_SIZE, signal);
        setFiles((prev) => (replace ? nextFiles : [...prev, ...nextFiles]));
        if (nextPagination) setPagination(nextPagination);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Fetch error:", err);
        setError("Nie udało się pobrać galerii. Spróbuj odświeżyć stronę.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchPage(1, true, controller.signal);
    return () => controller.abort();
  }, [fetchPage]);

  useEffect(() => () => allFilesControllerRef.current?.abort(), []);

  const loadAllFiles = useCallback(async (signal: AbortSignal) => {
    try {
      const all = await fetchAllFiles(signal);
      if (signal.aborted) return;
      const currentList = allFilesRef.current ?? filesRef.current;
      const currentName = currentList[indexRef.current]?.name;
      let nextIndex = indexRef.current;
      if (currentName !== undefined) {
        const found = all.findIndex((file) => file.name === currentName);
        if (found >= 0) nextIndex = found;
      }
      setError("");
      setAllFiles(all);
      if (indexRef.current >= 0) setIndex(nextIndex);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Fetch all files error:", err);
      fetchedAllRef.current = false;
      setError("Nie udało się przeszukać całej galerii. Spróbuj ponownie.");
    }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || allFiles !== null) {
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setError("");
    const timeout = window.setTimeout(() => {
      void loadAllFiles(controller.signal).finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, allFiles, loadAllFiles]);

  const loadNextPage = () => {
    if (loadingMore || !pagination.hasNextPage) return;
    void fetchPage(pagination.page + 1, false, new AbortController().signal);
  };

  const handleDownload = useCallback((fileName: string) => {
    void downloadFile(fileName);
  }, []);

  const handleUploaded = useCallback((file: FileEntry) => {
    setFiles((prev) =>
      prev.some((entry) => entry.name === file.name) ? prev : [file, ...prev],
    );
    setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
    allFilesControllerRef.current?.abort();
    setAllFiles(null);
    fetchedAllRef.current = false;
  }, []);

  const handleOpen = useCallback(
    (fileName: string, playSlideshow = false) => {
      const currentFiles = allFilesRef.current ?? filesRef.current;
      const lightboxIdx = currentFiles.findIndex(
        (file) => file.name === fileName,
      );
      if (lightboxIdx < 0) return;

      if (!lightboxOpenRef.current) {
        lightboxOpenRef.current = true;
        window.history.pushState({ lightbox: true }, "");
      }

      setAutoPlaySlideshow(playSlideshow);
      setIndex(lightboxIdx);

      if (allFilesRef.current === null && !fetchedAllRef.current) {
        fetchedAllRef.current = true;
        const controller = new AbortController();
        allFilesControllerRef.current = controller;
        void loadAllFiles(controller.signal);
      }
    },
    [loadAllFiles],
  );

  const handleClose = useCallback(() => {
    if (lightboxOpenRef.current) {
      lightboxOpenRef.current = false;
      window.history.back();
    }
    setIndex(-1);
    setAutoPlaySlideshow(false);
  }, []);

  useEffect(() => {
    if (index < 0) return;
    const handlePopState = () => {
      lightboxOpenRef.current = false;
      setIndex(-1);
      setAutoPlaySlideshow(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [index]);

  const lightboxFiles = allFiles ?? files;
  const slides: Slide[] = useMemo(
    () =>
      lightboxFiles.map((file) =>
        file.type === "video"
          ? {
              type: "video",
              sources: [
                {
                  src: file.previewUrl ?? file.url,
                  type: readVideoMimeType(file),
                },
              ],
            }
          : { src: file.previewUrl ?? file.url },
      ),
    [lightboxFiles],
  );

  const displayedFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    if (allFiles === null) return [];
    return allFiles.filter((file) => matchesPhotoSearch(file, searchQuery));
  }, [files, allFiles, searchQuery]);

  return (
    <div className={className}>
      {/* Minimalist Gallery Header */}
      <GalleryHeader totalCount={pagination.total || files.length} />

      {/* Sleek low-profile upload bar */}
      <div className="w-full">
        <Upload onUploaded={handleUploaded} />
      </div>

      {/* Minimalist Controls */}
      <ControlDock
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        slideshowDisabled={displayedFiles.length === 0}
        onStartSlideshow={() => {
          if (displayedFiles.length > 0) {
            const first = displayedFiles[0];
            handleOpen(first.name, true);
          }
        }}
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-mono text-center">
          {error}
        </div>
      )}

      <section aria-label="Galeria zdjęć">
        {loading || searching ? (
          <div className="columns-2 sm:columns-3 md:columns-4 gap-3 sm:gap-4">
            {SKELETON_KEYS.map((key, i) => (
              <div
                key={key}
                className={`skeleton-shimmer rounded-xl mb-3 sm:mb-4 break-inside-avoid ${
                  i % 3 === 0
                    ? "aspect-[3/4]"
                    : i % 2 === 0
                      ? "aspect-[4/3]"
                      : "aspect-square"
                }`}
              />
            ))}
          </div>
        ) : error ? null : files.length === 0 && !searchQuery.trim() ? (
          <div className="rounded-2xl border border-dashed border-rule bg-paper-card p-12 text-center shadow-xs">
            <p className="font-serif italic text-xl text-ink">
              Jeszcze tu pusto…
            </p>
            <p className="mt-2 text-xs font-mono text-ink-muted">
              Dodaj pierwsze zdjęcia i filmy powyżej.
            </p>
          </div>
        ) : displayedFiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rule bg-paper-card p-12 text-center shadow-xs">
            <p className="font-serif italic text-lg text-ink">
              Brak wyników wyszukiwania.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink text-paper text-xs font-mono tracking-wider cursor-pointer shadow-xs hover:opacity-90"
            >
              <ArrowCounterClockwiseIcon size={14} />
              <span>Wyczyść wyszukiwanie</span>
            </button>
          </div>
        ) : (
          <>
            {/* Main Gallery Grid */}
            <GalleryGrid
              files={displayedFiles}
              onOpen={handleOpen}
              onDownload={handleDownload}
              isFav={isFav}
              onToggleFavorite={toggleFav}
            />

            {/* Pagination Button */}
            {pagination.hasNextPage && !searchQuery && (
              <div className="flex justify-center pt-10 pb-6">
                <button
                  type="button"
                  onClick={loadNextPage}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-full border border-rule bg-paper-card hover:bg-paper text-ink px-7 py-3 font-mono text-xs tracking-wider uppercase transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  {loadingMore ? (
                    <>
                      <span className="size-3.5 border-2 border-ink-muted border-t-ink rounded-full animate-spin" />
                      <span>Ładowanie...</span>
                    </>
                  ) : (
                    <span>Pokaż więcej</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {index >= 0 && (
        <GalleryLightbox
          index={index}
          slides={slides}
          onClose={handleClose}
          onIndexChange={setIndex}
          autoPlaySlideshow={autoPlaySlideshow}
        />
      )}
    </div>
  );
}

function GalleryGrid({
  files,
  onOpen,
  onDownload,
  isFav,
  onToggleFavorite,
}: {
  readonly files: FileEntry[];
  readonly onOpen: (fileName: string) => void;
  readonly onDownload: (fileName: string) => void;
  readonly isFav: (fileName: string) => boolean;
  readonly onToggleFavorite: (fileName: string) => boolean;
}) {
  return (
    <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 sm:gap-3 lg:gap-4 space-y-2.5 sm:space-y-3 lg:space-y-4">
      {files.map((file, i) => {
        return (
          <div key={file.name} className="break-inside-avoid">
            <GalleryCard
              file={file}
              eager={i < 4}
              onOpen={onOpen}
              onDownload={onDownload}
              isFavorite={isFav(file.name)}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        );
      })}
    </div>
  );
}

const GalleryCard = memo(function GalleryCard({
  file,
  onOpen,
  onDownload,
  isFavorite,
  onToggleFavorite,
  eager,
}: {
  readonly file: FileEntry;
  readonly onOpen: (fileName: string) => void;
  readonly onDownload: (fileName: string) => void;
  readonly isFavorite: boolean;
  readonly onToggleFavorite: (fileName: string) => boolean;
  readonly eager: boolean;
}) {
  return (
    <div className="gallery-card relative group overflow-hidden rounded-lg bg-paper-muted">
      <button
        type="button"
        aria-label={`Otwórz ${file.type === "video" ? "film" : "zdjęcie"}`}
        className="cursor-pointer w-full h-full flex flex-col relative overflow-hidden"
        onPointerEnter={() => preloadPreview(file)}
        onFocus={() => preloadPreview(file)}
        onClick={() => onOpen(file.name)}
      >
        {file.type === "video" ? (
          <div className="relative w-full h-full overflow-hidden bg-neutral-900">
            {file.thumbUrl ? (
              // biome-ignore lint/performance/noImgElement: backend generates video posters
              <img
                src={file.thumbUrl}
                alt={file.name}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <VideoThumb
                src={file.previewUrl ?? file.url}
                fallbackSrc={file.url}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              />
            )}
            {/* Pure clean play icon with no darkening scrim */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                <PlayIcon
                  size={18}
                  weight="fill"
                  className="ml-0.5 text-white"
                />
              </span>
            </div>
          </div>
        ) : (
          // biome-ignore lint/performance/noImgElement: dynamic thumbnails from cloud backend
          <img
            src={file.thumbUrl ?? file.url}
            alt={file.name}
            className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.025]"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "auto" : "low"}
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.fallback === "1" || !file.url) return;
              el.dataset.fallback = "1";
              el.src = file.url;
            }}
          />
        )}
      </button>

      {/* Top Left: Subtle Favorite Heart Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(file.name);
        }}
        className={`absolute top-2 left-2 size-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 z-10 cursor-pointer ${
          isFavorite
            ? "bg-rose-500 text-white opacity-100 scale-100 shadow-sm"
            : "bg-black/30 hover:bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 hover:scale-110"
        }`}
        title={isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        aria-label={isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        aria-pressed={isFavorite}
      >
        <HeartIcon
          size={13}
          weight={isFavorite ? "fill" : "regular"}
          className={isFavorite ? "text-white" : ""}
        />
      </button>

      {/* Top Right: Subtle Download Button */}
      <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-200 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(file.name);
          }}
          className="size-7 bg-black/30 hover:bg-black/60 text-white rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
          title="Pobierz"
          aria-label="Pobierz plik"
        >
          <DownloadSimpleIcon size={13} />
        </button>
      </div>
    </div>
  );
});

function preloadPreview(file: FileEntry) {
  const previewUrl =
    file.type === "image" ? (file.previewUrl ?? file.url) : undefined;
  if (!previewUrl || preloadedPreviews.has(previewUrl)) return;

  if (preloadedPreviews.size >= PRELOAD_CACHE_LIMIT) {
    const oldest = preloadedPreviews.values().next().value;
    if (oldest !== undefined) preloadedPreviews.delete(oldest);
  }

  preloadedPreviews.add(previewUrl);
  const image = new Image();
  image.decoding = "async";
  image.src = previewUrl;
}

function VideoThumb({
  src,
  fallbackSrc,
  className = "",
}: {
  readonly src: string;
  readonly fallbackSrc: string | undefined;
  readonly className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.preload = "metadata";
            el.load();
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={`${src}#t=0.5`}
      className={className}
      muted
      preload="none"
      playsInline
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === "1" || !fallbackSrc) return;
        el.dataset.fallback = "1";
        el.src = `${fallbackSrc}#t=0.5`;
      }}
    />
  );
}

function readVideoMimeType(file: FileEntry): string {
  const mime = typeof file.mimeType === "string" ? file.mimeType : "";
  if (mime.startsWith("video/")) {
    if (mime === "video/quicktime") return "video/mp4";
    return mime;
  }
  if (/\.mov$/i.test(file.name)) return "video/mp4";
  if (/\.webm$/i.test(file.name)) return "video/webm";
  if (/\.3gp$/i.test(file.name)) return "video/3gpp";
  if (/\.3g2$/i.test(file.name)) return "video/3gpp2";
  if (/\.hevc$/i.test(file.name)) return "video/hevc";
  if (/\.h265$/i.test(file.name)) return "video/h265";
  if (/\.m4v$/i.test(file.name)) return "video/mp4";
  if (/\.mkv$/i.test(file.name)) return "video/x-matroska";
  return "video/mp4";
}
