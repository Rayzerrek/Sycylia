import { ConfigError } from "../env.ts";
import { ItemNotFoundError } from "../gcs/objects.ts";

import type { Hono } from "hono";

/** Installs a tagged-error handler that maps domain/IO failures to JSON responses. */
export function installErrorHandler(app: Hono<{ Bindings: Env }>): void {
  app.onError((err, c) => {
    if (err instanceof ItemNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof ConfigError) {
      console.error("Config error:", err.message);
      return c.json({ error: err.message }, 500);
    }
    if (err instanceof SyntaxError) {
      return c.json({ error: "Nieprawidłowe żądanie" }, 400);
    }
    console.error("Unhandled error:", err);
    return c.json({ error: "Błąd serwera" }, 500);
  });
}
