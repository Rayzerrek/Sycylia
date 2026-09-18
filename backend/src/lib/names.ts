/** Storage object naming helpers: timestamp-prefixed, slug-safe, chronologically sortable. */

export function buildStorageName(
  originalName: string,
  extension: string,
  now = Date.now(),
): string {
  const slug = sanitizeFileName(stripExtension(originalName));
  return `${now}-${crypto.randomUUID()}-${slug}.${extension}`;
}

export function isRootStorageObjectName(fileName: string): boolean {
  return (
    fileName.length > 0 &&
    fileName.length <= 220 &&
    !fileName.includes("/") &&
    !containsControlCharacter(fileName)
  );
}

export function readTimestampFromName(fileName: string): number {
  const separatorIndex = fileName.indexOf("-");
  if (separatorIndex <= 0) {
    return 0;
  }
  const timestamp = Number(fileName.slice(0, separatorIndex));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return sanitized || "plik";
}

function stripExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}
