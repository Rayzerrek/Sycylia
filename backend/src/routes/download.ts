import { Hono } from "hono";

import { getObjectMetadata, publicUrl } from "../gcs/objects.ts";
import { isRootStorageObjectName } from "../lib/names.ts";

import type { Config } from "../env.ts";

export function downloadRoute(config: Config): Hono {
  const app = new Hono();

  app.get("/:name", async (c) => {
    const name = c.req.param("name");
    if (!isRootStorageObjectName(name)) {
      return c.json({ error: "Nieprawidłowa nazwa pliku" }, 400);
    }

    const object = await getObjectMetadata(config, name);
    const upstream = await fetch(publicUrl(config.bucket, object.name));
    if (!upstream.ok || upstream.body === null) {
      throw new Error(`Nie udało się pobrać pliku z GCS: ${upstream.status}`);
    }

    const encodedName = encodeURIComponent(object.name);
    const contentType = object.contentType ?? "application/octet-stream";
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  });

  return app;
}
