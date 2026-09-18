/**
 * Browser-side conversion of iPhone/unsupported media into formats every
 * browser can display and decode a thumbnail frame from.
 *
 * The Worker has no ffmpeg, and Cloudflare Stream would mean a separate
 * product/storage/billing, so conversion happens in the browser before the
 * direct-to-GCS upload. H.264 videos are remuxed into MP4 in seconds (stream
 * copy, no re-encode); HEVC/exotic codecs are transcoded to H.264/MP4. On
 * video conversion failure the file is skipped (a stored HEVC original is
 * unplayable in browsers); on HEIC image failure the original is still sent,
 * because the Cloudflare Images binding decodes HEIC for previews/thumbnails.
 *
 * `heic2any` (libheif, ~1.3 MB) is imported dynamically only when a HEIC/HEIF
 * file is actually detected, so it never enters the initial bundle for guests
 * uploading plain JPG/MP4. The ffmpeg core WASM is fetched from CDN on demand.
 */

import type { Ffmpeg } from "./ffmpeg";

export type Progress = (fraction: number) => void;

/**
 * Raised when a video cannot be made browser-playable in-browser (e.g. HEVC
 * transcode fails or OOMs). Callers must NOT silently fall back to the
 * original — an unconverted HEVC clip is not playable in Chrome/Firefox, so
 * sending it would store a broken video. Instead surface the failure to the
 * user (skip the file) via this error type.
 */
export class VideoConversionError extends Error {
  readonly fileName: string;
  constructor(fileName: string, reason: string) {
    super(`Nie udało się przekonwertować filmu „${fileName}": ${reason}`);
    this.name = "VideoConversionError";
    this.fileName = fileName;
  }
}

const heicExtensions = /\.(heic|heif)$/i;
const convertibleVideoExtensions = /\.(mov|hevc|h265|3gp|3g2|m4v|mkv)$/i;
const browserSafeVideoExtensions = /\.(mp4|webm)$/i;

export function needsImageConversion(file: File): boolean {
  return heicExtensions.test(file.name);
}

export function needsVideoConversion(file: File): boolean {
  if (browserSafeVideoExtensions.test(file.name)) return false;
  return convertibleVideoExtensions.test(file.name);
}

export async function convertVideoToMp4(
  file: File,
  onProgress?: Progress,
): Promise<File> {
  // ffmpeg lives in its own code-split chunk (`lib/ffmpeg.ts`) and is only
  // loaded when a clip actually needs remuxing/transcoding, so the wrapper
  // never ships in the main page-load bundle.
  const { getFfmpeg, fetchFile } = await import("./ffmpeg");
  const ffmpeg = await getFfmpeg();
  const inputName = "input";
  const outputName = "output.mp4";

  const progressHandler = (event: { progress: number }) => {
    if (onProgress) onProgress(clamp01(event.progress));
  };
  ffmpeg.on("progress", progressHandler);

  // Capture stderr stream info during the probe so we can decide between a
  // near-instant remux (H.264 already) and a full transcode (HEVC/exotic).
  const probeLogs: string[] = [];
  const logHandler = ({ message }: { type: string; message: string }) => {
    probeLogs.push(message);
  };
  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Probe: `ffmpeg -i input` with no output exits non-zero but prints the
    // stream map to stderr, which we parse for the video/audio codec names.
    try {
      await ffmpeg.exec(["-i", inputName]);
    } catch {
      // Expected: no output specified → non-zero exit. Logs were captured.
    }
    const { videoCodec, audioCodec } = probeCodecs(probeLogs.join("\n"));

    const isH264 = videoCodec === "h264" || videoCodec === "avc";
    if (isH264) {
      // H.264 video already — just copy the stream into an MP4 container and
      // normalise audio. No video decode/encode, so no OOM risk even for 4K,
      // and it finishes in seconds instead of minutes. Copy audio as-is when it
      // is already AAC; otherwise (or none) drop/re-encode it.
      const audioArgs =
        audioCodec === ""
          ? ["-an"]
          : audioCodec === "aac"
            ? ["-c:a", "copy"]
            : ["-c:a", "aac", "-b:a", "128k"];
      const remuxExit = await ffmpeg.exec([
        "-i",
        inputName,
        "-c:v",
        "copy",
        ...audioArgs,
        "-movflags",
        "+faststart",
        outputName,
      ]);
      if (remuxExit === 0) {
        const remuxed = await readOutputFile(ffmpeg, outputName, file.name);
        onProgress?.(1);
        return remuxed;
      }
      // Remux can fail on a mislabeled codec or a stream MP4 containers can't
      // hold verbatim (e.g. odd pixel format / b-frames). Fall through to a
      // full transcode rather than giving up on the file.
      console.warn(
        `Remux failed (kod ${remuxExit}) for ${file.name}, falling back to transcode`,
      );
      await safeDelete(ffmpeg, outputName);
    }

    // HEVC / remux-failed H.264: full transcode. Single-threaded WASM is slow,
    // so cap width at 1280 and use ultrafast to keep phones from
    // overheating/OOMing.
    const exitCode = await ffmpeg.exec([
      "-i",
      inputName,
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputName,
    ]);
    if (exitCode !== 0) {
      throw new VideoConversionError(
        file.name,
        `transkodowanie nie powiodło się (kod ${exitCode})`,
      );
    }
    return await readOutputFile(ffmpeg, outputName, file.name);
  } finally {
    ffmpeg.off("progress", progressHandler);
    ffmpeg.off("log", logHandler);
    await safeDelete(ffmpeg, inputName);
    await safeDelete(ffmpeg, outputName);
  }
}

interface ProbedCodecs {
  readonly videoCodec: string;
  readonly audioCodec: string;
}

function probeCodecs(logs: string): ProbedCodecs {
  const videoMatch = logs.match(/Video:\s*([A-Za-z0-9]+)/);
  const audioMatch = logs.match(/Audio:\s*([A-Za-z0-9]+)/);
  return {
    videoCodec: videoMatch ? videoMatch[1].toLowerCase() : "",
    audioCodec: audioMatch ? audioMatch[1].toLowerCase() : "",
  };
}

async function readOutputFile(
  ffmpeg: Ffmpeg,
  outputName: string,
  originalFileName: string,
): Promise<File> {
  const data = await ffmpeg.readFile(outputName);
  if (typeof data === "string") {
    throw new VideoConversionError(
      originalFileName,
      "ffmpeg zwróciło tekst zamiast danych binarnych",
    );
  }
  if (data.byteLength === 0) {
    throw new VideoConversionError(
      originalFileName,
      "ffmpeg nie wyprodukowało wyjścia",
    );
  }
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return new File([buffer], replaceExtension(originalFileName, "mp4"), {
    type: "video/mp4",
  });
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  if (blob === undefined) {
    throw new Error("heic2any zwróciło pusty wynik");
  }
  return new File([blob], replaceExtension(file.name, "jpg"), {
    type: "image/jpeg",
  });
}

export async function prepareFileForUpload(
  file: File,
  onConversionProgress?: Progress,
): Promise<File> {
  if (needsImageConversion(file)) {
    return convertHeicToJpeg(file);
  }
  if (needsVideoConversion(file)) {
    return convertVideoToMp4(file, onConversionProgress);
  }
  return file;
}

function replaceExtension(fileName: string, newExtension: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${base}.${newExtension}`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

async function safeDelete(ffmpeg: Ffmpeg, path: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    // Ignore: file may not exist or FS was torn down.
  }
}
