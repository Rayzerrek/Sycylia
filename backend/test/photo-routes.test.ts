import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listGalleryObjects } from "../src/lib/gallery-cache.ts";
import { adminRoute } from "../src/routes/admin.ts";
import { filesRoute } from "../src/routes/files.ts";
import * as photoIndex from "../src/search/photo-index.ts";

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
  searchText: i === 0 ? "pies, psy, trawa" : undefined,
}));
afterEach(() => vi.restoreAllMocks());
describe("search metadata routes", () => {
  it("includes AI descriptions when retrieving the full gallery", async () => {
    vi.mocked(listGalleryObjects).mockResolvedValueOnce(photos);
    const response = await filesRoute(config).request("http://test/all");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      files: [
        { name: "0-opaque.jpg", searchText: "pies, psy, trawa" },
        {},
        {},
        {},
        {},
      ],
    });
  });
  it("requires admin authentication before indexing existing photos", async () => {
    const index = vi
      .spyOn(photoIndex, "indexPhoto")
      .mockResolvedValue(undefined);
    const response = await adminRoute(config).request(
      "http://test/index-photos",
      { method: "POST" },
      env,
    );
    expect(response.status).toBe(403);
    expect(index).not.toHaveBeenCalled();
  });
  it("indexes a bounded batch and skips already indexed photos", async () => {
    vi.mocked(listGalleryObjects).mockResolvedValueOnce(photos);
    const index = vi
      .spyOn(photoIndex, "indexPhoto")
      .mockResolvedValue(undefined);
    const response = await adminRoute(config).request(
      "http://test/index-photos",
      { method: "POST", headers: { "X-Admin-Token": "test-admin" } },
      env,
    );
    expect(await response.json()).toEqual({
      indexed: 3,
      remaining: 1,
      failures: [],
    });
    expect(index).toHaveBeenCalledTimes(3);
    expect(index).toHaveBeenNthCalledWith(1, config, env, photos[1]);
  });
  it("reports failures explicitly and leaves those photos pending", async () => {
    vi.mocked(listGalleryObjects).mockResolvedValueOnce(photos);
    vi.spyOn(photoIndex, "indexPhoto")
      .mockRejectedValueOnce(new Error("AI unavailable"))
      .mockResolvedValue(undefined);
    const response = await adminRoute(config).request(
      "http://test/index-photos",
      { method: "POST", headers: { "X-Admin-Token": "test-admin" } },
      env,
    );
    expect(await response.json()).toEqual({
      indexed: 2,
      remaining: 2,
      failures: [{ name: "1-opaque.jpg", error: "AI unavailable" }],
    });
  });
});
