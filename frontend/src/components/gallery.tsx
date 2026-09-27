"use client";

import {
  DownloadSimpleIcon,
  PlayIcon,
  HeartIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";

import { downloadFile, fetchAllFiles, fetchFiles } from "@/lib/files";
import { useFavorites } from "@/lib/favorites";
import { GalleryHeader } from "@/components/gallery-header";
import { ControlDock } from "@/components/control-dock";
import type { ViewMode, SortMode } from "@/components/control-dock";
import Upload from "@/components/upload";

import type { FileEntry, Pagination } from "@/lib/files";
import type { Slide } from "yet-another-react-lightbox";

const GalleryLightbox = dynamic(() => import("@/components/gallery-lightbox"), {
  ssr: false,
});

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
  const [everOpened, setEverOpened] = useState(false);
  const [autoPlaySlideshow, setAutoPlaySlideshow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);

  // Minimalist view & sort controls
  const [viewMode, setViewMode] = useState<ViewMode>("editorial");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [searchQuery, setSearchQuery] = useState("");

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
      const currentList = allFilesRef.current ?? filesRef.current;
      const currentName = currentList[indexRef.current]?.name;
      let nextIndex = indexRef.current;
      if (currentName !== undefined) {
        const found = all.findIndex((file) => file.name === currentName);
        if (found >= 0) nextIndex = found;
      }
      setAllFiles(all);
      if (indexRef.current >= 0) setIndex(nextIndex);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Fetch all files error:", err);
    }
  }, []);

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
    (i: number, playSlideshow = false) => {
      const targetName = filesRef.current[i]?.name;
      let lightboxIdx = i;
      if (allFilesRef.current && targetName !== undefined) {
        const found = allFilesRef.current.findIndex(
          (file) => file.name === targetName,
        );
        if (found >= 0) lightboxIdx = found;
      }

      if (!lightboxOpenRef.current) {
        lightboxOpenRef.current = true;
        window.history.pushState({ lightbox: true }, "");
      }

      setAutoPlaySlideshow(playSlideshow);
      setIndex(lightboxIdx);
      setEverOpened(true);

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

  // Search and sort the displayed gallery items
  const displayedFiles = useMemo(() => {
    let result = [...files];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((f) => {
        const nameMatch = f.name.toLowerCase().includes(q);
        const dateMatch = f.createdAt?.toLowerCase().includes(q);
        return nameMatch || dateMatch;
      });
    }

    // Sort
    if (sortMode === "oldest") {
      result.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return da - db;
      });
    } else if (sortMode === "newest") {
      result.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    } else if (sortMode === "random") {
      result.sort((a, b) => {
        const ha = a.name
          .split("")
          .reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hb = b.name
          .split("")
          .reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return (ha % 17) - (hb % 17);
      });
    }

    return result;
  }, [files, searchQuery, sortMode]);

  return (
    <div className={className}>
      {/* Minimalist Gallery Header */}
      <GalleryHeader totalCount={pagination.total || files.length} />

      {/* Sleek low-profile upload bar */}
      <div className="mb-6 w-full">
        <Upload onUploaded={handleUploaded} />
      </div>

      {/* Minimalist Controls */}
      <ControlDock
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onStartSlideshow={() => {
          if (displayedFiles.length > 0) {
            const first = displayedFiles[0];
            const originalIndex = files.findIndex((f) => f.name === first.name);
            handleOpen(originalIndex >= 0 ? originalIndex : 0, true);
          }
        }}
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-mono text-center">
          {error}
        </div>
      )}

      <section aria-label="Galeria zdjęć">
        {loading ? (
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
        ) : files.length === 0 ? (
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
              originalFiles={files}
              onOpen={handleOpen}
              onDownload={handleDownload}
              isFav={isFav}
              onToggleFavorite={toggleFav}
              viewMode={viewMode}
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

      {everOpened && (
        <Suspense fallback={null}>
          <GalleryLightbox
            open={index >= 0}
            index={index}
            files={lightboxFiles}
            slides={slides}
            onClose={handleClose}
            onIndexChange={setIndex}
            autoPlaySlideshow={autoPlaySlideshow}
          />
        </Suspense>
      )}
    </div>
  );
}

