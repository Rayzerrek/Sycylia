import { SignJWT } from "jose";

import type { ServiceAccount } from "../env.ts";

/**
 * Google Cloud Storage authorization for the Workers runtime.
 *
 * `firebase-admin` (Node + gRPC) cannot run on Workers, so we talk to the GCS
 * JSON/REST API directly. We authorize in two ways:
 *   - service-account OAuth2 access token (for listing / metadata / deleting),
 *   - V4 signed URLs (for direct browser uploads and downloads).
 *
 * Both rely on the same imported RSA private key, signed with WebCrypto
 * (`RSASSA-PKCS1-v1_5` / SHA-256). Tokens and keys are cached per Worker
 * isolate.
 */

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const gcsScope = "https://www.googleapis.com/auth/devstorage.full_control";
const tokenSafetyMarginSec = 60;

interface CachedToken {
  readonly token: string;
  readonly expiresAtMs: number;
}

let cachedToken: CachedToken | undefined;

export async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (cachedToken !== undefined && cachedToken.expiresAtMs > now) {
    return cachedToken.token;
  }

  const key = await importPrivateKey(account);
  const nowSec = Math.floor(now / 1000);
  const header: { alg: "RS256"; typ: "JWT"; kid?: string } = {
    alg: "RS256",
    typ: "JWT",
  };
  if (account.privateKeyId) {
    header.kid = account.privateKeyId;
  }
  const assertion = await new SignJWT({ scope: gcsScope })
    .setProtectedHeader(header)
    .setIssuer(account.clientEmail)
    .setAudience(tokenEndpoint)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + 3600)
    .sign(key);

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
  });

  const payload = await response.json();
  const accessToken = readAccessToken(payload);
  if (!response.ok || accessToken === undefined) {
    throw new Error(
      `Nie udało się uzyskać tokenu GCS: ${readTokenError(payload) ?? response.statusText}`,
    );
  }

  const expiresInSec = readExpiresIn(payload) ?? 3600;
  cachedToken = {
    token: accessToken,
    expiresAtMs: now + (expiresInSec - tokenSafetyMarginSec) * 1000,
  };
  return accessToken;
}

export interface SignedPutOptions {
  readonly bucket: string;
  readonly objectName: string;
  readonly contentType: string;
  readonly expiresInSeconds: number;
  readonly account: ServiceAccount;
}

const maxExpiresInSeconds = 604_800;

export async function signedPutUrl(opts: SignedPutOptions): Promise<string> {
  const expiresInSeconds = Math.min(opts.expiresInSeconds, maxExpiresInSeconds);
  const now = new Date();
  const datestamp = fmtUtc(now, "date");
  const timestamp = fmtUtc(now, "datetime");
  const credentialScope = `${datestamp}/auto/storage/goog4_request`;
  const credential = `${opts.account.clientEmail}/${credentialScope}`;
  // Path-style host: buckets whose names contain dots (e.g. the Firebase
  // Storage `<project>.firebasestorage.app` buckets) would otherwise produce a
  // multi-level subdomain `<bucket>.storage.googleapis.com` that the wildcard
  // TLS cert `*.storage.googleapis.com` does not cover (ERR_CERT_COMMON_NAME_INVALID).
  // `publicUrl` already uses path-style, so signed PUTs must match it.
  const host = `storage.googleapis.com`;

  const headers = {
    host,
    "content-type": opts.contentType,
    "x-goog-acl": "public-read",
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${headers[name as keyof typeof headers]}\n`)
    .join("");

  const query: Record<string, string> = {
    "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
    "X-Goog-Credential": credential,
    "X-Goog-Date": timestamp,
    "X-Goog-Expires": String(expiresInSeconds),
    "X-Goog-SignedHeaders": signedHeaders,
  };
  const orderedQuery = Object.keys(query)
    .sort()
    .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(query[name])}`)
    .join("&");

  const canonicalUri = `/${encodeURIComponent(opts.bucket)}/${encodeObjectName(opts.objectName)}`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    orderedQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const hashBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalRequest),
  );
  const hashHex = toHex(hashBytes);
  const stringToSign = ["GOOG4-RSA-SHA256", timestamp, credentialScope, hashHex].join("\n");

  const key = await importPrivateKey(opts.account);
  const signatureBytes = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(stringToSign),
  );
  const signature = toHex(signatureBytes);

  return `https://${host}${canonicalUri}?${orderedQuery}&X-Goog-Signature=${signature}`;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

async function importPrivateKey(account: ServiceAccount): Promise<CryptoKey> {
  const existing = keyCache.get(account.privateKeyPem);
  if (existing !== undefined) {
    return existing;
  }

  const promise = (async () => {
    const der = pemToDer(account.privateKeyPem);
    return crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  })();

  keyCache.set(account.privateKeyPem, promise);
  try {
    return await promise;
  } catch (err) {
    keyCache.delete(account.privateKeyPem);
    throw err;
  }
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function fmtUtc(date: Date, kind: "date" | "datetime"): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  if (kind === "date") {
    return `${y}${m}${d}`;
  }
  return `${y}${m}${d}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds(),
  )}Z`;
}

function encodeObjectName(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

function readAccessToken(payload: unknown): string | undefined {
  return typeof (payload as { access_token?: unknown }).access_token === "string"
    ? (payload as { access_token: string }).access_token
    : undefined;
}

function readExpiresIn(payload: unknown): number | undefined {
  const value = (payload as { expires_in?: unknown }).expires_in;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readTokenError(payload: unknown): string | undefined {
  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" ? message : undefined;
}
