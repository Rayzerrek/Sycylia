import { getAccessToken } from "./auth.ts";

import type { Config } from "../env.ts";

/**
 * Google Cloud Storage JSON/REST API client.
 *
 * Talk to GCS directly via `fetch` + an OAuth2 access token (see `auth.ts`)
 * because `firebase-admin`/`@google-cloud/storage` cannot run on Workers.
 * Objects are public-read; listing/metadata/delete authorize with the token.
 */

const jsonApi = "https://storage.googleapis.com/storage/v1";

export interface StorageObject {
  readonly name: string;
  readonly contentType: string | undefined;
  readonly timeCreated: string | undefined;
}

export interface ListResult {
  readonly objects: StorageObject[];
  readonly nextPageToken: string | undefined;
}

export interface ListOptions {
  readonly bucket: string;
  readonly maxResults?: number;
  readonly pageToken?: string;
  readonly delimiter?: string;
  readonly prefix?: string;
}

export async function listRootObjects(config: Config, options: ListOptions): Promise<ListResult> {
  const token = await getAccessToken(config.serviceAccount);
  const params = new URLSearchParams({
    maxResults: String(options.maxResults ?? 100),
    delimiter: options.delimiter ?? "",
  });
  if (options.pageToken) {
    params.set("pageToken", options.pageToken);
  }
  if (options.prefix) {
    params.set("prefix", options.prefix);
  }

  const url = `${jsonApi}/b/${encodeURIComponent(options.bucket)}/o?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`GCS list failed: ${response.status} ${await safeText(response)}`);
  }

  const payload = await response.json();
  const items = readArrayField(payload, "items");
  const objects: StorageObject[] = items.map((item) => ({
    name: readString(item, "name") ?? "",
    contentType: readString(item, "contentType"),
    timeCreated: readString(item, "timeCreated"),
  }));
  const nextPageToken = readString(payload, "nextPageToken");
  return { objects, nextPageToken: nextPageToken ?? undefined };
}

export async function getObjectMetadata(
  config: Config,
  objectName: string,
): Promise<StorageObject> {
  const token = await getAccessToken(config.serviceAccount);
  const url = `${jsonApi}/b/${encodeURIComponent(config.bucket)}/o/${encodeURIComponent(objectName)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) {
    throw new ItemNotFoundError(objectName);
  }
  if (!response.ok) {
    throw new Error(`GCS metadata failed: ${response.status} ${await safeText(response)}`);
  }
  const payload = await response.json();
  return {
    name: readString(payload, "name") ?? objectName,
    contentType: readString(payload, "contentType"),
    timeCreated: readString(payload, "timeCreated"),
  };
}

export function publicUrl(bucket: string, objectName: string): string {
  const encoded = objectName.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/${bucket}/${encoded}`;
}

export class ItemNotFoundError extends Error {
  override readonly name = "ItemNotFoundError";
  constructor(readonly objectName: string) {
    super(`Nie znaleziono pliku: ${objectName}`);
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}

function readArrayField(payload: unknown, key: string): unknown[] {
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function readString(payload: unknown, key: string): string | undefined {
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
