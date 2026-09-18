import { Hono } from "hono";

import { publicUrl, type StorageObject } from "../gcs/objects.ts";
import { listGalleryObjects } from "../lib/gallery-cache.ts";
import { readTimestampFromName } from "../lib/names.ts";
import { readPageQuery } from "../lib/pagination.ts";
import {
  galleryTypeForMimeType,
  isAnimatedImage,
  isTransformableImage,
} from "../media/media-types.ts";

import type { Config } from "../env.ts";
import type { FileInfo, FilesResponse } from "../types.ts";

const defaultPageSize = 24;
const maxPageSize = 48;
// Browser-facing listing responses must never be cached. Uploads go straight
// to GCS via signed URLs (bypassing the Worker), so a cached listing would
// keep freshly uploaded files invisible in the grid and swap the lightbox
// preview to a neighbouring photo until the TTL lapsed. The GCS list itself is
// read directly on every request (see `lib/gallery-cache.ts`).
const galleryCacheControl = "no-store";

export function filesRoute(config: Config): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const { page, pageSize } = readPageQuery(c.req.query(), {
      defaultPageSize,
      maxPageSize,
    });

    const origin = new URL(c.req.url).origin;
    const galleryObjects = await listGalleryObjects(config);
    const total = galleryObjects.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const pageFiles = galleryObjects.slice(start, start + pageSize);
    const files = pageFiles.map((object) => buildFileInfo(object, config, origin));
    const response: FilesResponse = {
      files,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: start + pageSize < total,
      },
    };
    c.header("Cache-Control", galleryCacheControl);
    return c.json(response);
  });

  // Lightweight metadata listing for the lightbox: returns every gallery file
  // (sorted newest-first) without pagination, so the viewer can swipe through
  // the whole event regardless of how many thumbnails the grid has loaded.
  app.get("/all", async (c) => {
    const origin = new URL(c.req.url).origin;
    const galleryObjects = await listGalleryObjects(config);
    const files = galleryObjects.map((object) => buildFileInfo(object, config, origin));
    c.header("Cache-Control", galleryCacheControl);
    return c.json({ files });
  });

  return app;
}

function buildFileInfo(object: StorageObject, config: Config, origin: string): FileInfo {
  const mimeType = object.contentType ?? "";
  const type = galleryTypeForMimeType(mimeType);
  const encoded = encodeURIComponent(object.name);
  const url = publicUrl(config.bucket, object.name);
  const createdAt =
    object.timeCreated ?? new Date(readTimestampFromName(object.name)).toISOString();

  if (type === "video") {
    return {
      name: object.name,
      fileName: object.name,
      url,
      thumbUrl: undefined,
      previewUrl: url,
      mimeType,
      type: "video",
      createdAt,
    };
  }

  const transformable = isTransformableImage(mimeType);
  // Animated GIFs keep their original encoding for the full-size lightbox
  // view (the preview route would drop animation). The grid thumbnail route
  // instead re-encodes to animated WebP (`anim: true`), so it keeps playing.
  const previewEndpoint = transformable && !isAnimatedImage(mimeType);
  return {
    name: object.name,
    fileName: object.name,
    url,
    thumbUrl: transformable ? `${origin}/thumbnail/${encoded}` : undefined,
    previewUrl: previewEndpoint ? `${origin}/preview/${encoded}` : url,
    mimeType,
    type: "image",
    createdAt,
  };
}