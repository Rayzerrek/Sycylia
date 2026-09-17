/**
 * Base URL for API requests. Empty in production because the frontend is
 * served from the same origin as the API (single-origin). May be overridden
 * via `NEXT_PUBLIC_API_URL` for local development against a separate API
 * origin.
 */
const envBase: unknown = process.env.NEXT_PUBLIC_API_URL;
const normalizedBaseUrl = (
  typeof envBase === "string" && envBase.length > 0 ? envBase : ""
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}
