import { Hono } from "hono";

import { getAccessToken } from "../gcs/auth.ts";
import { adminMiddleware } from "../middleware/admin.ts";

import type { Config } from "../env.ts";

/**
 * One-time helper: configure GCS bucket CORS so the browser can PUT uploads
 * directly to `storage.googleapis.com` from the frontend origins. Run once:
 *   curl -X POST https://<worker>/admin/configure-bucket-cors \
 *        -H "X-Admin-Token: <token>" -H "Content-Type: application/json"
 *
 * Equivalent gsutil (no Worker needed):
 *   echo '<cors-config>' > cors.json && gsutil cors set cors.json gs://<bucket>
 */
export function adminRoute(config: Config): Hono {
  const app = new Hono();
  app.use("/*", adminMiddleware(config));

  app.post("/configure-bucket-cors", async (c) => {
    const originParam = c.req.query("origin");
    const origins = originParam
      ? originParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [...config.corsOrigins];

    const token = await getAccessToken(config.serviceAccount);
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}?fields=cors`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cors: [
          {
            origin: origins,
            method: ["GET", "PUT", "HEAD"],
            responseHeader: ["Content-Type", "x-goog-acl", "x-goog-resumable", "Cache-Control"],
            maxAgeSeconds: 3600,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Konfiguracja CORS nie powiodła się: ${response.status} ${text}`);
    }
    return c.json({ success: true, origins });
  });

  return app;
}
