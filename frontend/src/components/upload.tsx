"use client";

import { UploadSimpleIcon, CheckCircleIcon } from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type DragEvent,
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
import { decodeFileEntry, type FileEntry } from "@/lib/files";

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadActiveRef = useRef(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (justCompletedCount === null) return;
    const timeout = window.setTimeout(() => setJustCompletedCount(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [justCompletedCount]);

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
    if (uploadActiveRef.current) return;
    const valid = fileList.filter(isAcceptedFile);
    if (valid.length === 0) {
      if (fileList.length) {
        setError(
          "Dozwolone są tylko zdjęcia (JPG, PNG, WebP, GIF, HEIC, AVIF, BMP, TIFF) oraz filmy (MP4, MOV, WebM, 3GP, 3G2, HEVC, M4V, MKV).",
        );
      }
      return;
    }

    const skipped = Math.max(0, valid.length - maxFiles);
    const files = valid.slice(0, maxFiles);

    uploadActiveRef.current = true;
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

    uploadActiveRef.current = false;
    setUploading(false);

    if (successCount > 0) {
      setJustCompletedCount(successCount);
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
    dragDepthRef.current = 0;
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
    <section className="upload-section" aria-label="Dodawanie zdjęć i filmów">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard users have the file picker button. */}
      <div
        className={dragOver ? "upload-zone upload-zone-active" : "upload-zone"}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          if (!uploadActiveRef.current) setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = uploadActiveRef.current
            ? "none"
            : "copy";
        }}
        onDragLeave={() => {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDragOver(false);
        }}
        onDrop={handleDrop}
      >
        <div className="upload-symbol" aria-hidden="true">
          <UploadSimpleIcon size={24} weight="light" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-medium tracking-tight">
            {uploading
              ? "Dodawanie plików"
              : dragOver
                ? "Upuść pliki tutaj"
                : "Dodaj do galerii"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {uploading
              ? "Plik " +
                currentFileIdx +
                " z " +
                totalFilesCount +
                " · " +
                progress +
                "%"
              : "Przeciągnij zdjęcia i filmy lub wybierz je z urządzenia."}
          </p>
          <p
            className={
              uploading
                ? "mt-2 text-xs text-ink-muted truncate"
                : "mt-2 text-xs text-ink-muted"
            }
          >
            {uploading
              ? currentFileName
              : "JPG, PNG, HEIC, MP4, MOV i inne · do " +
                maxFiles +
                " plików naraz"}
          </p>
        </div>
        <button
          type="button"
          className="upload-button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Przesyłanie…" : "Wybierz pliki"}
          <span aria-hidden="true">↗</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttribute}
          className="hidden"
          multiple
          disabled={uploading}
          onChange={handleFileSelect}
        />
        {uploading && (
          <progress
            className="upload-progress"
            value={progress}
            max={100}
            aria-label="Postęp przesyłania"
          />
        )}
      </div>
      <div aria-live="polite" className="upload-feedback">
        {justCompletedCount !== null && !uploading && (
          <p className="flex items-center gap-2 text-sm text-ink">
            <CheckCircleIcon size={18} /> Dodano {justCompletedCount}{" "}
            {justCompletedCount === 1 ? "plik" : "plików"} do galerii.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-ink-muted">{notice}</p>}
      </div>
    </section>
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

  const { uploadUrl, headers, storageName } = decodeUploadInitiation(
    await initRes.json(),
  );

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

  const entry = decodeFileEntry(await finRes.json());
  if (!entry) throw new Error("Invalid upload finalization response");
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

function decodeUploadInitiation(value: unknown): {
  uploadUrl: string;
  storageName: string;
  headers: Record<string, string>;
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("uploadUrl" in value) ||
    typeof value.uploadUrl !== "string" ||
    !("storageName" in value) ||
    typeof value.storageName !== "string"
  ) {
    throw new Error("Invalid upload initiation response");
  }
  const headers: Record<string, string> = {};
  if ("headers" in value && value.headers !== undefined) {
    if (typeof value.headers !== "object" || value.headers === null) {
      throw new Error("Invalid upload initiation headers");
    }
    for (const [key, header] of Object.entries(value.headers)) {
      if (typeof header !== "string")
        throw new Error("Invalid upload initiation header");
      headers[key] = header;
    }
  }
  return {
    uploadUrl: value.uploadUrl,
    storageName: value.storageName,
    headers,
  };
}
