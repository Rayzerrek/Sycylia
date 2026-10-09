import { afterEach, describe, expect, it, vi } from "vitest";

import { getObjectMetadata, listRootObjects } from "../src/gcs/objects.ts";

import type { Config } from "../src/env.ts";
vi.mock("../src/gcs/auth.ts", () => ({
  getAccessToken: vi.fn(async () => "test-token"),
}));
const config: Config = {
  bucket: "test-bucket",
  adminToken: "test",
  maxUploadBytes: 1000,
  corsOrigins: new Set(),
  serviceAccount: {
    projectId: "test",
    clientEmail: "test@example.com",
    privateKeyPem: "unused",
    privateKeyId: "unused",
  },
};
afterEach(() => vi.restoreAllMocks());
describe("photo storage metadata", () => {
  it("lists photos while ignoring obsolete search metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        items: [
          { name: "old.jpg", contentType: "image/jpeg" },
          {
            name: "indexed.jpg",
            contentType: "image/jpeg",
            metadata: { gallerySearchV1: "pies" },
          },
        ],
      }),
    );
    const result = await listRootObjects(config, { bucket: config.bucket });
    expect(result.objects).toMatchObject([
      { name: "old.jpg", contentType: "image/jpeg" },
      { name: "indexed.jpg", contentType: "image/jpeg" },
    ]);
  });
  it("ignores malformed obsolete custom metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ name: "invalid.jpg", metadata: { gallerySearchV1: 42 } }),
    );
    expect(await getObjectMetadata(config, "invalid.jpg")).toEqual({
      name: "invalid.jpg",
      contentType: undefined,
      timeCreated: undefined,
    });
  });
});
