import { listRootObjects, type StorageObject } from "../gcs/objects.ts";
import { isRootStorageObjectName, readTimestampFromName } from "./names.ts";

import type { Config } from "../env.ts";

/**
 * GCS gallery listing.
 *
 * GCS listings are strongly consistent, so a freshly uploaded file appears in
 * the very next request. Browser-facing listing responses are never cached
 * (`Cache-Control: no-store` on the route responses), and there is no
 * Workers-side cache: `caches.default` is colo-local, so a purge after finalize
 * only cleared the colo that handled the upload while other colos kept serving
 * a stale snapshot for up to the TTL — which made a just-uploaded photo
 * disappear from the grid until the snapshot expired. Listing directly keeps
 * uploads visible everywhere immediately.
 */

// Upper bound on GCS listing pages so a runaway token never loops forever.
const maxListPages = 50;

export async function listGalleryObjects(
  config: Config,
): Promise<StorageObject[]> {
  const objects: StorageObject[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxListPages; page += 1) {
    const list = await listRootObjects(config, {
      bucket: config.bucket,
      maxResults: 1000,
      ...(pageToken !== undefined ? { pageToken } : {}),
    });
    for (const object of list.objects) {
      objects.push(object);
    }
    pageToken = list.nextPageToken;
    if (pageToken === undefined) break;
  }
  return objects
    .filter((object) => isRootStorageObjectName(object.name))
    .sort(
      (a, b) => readTimestampFromName(b.name) - readTimestampFromName(a.name),
    );
}
