import { apiUrl } from "@/lib/api";

export type FileEntryType = "image" | "video";

export interface FileEntry {
  name: string;
  url: string;
  thumbUrl: string | undefined;
  previewUrl: string | undefined;
  mimeType: string | undefined;
  type: FileEntryType;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface FilesPage {
  files: FileEntry[];
  pagination: Pagination | undefined;
}

export function downloadUrl(fileName: string): string {
  return apiUrl(`/download/${encodeURIComponent(fileName)}`);
}

/**
 * Triggers a single file download synchronously within the user gesture.
 *
 * The Worker `/download/:name` route emits `Content-Disposition: attachment`,
 * so navigating to the URL downloads instead of navigating. Clicking an
 * in-DOM anchor directly — with no `await` before it — keeps the call inside
 * the browser's user-activation window, so Chrome never classifies repeated
 * downloads as "automatic downloads" and never asks for permission. Fetching a
 * blob first (`await fetch`) would break that gesture and trigger the prompt.
 */
export function downloadFile(fileName: string): void {
  triggerAnchor(downloadUrl(fileName));
}

function triggerAnchor(href: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  // The download route sets `Content-Disposition: attachment` with the
  // UTF-8 filename, so the browser derives the saved name from the header —
  // no `download` attribute needed (and setting one would override that name).
  anchor.rel = "noopener";
  // Must be attached to the DOM for iOS Safari to honor the programmatic click.
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function fetchFiles(
  page: number,
  pageSize: number,
  signal: AbortSignal,
): Promise<FilesPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await fetch(apiUrl(`/files?${params.toString()}`), { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while fetching files`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON, got ${contentType || "unknown content-type"}`,
    );
  }

  return decodeFilesPage(await res.json());
}

/** Fetch every gallery file's metadata (no pagination) for the lightbox. */
export async function fetchAllFiles(signal: AbortSignal): Promise<FileEntry[]> {
  const res = await fetch(apiUrl("/files/all"), { signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while fetching all files`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON, got ${contentType || "unknown content-type"}`,
    );
  }

  return decodeAllFiles(await res.json());
}

function decodeFilesPage(data: unknown): FilesPage {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid files response");
  }

  const rawFiles = getProp(data, "files");
  if (!Array.isArray(rawFiles)) {
    throw new Error("Invalid files response");
  }

  return {
    files: decodeFileList(rawFiles),
    pagination: decodePagination(getProp(data, "pagination")),
  };
}

function decodeAllFiles(data: unknown): FileEntry[] {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid files response");
  }

  return decodeFileList(getProp(data, "files"));
}

function decodeFileList(rawFiles: unknown): FileEntry[] {
  if (!Array.isArray(rawFiles)) {
    throw new Error("Invalid files response");
  }

  const files: FileEntry[] = [];
  for (const item of rawFiles) {
    const entry = decodeFileEntry(item);
    if (entry) files.push(entry);
  }
  return files;
}

function decodeFileEntry(value: unknown): FileEntry | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const name =
    optionalString(getProp(value, "name")) ??
    optionalString(getProp(value, "fileName"));
  const url = optionalString(getProp(value, "url"));
  if (!name || !url) {
    return undefined;
  }

  return {
    name,
    url,
    thumbUrl: optionalString(getProp(value, "thumbUrl")),
    previewUrl: optionalString(getProp(value, "previewUrl")),
    mimeType: optionalString(getProp(value, "mimeType")),
    type: getProp(value, "type") === "video" ? "video" : "image",
    createdAt:
      optionalString(getProp(value, "createdAt")) ?? new Date().toISOString(),
  };
}

function decodePagination(value: unknown): Pagination | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const page = optionalNumber(getProp(value, "page"), 1);
  const pageSize = optionalNumber(getProp(value, "pageSize"), 24);
  const total = optionalNumber(getProp(value, "total"), 0);
  const totalPages = optionalNumber(
    getProp(value, "totalPages"),
    Math.max(1, Math.ceil(total / pageSize)),
  );

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: Boolean(getProp(value, "hasNextPage")),
  };
}

function getProp(obj: object, key: string): unknown {
  const record = obj as Record<string, unknown>;
  return record[key];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}
