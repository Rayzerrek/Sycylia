import { isTransformableImage } from "./media-types.ts";

/**
 * On-the-fly image preview/thumbnail via the Cloudflare Images binding.
 *
 * Replaces the old sharp-based pre-generation pipeline: no `thumbs/` or
 * `previews/` objects are stored. HEIC/HEIF inputs are decoded by the binding
 * on the free plan. Scaling sets only `width` — height follows aspect ratio,
 * so there is no letterboxing (emulates sharp's `fit: "inside"`).
 *
 * `output()` returns a transform result whose `.response()` carries a streamed
 * body, so the image is never fully buffered in Worker memory.
 */

const thumbnailWidth = 320;
const thumbnailQuality = 72;
const previewWidth = 1600;
const previewQuality = 82;
const previewCacheTtl = "public, max-age=604800";

export type PreviewVariant = "thumbnail" | "preview";

export async function renderImageVariant(
  images: ImagesBinding,
  source: ReadableStream<Uint8Array>,
  variant: PreviewVariant,
  animated: boolean,
): Promise<Response> {
  const { width, quality } =
    variant === "thumbnail"
      ? { width: thumbnailWidth, quality: thumbnailQuality }
      : { width: previewWidth, quality: previewQuality };

  // Animated inputs (GIF) are re-encoded to animated WebP so the thumbnail
  // keeps playing in the grid; static images stay on progressive JPEG. JPEG
  // cannot hold animation, so `anim: true` requires an animation-capable format.
  const format = animated ? "image/webp" : "image/jpeg";
  const transformation = await images
    .input(source)
    .transform({ width })
    .output({ format, quality, anim: animated });

  const response = transformation.response();
  if (!response.ok) {
    throw new Error(
      `Błąd transformacji Cloudflare Images: ${response.status} ${response.statusText}`,
    );
  }
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? (animated ? "image/webp" : "image/jpeg"),
      "Cache-Control": previewCacheTtl,
    },
  });
}

/** Whether a stored mimeType supports the preview/thumbnail transformation endpoint. */
export function isPreviewEndpointSupported(mimeType: string): boolean {
  return isTransformableImage(mimeType);
}