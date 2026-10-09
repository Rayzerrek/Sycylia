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
describe("stored photo search metadata", () => {
  it("lists old photos with no custom metadata alongside indexed photos", async () => {
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
      { name: "old.jpg", searchText: undefined },
      { name: "indexed.jpg", searchText: "pies" },
    ]);
  });
  it("reads search text from custom metadata without trusting non-string values", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ name: "invalid.jpg", metadata: { gallerySearchV1: 42 } }),
    );
    expect(
      (await getObjectMetadata(config, "invalid.jpg")).searchText,
    ).toBeUndefined();
  });
});
