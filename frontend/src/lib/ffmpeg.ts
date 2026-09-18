import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * Lazy ffmpeg loader, split into its own chunk.
 *
 * `convert.ts` dynamic-imports this module, so the `@ffmpeg/ffmpeg` + `@ffmpeg/util`
 * wrappers never land in the main (page-load) bundle. The wrapper is only
 * fetched on demand when a guest actually uploads a clip that needs remuxing
 * or transcoding, keeping the critical path small for photo-only browsing and
 * uploads.
 *
 * Once loaded, `getFfmpeg()` is cached per page (the wrappers are tiny; the
 * ~20 MB core WASM is fetched separately by `load()` and only when needed).
 */
export type Ffmpeg = FFmpeg;
export { fetchFile };

let ffmpegPromise: Promise<FFmpeg> | undefined;

export function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = loadFfmpeg().catch((err) => {
    ffmpegPromise = undefined;
    throw err;
  });
  return ffmpegPromise;
}

async function loadFfmpeg(): Promise<FFmpeg> {
  const ffmpeg = new FFmpeg();
  // Single-threaded core (no SharedArrayBuffer → no COOP/COEP headers needed).
  // The core + wasm are fetched from CDN as same-origin blob URLs so
  // cross-origin worker restrictions don't apply. The class worker is bundled
  // by Vite.
  const coreURL =
    "https://unpkg.com/@ffmpeg/core@0.12.9/dist/umd/ffmpeg-core.js";
  const wasmURL =
    "https://unpkg.com/@ffmpeg/core@0.12.9/dist/umd/ffmpeg-core.wasm";
  await ffmpeg.load({
    coreURL: await toBlobURL(coreURL, "text/javascript"),
    wasmURL: await toBlobURL(wasmURL, "application/wasm"),
  });
  return ffmpeg;
}