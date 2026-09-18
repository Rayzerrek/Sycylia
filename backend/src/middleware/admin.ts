import { createMiddleware } from "hono/factory";

import { tokensMatch } from "../lib/tokens.ts";

import type { Config } from "../env.ts";

export function adminMiddleware(config: Config) {
  return createMiddleware(async (c, next) => {
    const provided = c.req.header("X-Admin-Token");
    if (!provided || !tokensMatch(provided, config.adminToken)) {
      return c.json({ error: "Brak uprawnień" }, 403);
    }
    await next();
  });
}
