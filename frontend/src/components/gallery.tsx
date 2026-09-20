"use client";

import { DownloadSimpleIcon, PlayIcon } from "@phosphor-icons/react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { downloadFile, fetchAllFiles, fetchFiles } from "@/lib/files";
import Upload from "@/components/upload";

import type { FileEntry, Pagination } from "@/lib/files";
import type { Slide } from "yet-another-react-lightbox";

const GalleryLightbox = dynamic(() => import("@/components/gallery-lightbox"), {
  ssr: false,
});

const PAGE_SIZE = 24;
const SKELETON_KEYS = [
  "gallery-skeleton-1",
  "gallery-skeleton-2",
  "gallery-skeleton-3",
  "gallery-skeleton-4",
  "gallery-skeleton-5",
  "gallery-skeleton-6",
  "gallery-skeleton-7",
  "gallery-skeleton-8",
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
function useRandomHighlights(files: FileEntry[], count: number = 5): FileEntry[] {
  // Losujemy na nowo przy każdym załadowaniu komponentu, żeby rotacja była widoczna od razu
  return useMemo(() => {
    if (files.length <= count) return files;
    const shuffled = [...files].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }, [files, count]);
}

export default function Gallery({ className }: GalleryProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  // Full metadata list loaded once for the lightbox so the viewer can swipe
  // through every photo; the grid keeps its own paginated `files`.
  const [allFiles, setAllFiles] = useState<FileEntry[] | null>(null);
  const [index, setIndex] = useState(-1);
  const [everOpened, setEverOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);

  // Mirrors of state used to remap the lightbox index when the paginated list
  // is swapped for the full list mid-view. Updated during render, like the
  // previous `slidesRef` pattern, so the async fetch reads the latest values.
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

  // Abort the all-files fetch if Gallery unmounts mid-load.
  useEffect(() => () => allFilesControllerRef.current?.abort(), []);

  const loadAllFiles = useCallback(async (signal: AbortSignal) => {
    try {
      const all = await fetchAllFiles(signal);
      // Remap the currently-shown slide to its position in the full list so the
      // viewer does not jump when the paginated list is swapped for the full one.
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
      // The paginated list keeps the lightbox usable; just log the failure.
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
    // A new upload invalidates the cached full list; reload it on next open.
    allFilesControllerRef.current?.abort();
    setAllFiles(null);
    fetchedAllRef.current = false;
  }, []);

  const handleOpen = useCallback(
    (i: number) => {
      const targetName = filesRef.current[i]?.name;
      let lightboxIdx = i;
      if (allFilesRef.current && targetName !== undefined) {
        const found = allFilesRef.current.findIndex(
          (file) => file.name === targetName,
        );
        if (found >= 0) lightboxIdx = found;
      }

      // Push the history entry synchronously inside the click gesture. WebKit
      // (iOS Safari, Chrome on iOS) skips pushState entries created outside of
      // user interaction when navigating back, so pushing it from an effect
      // makes the back button leave the page instead of closing the lightbox.
      if (!lightboxOpenRef.current) {
        lightboxOpenRef.current = true;
        window.history.pushState({ lightbox: true }, "");
      }

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

  // Manual close (X / backdrop / Escape): consume the entry pushed on open so
  // a later back press doesn't pop a stale state.
  const handleClose = useCallback(() => {
    if (lightboxOpenRef.current) {
      lightboxOpenRef.current = false;
      window.history.back();
    }
    setIndex(-1);
  }, []);

  // Browser back button/gesture while the lightbox is open: close it instead
  // of leaving the page.
  useEffect(() => {
    if (index < 0) return;
    const handlePopState = () => {
      lightboxOpenRef.current = false;
      setIndex(-1);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [index]);

  // The lightbox browses the full list (loaded once, on first open) so the
  // viewer can swipe past the currently paginated grid page. Until that load
  // resolves it falls back to the paginated list, which still covers the page
  // the user clicked into.
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

  return (
    <div className={className}>
      <div className="mx-auto w-full sm:w-1/2">
        <Upload onUploaded={handleUploaded} />
      </div>

      {error && <p className="mt-4 text-center text-red-700">{error}</p>}

      <section aria-label="Wspomnienia">

        {loading ? (
          <div className="columns-2 sm:columns-3 md:columns-4 gap-3 sm:gap-4">
            {SKELETON_KEYS.map((key, i) => (
              <div
                key={key}
                className={`skeleton-shimmer rounded-2xl mb-3 sm:mb-4 break-inside-avoid ${i % 3 === 0 ? 'aspect-[3/4]' : i % 2 === 0 ? 'aspect-[4/3]' : 'aspect-square'}`}
              />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-terra-300 bg-white/50 px-6 py-12 text-center backdrop-blur">
            <p className="font-display text-xl italic text-terra-700">
              Jeszcze tu pusto…
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Dodaj pierwsze zdjęcie powyżej i zacznij album.
            </p>
          </div>
        ) : (
          <>
            {files.length > 0 && (
              <div className="mb-16">
                <h2 className="mb-8 text-2xl font-display font-medium tracking-tight text-terra-900 flex items-center justify-between">
                  <span>Wyróżnione z galerii</span>
                </h2>
                <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-8 snap-x snap-mandatory px-4 sm:px-0 -mx-4 sm:mx-0 [scrollbar-width:thin] [scrollbar-color:theme(colors.terra.300)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-terra-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {useRandomHighlights(files).map((file) => {
                    const i = files.findIndex((f) => f.name === file.name);
                    return (
                      <div
                        key={file.name}
                        className="shrink-0 snap-center w-[75vw] sm:w-[45vw] md:w-[35vw] lg:w-[400px]"
                      >
                        <GalleryCard
                          file={file}
                          index={i}
                          onOpen={handleOpen}
                          onDownload={handleDownload}
                          className="aspect-[4/3] sm:aspect-[16/10]"
                          mediaClassName="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-8 mb-16 flex items-center justify-center">
                  <div className="h-px w-full max-w-2xl bg-terra-900/5"></div>
                </div>
              </div>
            )}
            <GalleryGrid
              files={files}
              onOpen={handleOpen}
              onDownload={handleDownload}
            />

            {pagination.hasNextPage && (
              <div className="flex justify-center pt-8">
                <button
                  type="button"
                  onClick={loadNextPage}
                  disabled={loadingMore}
                  className="rounded-full bg-gradient-to-r from-amber-500 to-terra-500 px-8 py-3 font-medium text-white shadow-lg shadow-terra-500/30 transition-all duration-200 hover:-translate-y-px hover:from-amber-500 hover:to-terra-600 hover:shadow-xl hover:shadow-terra-500/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {loadingMore ? "Ładowanie..." : "Pokaż więcej"}
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
          />
        </Suspense>
      )}
    </div>
  );
}

function GalleryCard({
  file,
  index,
  onOpen,
  onDownload,
  className = "",
  mediaClassName = "",
}: {
  readonly file: FileEntry;
  readonly index: number;
  readonly onOpen: (i: number) => void;
  readonly onDownload: (fileName: string) => void;
  readonly className?: string;
  readonly mediaClassName?: string;
}) {
  return (
    <div className={`relative group ${className}`}>
      <button
        type="button"
        aria-label={`Otwórz ${file.type === "video" ? "film" : "zdjęcie"}`}
        className="overflow-hidden cursor-pointer rounded-md w-full h-full flex flex-col bg-terra-100/50 ring-1 ring-terra-900/5 transition-all duration-500 hover:ring-terra-900/20"
        onPointerEnter={() => preloadPreview(file)}
        onFocus={() => preloadPreview(file)}
        onClick={() => onOpen(index)}
      >
        {file.type === "video" ? (
          <div className="relative w-full h-full overflow-hidden">
            <VideoThumb
              src={file.previewUrl ?? file.url}
              fallbackSrc={file.url}
              className={mediaClassName}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-terra-950/50 via-transparent to-transparent">
              <span className="flex size-14 items-center justify-center rounded-full bg-white/85 shadow-lg backdrop-blur transition-transform duration-300 group-hover:scale-110">
                <PlayIcon
                  size={26}
                  weight="fill"
                  className="ml-0.5 text-terra-600"
                />
              </span>
            </div>
          </div>
        ) : (
          // biome-ignore lint/performance/noImgElement: thumbnails come from opaque backend URLs
          <img
            src={file.thumbUrl ?? file.url}
            alt=""
            className={mediaClassName}
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 4 ? "high" : "low"}
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.fallback === "1" || !file.url) return;
              el.dataset.fallback = "1";
              el.src = file.url;
            }}
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => onDownload(file.name)}
        className="absolute top-3 right-3 p-2.5 bg-white/70 text-terra-900 rounded-full shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-white hover:scale-105 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 z-10"
        title="Pobierz"
        aria-label="Pobierz plik"
      >
        <DownloadSimpleIcon size={18} weight="light" />
      </button>
    </div>
  );
}
function GalleryGrid({
  files,
  onOpen,
  onDownload,
}: {
  readonly files: FileEntry[];
  readonly onOpen: (i: number) => void;
  readonly onDownload: (fileName: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
      {files.map((file, i) => (
        <GalleryCard
          key={file.name}
          file={file}
          index={i}
          onOpen={onOpen}
          onDownload={onDownload}
          className="aspect-[4/5] sm:aspect-square md:aspect-[3/4]"
          mediaClassName="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      ))}
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

  // Load metadata only once the element approaches the viewport. `preload` is
  // driven by visibility instead of list index, so prepending a new upload no
  // longer flips already-rendered videos back to `preload="none"` and dropping
  // their displayed frame.
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

  // `#t=0.5` makes the browser seek to 0.5s and show that frame as the poster
  // once metadata is available, instead of a black rectangle.
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
    // iPhone `.mov` (QuickTime container) frequently holds H.264 that every
    // browser can play, but `canPlayType("video/quicktime")` returns "" in
    // Chrome/Firefox, so the lightbox video plugin refuses to load the source.
    // Remap to `video/mp4` (same ISO-BMFF container) so playback is actually
    // attempted. HEVC-in-mov stays undecodable regardless of label; that case
    // is handled by upload-side conversion in `lib/convert.ts`.
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
