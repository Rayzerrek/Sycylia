import type { GalleryType } from "./media/media-types.ts";

export interface FileInfo {
  readonly name: string;
  readonly fileName: string;
  readonly url: string;
  readonly thumbUrl: string | undefined;
  readonly previewUrl: string | undefined;
  readonly mimeType: string;
  readonly type: GalleryType;
  readonly createdAt: string;
}

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
}

export interface FilesResponse {
  readonly files: FileInfo[];
  readonly pagination: Pagination;
}

export interface InitiateUploadResponse {
  readonly uploadUrl: string;
  readonly method: "PUT";
  readonly headers: Record<string, string>;
  readonly storageName: string;
  readonly mimeType: string;
  readonly type: GalleryType;
  readonly expiresInSeconds: number;
}

export interface FinalizeUploadResponse extends FileInfo {
  readonly success: true;
}
