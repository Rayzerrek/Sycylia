import { createApp, type App } from "./app.ts";

/**
 * Workers entry point. The Hono app is built once per isolate (it depends only
 * on stable env bindings/secrets) and reused across requests. Per-request data
 * flows through the Hono context, never through module-level state.
 */
let cachedApp: App | undefined;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      if (cachedApp === undefined) {
        cachedApp = createApp(env);
      }
      // Hono only populates `c.env` (used by the preview route for the Images
      // binding) when env/ctx are forwarded to `app.fetch`.
      return cachedApp.fetch(request, env, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Błąd serwera";
      console.error("Worker startup error:", err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
