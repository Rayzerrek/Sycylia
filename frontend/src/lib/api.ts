/**
 * Base URL for API requests. Empty in production because the frontend is
 * served from the same origin as the API (single-origin on Cloudflare Workers).
 *
 * For local development (e.g. running on localhost:3000), it falls back to
 * the deployed backend unless overridden via `NEXT_PUBLIC_API_URL` (such as
 * when running a local Wrangler dev server on localhost:8787).
 */
const DEFAULT_DEV_API_URL = "https://sycylia.rayserrek.workers.dev";

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const envBase = process.env.NEXT_PUBLIC_API_URL;

  let base = "";
  if (typeof envBase === "string" && envBase.trim().length > 0) {
    base = envBase.trim().replace(/\/+$/, "");
  } else if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]")
  ) {
    base = DEFAULT_DEV_API_URL;
  } else if (process.env.NODE_ENV === "development") {
    base = DEFAULT_DEV_API_URL;
  }

  return `${base}${normalizedPath}`;
}