function GalleryGrid({
  files,
  originalFiles,
  onOpen,
  onDownload,
  isFav,
  onToggleFavorite,
  viewMode,
}: {
  readonly files: FileEntry[];
  readonly originalFiles: FileEntry[];
  readonly onOpen: (i: number) => void;
  readonly onDownload: (fileName: string) => void;
  readonly isFav: (fileName: string) => boolean;
  readonly onToggleFavorite: (fileName: string) => boolean;
  readonly viewMode: ViewMode;
}) {
  if (viewMode === "showcase") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {files.map((file, i) => {
          const origIdx = originalFiles.findIndex((f) => f.name === file.name);
          return (
            <GalleryCard
              key={file.name}
              file={file}
              index={origIdx >= 0 ? origIdx : i}
              onOpen={onOpen}
              onDownload={onDownload}
              isFavorite={isFav(file.name)}
              onToggleFavorite={onToggleFavorite}
              aspectRatioClass="aspect-[16/10]"
            />
          );
        })}
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
        {files.map((file, i) => {
          const origIdx = originalFiles.findIndex((f) => f.name === file.name);
          return (
            <GalleryCard
              key={file.name}
              file={file}
              index={origIdx >= 0 ? origIdx : i}
              onOpen={onOpen}
              onDownload={onDownload}
              isFavorite={isFav(file.name)}
              onToggleFavorite={onToggleFavorite}
              aspectRatioClass="aspect-square"
            />
          );
        })}
      </div>
    );
  }

  // "editorial" mode: True CSS column masonry with uncropped natural photo ratios
  return (
    <div className="columns-2 sm:columns-3 md:columns-4 gap-2.5 sm:gap-3 lg:gap-4 space-y-2.5 sm:space-y-3 lg:space-y-4">
      {files.map((file, i) => {
        const origIdx = originalFiles.findIndex((f) => f.name === file.name);
        return (
          <div key={file.name} className="break-inside-avoid">
            <GalleryCard
              file={file}
              index={origIdx >= 0 ? origIdx : i}
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

function GalleryCard({
  file,
  index,
  onOpen,
  onDownload,
  isFavorite,
  onToggleFavorite,
  aspectRatioClass = "",
}: {
  readonly file: FileEntry;
  readonly index: number;
  readonly onOpen: (i: number) => void;
  readonly onDownload: (fileName: string) => void;
  readonly isFavorite: boolean;
  readonly onToggleFavorite: (fileName: string) => boolean;
  readonly aspectRatioClass?: string;
}) {
  return (
    <div
      className={`relative group overflow-hidden rounded-xl border border-rule bg-paper-card shadow-2xs transition-all duration-300 hover:shadow-md hover:border-rule-strong ${aspectRatioClass}`}
    >
      <button
        type="button"
        aria-label={`Otwórz ${file.type === "video" ? "film" : "zdjęcie"}`}
        className="cursor-pointer w-full h-full flex flex-col relative overflow-hidden"
        onPointerEnter={() => preloadPreview(file)}
        onFocus={() => preloadPreview(file)}
        onClick={() => onOpen(index)}
      >
        {file.type === "video" ? (
          <div className="relative w-full h-full overflow-hidden bg-neutral-900">
            <VideoThumb
              src={file.previewUrl ?? file.url}
              fallbackSrc={file.url}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
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
            alt=""
            className="w-full h-auto object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            loading={index < 8 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 8 ? "high" : "low"}
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
            : "bg-black/30 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:scale-110"
        }`}
        title={isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        aria-label="Polub kadr"
      >
        <HeartIcon
          size={13}
          weight={isFavorite ? "fill" : "regular"}
          className={isFavorite ? "text-white" : ""}
        />
      </button>

      {/* Top Right: Subtle Download Button */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
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
}

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
