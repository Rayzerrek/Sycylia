import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { readConfig, type Config } from "./env.ts";
import { installErrorHandler } from "./middleware/error.ts";
import { adminRoute } from "./routes/admin.ts";
import { downloadRoute } from "./routes/download.ts";
import { filesRoute } from "./routes/files.ts";
import { imageVariantRoute } from "./routes/preview.ts";
import { uploadRoute } from "./routes/upload.ts";

export type App = Hono<{ Bindings: Env }>;

export function createApp(env: Env): App {
  const config = readConfig(env);
  const app: App = new Hono();

  app.use(
    "*",
    secureHeaders({
      crossOriginResourcePolicy: "cross-origin",
    }),
  );
  app.use(
    "*",
    cors({
      origin: (origin) => resolveOrigin(origin, config),
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-Admin-Token"],
      maxAge: 86_400,
    }),
  );

  // Health check is at /health (not /) so the SPA's index.html is served
  // directly by the assets handler for the root path.
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/files", filesRoute(config));
  app.route("/upload", uploadRoute(config));
  app.route("/thumbnail", imageVariantRoute("thumbnail")(config));
  app.route("/preview", imageVariantRoute("preview")(config));
  app.route("/download", downloadRoute(config));
  app.route("/admin", adminRoute(config));

  installErrorHandler(app);
  return app;
}

function resolveOrigin(origin: string | undefined, config: Config): string | null {
  if (origin === undefined || origin === null) {
    return null;
  }
  return config.corsOrigins.has(origin) ? origin : null;
}
