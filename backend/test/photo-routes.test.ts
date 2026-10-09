import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listGalleryObjects } from "../src/lib/gallery-cache.ts";
import { adminRoute } from "../src/routes/admin.ts";
import { filesRoute } from "../src/routes/files.ts";

import type { Config } from "../src/env.ts";
vi.mock("../src/lib/gallery-cache.ts", () => ({ listGalleryObjects: vi.fn() }));
const config: Config = {
  bucket: "test-bucket",
  adminToken: "test-admin",
  maxUploadBytes: 1000000,
  corsOrigins: new Set(),
  serviceAccount: {
    projectId: "test",
    clientEmail: "test@example.com",
    privateKeyPem: "unused",
    privateKeyId: "unused",
  },
};
const photos = Array.from({ length: 5 }, (_, i) => ({
  name: i + "-opaque.jpg",
  contentType: "image/jpeg",
  timeCreated: "2026-10-09T12:00:00Z",
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe("gallery routes without AI", () => {
  it("retrieves all photos without search descriptions", async () => {
    vi.mocked(listGalleryObjects).mockResolvedValueOnce(photos);
    const response = await filesRoute(config).request("http://test/all");
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      files: photos.map((photo) => ({ name: photo.name })),
    });
    expect(JSON.stringify(body)).not.toContain("searchText");
  });
  it("no longer exposes the indexing endpoint even to an administrator", async () => {
    const response = await adminRoute(config).request(
      "http://test/index-photos",
      { method: "POST", headers: { "X-Admin-Token": "test-admin" } },
      env,
    );
    expect(response.status).toBe(404);
    expect(listGalleryObjects).not.toHaveBeenCalled();
  });
});
