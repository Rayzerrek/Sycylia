const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heic-sequence",
  "image/heif",
  "image/heif-sequence",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "video/3gpp2",
  "video/hevc",
  "video/hevc-sequence",
  "video/h265",
  "video/x-h265",
  "video/x-m4v",
  "video/x-matroska",
]);

const mimeExtensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heic-sequence", "heic"],
  ["image/heif", "heif"],
  ["image/heif-sequence", "heif"],
  ["image/avif", "avif"],
  ["image/bmp", "bmp"],
  ["image/tiff", "tiff"],
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
  ["video/3gpp", "3gp"],
  ["video/3gpp2", "3g2"],
  ["video/hevc", "hevc"],
  ["video/hevc-sequence", "hevc"],
  ["video/h265", "h265"],
  ["video/x-h265", "h265"],
  ["video/x-m4v", "m4v"],
  ["video/x-matroska", "mkv"],
]);

const extensionMimeTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
  ["avif", "image/avif"],
  ["bmp", "image/bmp"],
  ["tif", "image/tiff"],
  ["tiff", "image/tiff"],
  ["mp4", "video/mp4"],
  ["mov", "video/quicktime"],
  ["webm", "video/webm"],
  ["3gp", "video/3gpp"],
  ["3g2", "video/3gpp2"],
  ["hevc", "video/hevc"],
  ["h265", "video/h265"],
  ["m4v", "video/mp4"],
  ["mkv", "video/x-matroska"],
]);

const genericMimeTypes = new Set(["", "application/octet-stream"]);

export interface UploadMimeTypeInput {
  readonly detectedMimeType?: string;
  readonly browserMimeType: string;
  readonly fileName: string;
}

export type GalleryType = "video" | "image";

export function isAllowedMimeType(mimeType: string): boolean {
  return allowedMimeTypes.has(mimeType);
}

export function extensionForMimeType(mimeType: string): string | undefined {
  return mimeExtensions.get(mimeType);
}

export function chooseUploadMimeType(input: UploadMimeTypeInput): string {
  if (input.detectedMimeType !== undefined && !genericMimeTypes.has(input.detectedMimeType)) {
    return input.detectedMimeType;
  }
  if (isAllowedMimeType(input.browserMimeType)) {
    return input.browserMimeType;
  }
  return mimeTypeForFileName(input.fileName) ?? input.browserMimeType;
}

export function galleryTypeForMimeType(mimeType: string): GalleryType {
  return mimeType.startsWith("video/") ? "video" : "image";
}

/** Whether a stored image MIME type holds animation that must survive preview. */
export function isAnimatedImage(mimeType: string): boolean {
  return mimeType === "image/gif";
}

/** Whether a stored image MIME type can be transformed to a preview/thumbnail. */
export function isTransformableImage(mimeType: string): boolean {
  return (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp" ||
    mimeType === "image/gif" ||
    mimeType === "image/heic" ||
    mimeType === "image/heic-sequence" ||
    mimeType === "image/heif" ||
    mimeType === "image/heif-sequence" ||
    mimeType === "image/avif" ||
    mimeType === "image/bmp" ||
    mimeType === "image/tiff"
  );
}

function mimeTypeForFileName(fileName: string): string | undefined {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
    return undefined;
  }
  return extensionMimeTypes.get(fileName.slice(lastDotIndex + 1).toLowerCase());
}
