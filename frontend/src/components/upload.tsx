"use client";

import {
  UploadSimpleIcon,
  BellIcon,
  BellRingingIcon,
  CheckCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { apiUrl } from "@/lib/api";
import {
  VideoConversionError,
  needsImageConversion,
  needsVideoConversion,
  prepareFileForUpload,
} from "@/lib/convert";
import type { FileEntry, FileEntryType } from "@/lib/files";

const acceptAttribute = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "video/3gpp2",
  "video/hevc",
  ".hevc",
  ".h265",
  "video/mp4v-es",
  ".m4v",
  "video/x-matroska",
  ".mkv",
].join(",");

const acceptedExtension =
  /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?|mp4|mov|webm|3gp|3g2|hevc|h265|m4v|mkv)$/i;

const maxFiles = 100;
const genericContentType = "application/octet-stream";

interface InitiateResponse {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  storageName: string;
  mimeType: string;
  type: FileEntryType;
  expiresInSeconds: number;
}

export interface UploadProps {
  readonly onUploaded?: (file: FileEntry) => void;
}

export default function Upload({ onUploaded }: UploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIdx, setCurrentFileIdx] = useState(0);
  const [totalFilesCount, setTotalFilesCount] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [justCompletedCount, setJustCompletedCount] = useState<number | null>(
    null,
  );
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(() => {
      if (typeof window !== "undefined" && "Notification" in window) {
        return Notification.permission;
      }
      return "default";
    });

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Request notification permissions
  const requestNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    } catch {
      // ignore
    }
  }, []);

  // Beforeunload protection while uploads are running
  useEffect(() => {
    if (!uploading) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "Trwa przesyłanie plików w tle. Czy na pewno chcesz opuścić stronę?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploading]);

  // Dynamic tab title while uploading
  useEffect(() => {
    if (!uploading) return;
    const prevTitle = document.title;
    document.title = `(${progress}%) Przesyłanie (${currentFileIdx}/${totalFilesCount}) · Galeria zdjęć`;
    return () => {
      document.title = prevTitle;
    };
  }, [uploading, progress, currentFileIdx, totalFilesCount]);

  const handleFiles = async (fileList: File[]) => {
    const valid = fileList.filter(isAcceptedFile);
    if (valid.length === 0) {
      if (fileList.length) {
        setError(
          "Dozwolone są tylko zdjęcia (JPG, PNG, WebP, GIF, HEIC, AVIF, BMP, TIFF) oraz filmy (MP4, MOV, WebM, 3GP, 3G2, HEVC, M4V, MKV).",
        );
      }
      return;
    }

    // Auto-request notifications if default so user gets alerted on completion
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      void requestNotifications();
    }

    const skipped = Math.max(0, valid.length - maxFiles);
    const files = valid.slice(0, maxFiles);

    setUploading(true);
    setProgress(0);
    setError("");
    setNotice("");
    setJustCompletedCount(null);
    setTotalFilesCount(files.length);

    const total = files.length;
    let failures = 0;
    let successCount = 0;
    let conversionSkipped = 0;
    let conversionMessage = "";
    const conversionWeight = 0.4;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      setCurrentFileIdx(i + 1);
      setCurrentFileName(file.name);

      const baseFrac = i / total;
      const fileSpan = 1 / total;
      const willConvert =
        needsImageConversion(file) || needsVideoConversion(file);
      const fileConversionWeight = willConvert ? conversionWeight : 0;
      const fileUploadWeight = 1 - fileConversionWeight;

      try {
        let prepared: File;
        try {
          prepared = await prepareFileForUpload(file, (frac) => {
            setProgress(
              Math.round(
                (baseFrac + frac * fileConversionWeight * fileSpan) * 100,
              ),
            );
          });
        } catch (convErr) {
          if (convErr instanceof VideoConversionError) {
            console.error("Video conversion failed, skipping:", convErr);
            conversionSkipped += 1;
            if (!conversionMessage) conversionMessage = convErr.message;
            failures += 1;
            setProgress(Math.round(((i + 1) / total) * 100));
            continue;
          }
          console.error("Conversion failed, sending original:", convErr);
          prepared = file;
        }

        const entry = await uploadOne(prepared, (frac) => {
          setProgress(
            Math.round(
              (baseFrac +
                (fileConversionWeight + frac * fileUploadWeight) * fileSpan) *
                100,
            ),
          );
        });
        successCount += 1;
        onUploaded?.(entry);
      } catch (err) {
        console.error("Upload error:", err);
        failures += 1;
        setProgress(Math.round(((i + 1) / total) * 100));
      }
    }

    setUploading(false);

    if (successCount > 0) {
      setJustCompletedCount(successCount);

      // Trigger desktop notification if tab is in background or permission granted
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("Przesyłanie zakończone! 📸", {
            body: `Pomyślnie wysłano ${successCount} ${
              successCount === 1 ? "plik" : "plików"
            } do galerii zdjęć.`,
            icon: "/favicon.ico",
          });
        } catch {
          // notification failed
        }
      }

      // Auto-dismiss the completed pill after 5 seconds
      setTimeout(() => {
        setJustCompletedCount(null);
      }, 5000);
    }

    if (conversionSkipped > 0) {
      setError(
        conversionMessage +
          (conversionSkipped > 1
            ? ` (pominięto ${conversionSkipped} filmów)`
            : ""),
      );
    } else if (failures > 0) {
      setError("Nie udało się wysłać części plików. Spróbuj ponownie.");
    }
    if (skipped > 0) {
      setNotice(
        `Wysłano ${files.length} z ${valid.length} plików. Pozostałe ${skipped} przekracza limit ${maxFiles} plików na raz — wyślij je w kolejnej partii.`,
      );
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
    void handleFiles(dropped);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? [...e.target.files] : [];
    void handleFiles(selected);
    e.target.value = "";
  };

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: file dropzone — keyboard users get the equivalent button + file input below. */}
      <div
        className={`relative flex items-center justify-between gap-4 rounded-xl border border-dashed p-3 sm:px-5 sm:py-3.5 transition-all duration-200 group ${
          dragOver
            ? "border-ink bg-paper scale-[1.005] shadow-xs"
            : "border-rule bg-paper-card/70 hover:bg-paper-card hover:border-rule-strong"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          // biome-ignore lint/a11y/useSemanticElements: live region for upload progress
          <div
            className="flex items-center justify-between gap-4 w-full py-1 text-xs font-mono"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-ink" />
              </span>
              <div className="truncate">
                <span className="font-semibold text-ink">
                  Wysyłanie [{currentFileIdx}/{totalFilesCount}]
                </span>
                <span className="text-ink-muted ml-2 truncate hidden sm:inline">
                  {currentFileName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="w-24 sm:w-36 h-1.5 rounded-full bg-paper border border-rule overflow-hidden">
                <div
                  className="h-full bg-ink transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="tabular-nums font-semibold text-ink text-xs w-9 text-right">
                {progress}%
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-rule bg-paper text-ink transition-transform duration-200 group-hover:scale-105">
                <UploadSimpleIcon size={15} weight="regular" />
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-medium text-ink truncate">
                  Przeciągnij zdjęcia lub filmy tutaj
                </p>
                <p className="text-[11px] font-mono text-ink-muted truncate">
                  JPG, PNG, HEIC, MP4, MOV · do {maxFiles} plików
                </p>
              </div>
            </div>

            <button
              type="button"
              className="shrink-0 flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-mono tracking-wider text-paper transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-xs"
              onClick={() => inputRef.current?.click()}
            >
              <UploadSimpleIcon size={13} weight="bold" />
              <span>Wybierz pliki</span>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept={acceptAttribute}
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
          </>
        )}
        {error && (
          <p className="mt-4 text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-sm">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 text-xs font-mono text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 max-w-sm">
            {notice}
          </p>
        )}
      </div>

      {/* Floating Background Upload Dock (Active while scrolling anywhere on the page) */}
      {uploading && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-md rounded-2xl bg-neutral-900/95 border border-white/15 p-4 text-neutral-100 shadow-2xl backdrop-blur-2xl ring-1 ring-black/40 text-xs font-mono animate-rise">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              <span className="font-semibold text-neutral-100">
                WYSYŁANIE W TLE [{currentFileIdx}/{totalFilesCount}]
              </span>
            </div>

            <div className="flex items-center gap-2">
              {notificationPermission !== "granted" ? (
                <button
                  type="button"
                  onClick={requestNotifications}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-amber-300 text-[10px] tracking-wider transition-colors cursor-pointer"
                  title="Włącz powiadomienie, gdy pliki zostaną wysłane"
                >
                  <BellIcon size={12} />
                  <span>POWIADOM MNIE</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-stone-400">
                  <BellRingingIcon size={12} className="text-amber-400" />
                  <span>POWIADOMIENIE AKTYWNE</span>
                </span>
              )}
              <span className="text-amber-400 font-bold tabular-nums">
                {progress}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-2 text-[10px] text-stone-400 truncate">
            Plik: {currentFileName}
          </p>
        </div>
      )}

      {/* Floating Just Completed Notification Toast */}
      {justCompletedCount !== null && !uploading && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-stone-900/95 border border-emerald-500/40 text-stone-100 shadow-2xl backdrop-blur-2xl ring-1 ring-black/40 text-xs font-mono animate-rise">
          <CheckCircleIcon
            size={18}
            weight="fill"
            className="text-emerald-400 shrink-0"
          />
          <div>
            <p className="font-semibold text-emerald-300">
              PRZESYŁANIE ZAKOŃCZONE!
            </p>
            <p className="text-[10px] text-stone-400">
              Pomyślnie dodano {justCompletedCount} wspomnień do galerii.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setJustCompletedCount(null)}
            className="ml-2 p-1 rounded hover:bg-white/10 text-stone-400 hover:text-white"
          >
            <XIcon size={14} />
          </button>
        </div>
      )}
    </>
  );
}

function isAcceptedFile(file: File): boolean {
  return acceptedExtension.test(file.name);
}

async function uploadOne(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<FileEntry> {
  const initRes = await fetch(apiUrl("/upload/initiate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || genericContentType,
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new Error(
      `Initiate failed: ${initRes.status} ${initRes.statusText} ${text}`,
    );
  }

  const { uploadUrl, headers, storageName } =
    (await initRes.json()) as InitiateResponse;

  await putToStorage(uploadUrl, file, headers ?? {}, onProgress);

  const finRes = await fetch(apiUrl("/upload/finalize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storageName,
    }),
  });

  if (!finRes.ok) {
    const text = await finRes.text().catch(() => "");
    throw new Error(
      `Finalize failed: ${finRes.status} ${finRes.statusText} ${text}`,
    );
  }

  const rawEntry = (await finRes.json()) as Record<string, unknown>;
  const entry: FileEntry = {
    name: typeof rawEntry.name === "string" ? rawEntry.name : storageName,
    url: typeof rawEntry.url === "string" ? rawEntry.url : "",
    thumbUrl:
      typeof rawEntry.thumbUrl === "string" ? rawEntry.thumbUrl : undefined,
    previewUrl:
      typeof rawEntry.previewUrl === "string" ? rawEntry.previewUrl : undefined,
    mimeType:
      typeof rawEntry.mimeType === "string" ? rawEntry.mimeType : undefined,
    type: rawEntry.type === "video" ? "video" : "image",
    createdAt:
      typeof rawEntry.createdAt === "string"
        ? rawEntry.createdAt
        : new Date().toISOString(),
  };
  return entry;
}

function putToStorage(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const xhr = new XMLHttpRequest();
  xhr.open("PUT", url);

  for (const [k, v] of Object.entries(headers)) {
    xhr.setRequestHeader(k, v);
  }
  if (!headers["Content-Type"]) {
    xhr.setRequestHeader("Content-Type", file.type || genericContentType);
  }

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable && e.total > 0) {
      onProgress(e.loaded / e.total);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      onProgress(1);
      resolve();
    } else {
      reject(
        new Error(
          `Storage PUT failed: ${xhr.status} ${xhr.statusText} ${xhr.responseText}`,
        ),
      );
    }
  };

  xhr.onerror = () => {
    reject(new Error("Storage PUT network error"));
  };

  xhr.send(file);
  return promise;
}
