"use client";

import { UploadSimpleIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { apiUrl } from "@/lib/api";

import {
  VideoConversionError,
  needsImageConversion,
  needsVideoConversion,
  prepareFileForUpload,
} from "@/lib/convert";

import type { ChangeEvent, DragEvent } from "react";
import type { FileEntry, FileEntryType } from "@/lib/files";

/**
 * Direct-to-storage upload flow.
 *
 * The backend only signs a PUT URL (`/upload/initiate`) and reads back
 * metadata (`/upload/finalize`); the file body is streamed straight from the
 * browser to the object storage, so it never transits the backend.
 *
 * iPhone HEIC photos and HEVC/MOV videos are converted in the browser to
 * JPEG/MP4 (H.264) before upload (see `lib/convert.ts`), so every browser can
 * display them and decode a thumbnail frame.
 */

const acceptAttribute = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".avif",
  ".bmp",
  ".tiff",
  ".tif",
  ".mp4",
  ".mov",
  ".webm",
  ".3gp",
  ".3g2",
  ".hevc",
  ".h265",
  ".m4v",
  ".mkv",
].join(",");

const acceptedExtension =
  /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?|mp4|mov|webm|3gp|3g2|hevc|h265|m4v|mkv)$/i;

const maxFiles = 100;
const genericContentType = "application/octet-stream";

interface InitiateResponse {
  readonly uploadUrl: string;
  readonly method: "PUT";
  readonly headers: Record<string, string>;
  readonly storageName: string;
  readonly mimeType: string;
  readonly type: FileEntryType;
  readonly expiresInSeconds: number;
}

interface FinalizeResponse {
  readonly success: true;
  readonly name: string;
  readonly fileName: string;
  readonly url: string;
  readonly thumbUrl: string | undefined;
  readonly previewUrl: string | undefined;
  readonly mimeType: string;
  readonly type: FileEntryType;
  readonly createdAt: string;
}

export interface UploadProps {
  readonly onUploaded?: (file: FileEntry) => void;
}

export default function Upload({ onUploaded }: UploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

    const skipped = Math.max(0, valid.length - maxFiles);
    const files = valid.slice(0, maxFiles);

    setUploading(true);
    setProgress(0);
    setError("");
    setNotice("");

    const total = files.length;
    let failures = 0;
    let conversionSkipped = 0;
    let conversionMessage = "";
    // Per-file split of the progress bar: converting files reserve 40% for the
    // conversion phase, non-converting files spend the whole span on upload.
    const conversionWeight = 0.4;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
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
        onUploaded?.(entry);
      } catch (err) {
        console.error("Upload error:", err);
        failures += 1;
        setProgress(Math.round(((i + 1) / total) * 100));
      }
    }

    setUploading(false);

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
    // biome-ignore lint/a11y/noStaticElementInteractions: file dropzone — keyboard users get the equivalent button + file input below.
    <div
      className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 group ${
        dragOver
          ? "border-terra-500 bg-white/80 scale-[1.01] shadow-xl shadow-terra-900/5"
          : "border-terra-900/20 bg-white/40 hover:bg-white/60 hover:border-terra-400/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        // biome-ignore lint/a11y/useSemanticElements: role="status" live region is the correct pattern here, not <output>.
        <div
          className="flex flex-col items-center gap-4 w-full max-w-xs"
          role="status"
          aria-live="polite"
        >
          <CircularProgress value={progress} />
          <span className="text-terra-600 font-medium text-center animate-pulse">
            Trwa wysyłanie plików... Nie wyłączaj strony!
          </span>
        </div>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="mb-5 hidden sm:flex size-14 items-center justify-center rounded-full bg-terra-100 text-terra-600 group-hover:bg-terra-200 group-hover:text-terra-700 transition-colors duration-300"
          >
            <UploadSimpleIcon size={28} weight="light" />
          </span>
          <h3 className="font-display text-xl text-terra-900 mb-1">
            Prześlij zdjęcia lub filmy
          </h3>
          <p className="text-terra-900/60 mb-6 text-sm font-sans">
            Przeciągnij pliki tutaj lub wybierz z dysku
          </p>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-full bg-terra-500 px-7 py-3.5 text-base font-medium text-white shadow-md shadow-terra-500/20 cursor-pointer w-full sm:w-auto transition-all duration-300 hover:bg-terra-600 hover:scale-105 active:scale-100"
            onClick={() => inputRef.current?.click()}
          >
            <UploadSimpleIcon size={20} weight="regular" />
            Wybierz pliki
          </button>
          <p className="mt-4 text-xs text-terra-900/50">
            Maksymalnie {maxFiles} plików naraz
          </p>
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
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-sm">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 max-w-sm">
          {notice}
        </p>
      )}
    </div>
  );
}

function CircularProgress({ value }: { readonly value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <title>Postęp wysyłania</title>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(250 231 210)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(211 97 31)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-200 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-terra-700 text-sm font-semibold tabular-nums">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function isAcceptedFile(file: File): boolean {
  return acceptedExtension.test(file.name);
}

async function uploadOne(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<FileEntry> {
  const initiateRes = await fetch(apiUrl("/upload/initiate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || genericContentType,
    }),
  });
  if (!initiateRes.ok) {
    throw new Error(`initiate ${initiateRes.status} for ${file.name}`);
  }
  const initiated = (await initiateRes.json()) as InitiateResponse;

  await putToStorage(initiated.uploadUrl, file, initiated.headers, onProgress);

  const finalizeRes = await fetch(apiUrl("/upload/finalize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageName: initiated.storageName }),
  });
  if (!finalizeRes.ok) {
    throw new Error(`finalize ${finalizeRes.status} for ${file.name}`);
  }
  const finalized = (await finalizeRes.json()) as FinalizeResponse;
  return {
    name: finalized.name,
    url: finalized.url,
    thumbUrl: finalized.thumbUrl,
    previewUrl: finalized.previewUrl,
    mimeType: finalized.mimeType,
    type: finalized.type,
    createdAt: finalized.createdAt,
  };
}

function putToStorage(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Storage PUT ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Błąd wysyłania pliku do magazynu"));
    xhr.send(file);
  });
}
