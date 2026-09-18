import { Hono } from "hono";

import { getObjectMetadata, publicUrl } from "../gcs/objects.ts";
import { isRootStorageObjectName } from "../lib/names.ts";
import { isAnimatedImage } from "../media/media-types.ts";
import { renderImageVariant, type PreviewVariant } from "../media/preview.ts";

import type { Config } from "../env.ts";

type VariantApp = Hono<{ Bindings: Env }>;

export function imageVariantRoute(variant: PreviewVariant): (config: Config) => VariantApp {
  return (config: Config) => {
    const app: VariantApp = new Hono();

    app.get("/:name", async (c) => {
      const name = c.req.param("name");
      if (!isRootStorageObjectName(name)) {
        return c.json({ error: "Nieprawidłowa nazwa pliku" }, 400);
      }

      const object = await getObjectMetadata(config, name);
      const mimeType = object.contentType ?? "";
      if (!mimeType.startsWith("image/")) {
        return c.json({ error: "Podgląd dostępny tylko dla obrazów" }, 415);
      }

      try {
        const source = await fetchGcsStream(config, object.name);
        // `await` is required so a rejected transformation is caught here and
        // falls back to the public original instead of escaping to onError.
        return await renderImageVariant(c.env.IMAGES, source, variant, isAnimatedImage(mimeType));
      } catch (err) {
        // Images binding rejects inputs over ~20MB or exotic decoders; fall back
        // to the public original rather than surfacing a 500 to the gallery.
        console.error(`Variant ${variant} failed for ${object.name}:`, err);
        return c.redirect(publicUrl(config.bucket, object.name), 302);
      }
    });

    return app;
  };
}

async function fetchGcsStream(
  config: Config,
  objectName: string,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(publicUrl(config.bucket, objectName));
  if (!response.ok || response.body === null) {
    throw new Error(`Nie udało się pobrać pliku z GCS: ${response.status}`);
  }
  return response.body;
}