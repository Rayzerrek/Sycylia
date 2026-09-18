import { Hono } from "hono";

import { signedPutUrl } from "../gcs/auth.ts";
import { getObjectMetadata, publicUrl } from "../gcs/objects.ts";
import { buildStorageName } from "../lib/names.ts";
import {
  chooseUploadMimeType,
  extensionForMimeType,
  galleryTypeForMimeType,
  isAllowedMimeType,
  isAnimatedImage,
  isTransformableImage,
} from "../media/media-types.ts";

import type { Config } from "../env.ts";
import type { FinalizeUploadResponse, InitiateUploadResponse } from "../types.ts";

const signedUrlTtlSeconds = 60 * 5;

export function uploadRoute(config: Config): Hono {
  const app = new Hono();

  app.post("/initiate", async (c) => {
    const body = await c.req.json();
    const fileName = readStringField(body, "fileName");
    const browserContentType = readStringField(body, "contentType");

    const mimeType = chooseUploadMimeType({
      browserMimeType: browserContentType,
      fileName,
    });
    if (!isAllowedMimeType(mimeType)) {
      return c.json({ error: "Nieobsługiwany typ pliku" }, 415);
    }

    const extension = extensionForMimeType(mimeType) ?? "bin";
    const storageName = buildStorageName(fileName, extension);
    const uploadUrl = await signedPutUrl({
      bucket: config.bucket,
      objectName: storageName,
      contentType: mimeType,
      expiresInSeconds: signedUrlTtlSeconds,
      account: config.serviceAccount,
    });

    const response: InitiateUploadResponse = {
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": mimeType, "x-goog-acl": "public-read" },
      storageName,
      mimeType,
      type: galleryTypeForMimeType(mimeType),
      expiresInSeconds: signedUrlTtlSeconds,
    };
    return c.json(response);
  });

  app.post("/finalize", async (c) => {
    const body = await c.req.json();
    const storageName = readStringField(body, "storageName");
    if (storageName.includes("/")) {
      return c.json({ error: "Nieprawidłowa nazwa pliku" }, 400);
    }

    const object = await getObjectMetadata(config, storageName);
    const mimeType = object.contentType ?? "";
    const type = galleryTypeForMimeType(mimeType);
    const origin = new URL(c.req.url).origin;
    const encoded = encodeURIComponent(object.name);
    const originalUrl = publicUrl(config.bucket, object.name);
    const transformable = type === "image" && isTransformableImage(mimeType);
    // Mirrors `filesRoute`: GIF previews point to the animated original.
    const previewEndpoint = transformable && !isAnimatedImage(mimeType);

    const response: FinalizeUploadResponse = {
      success: true,
      name: object.name,
      fileName: object.name,
      url: originalUrl,
      thumbUrl: transformable ? `${origin}/thumbnail/${encoded}` : undefined,
      previewUrl: previewEndpoint ? `${origin}/preview/${encoded}` : originalUrl,
      mimeType,
      type,
      createdAt: object.timeCreated ?? new Date().toISOString(),
    };
    return c.json(response);
  });

  return app;
}

function readStringField(body: unknown, field: string): string {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`Nieprawidłowe ciało żądania`);
  }
  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Brak lub puste pole: ${field}`);
  }
  return value;
}
