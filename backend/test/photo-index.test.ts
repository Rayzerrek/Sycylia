import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderImageVariant } from "../src/media/preview.ts";
import { indexPhoto } from "../src/search/photo-index.ts";

import type { Config } from "../src/env.ts";
import type { StorageObject } from "../src/gcs/objects.ts";

vi.mock("../src/gcs/auth.ts", () => ({
  getAccessToken: vi.fn(async () => "test-token"),
}));
vi.mock("../src/media/preview.ts", () => ({ renderImageVariant: vi.fn() }));
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
const object: StorageObject = {
  name: "89128391023asda.jpg",
  contentType: "image/jpeg",
  timeCreated: "2026-10-09T12:00:00Z",
  searchText: undefined,
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
  vi.mocked(renderImageVariant).mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3])),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("photo indexing", () => {
  it("uses a thumbnail and stores Polish keywords with its image caption", async () => {
    const run = vi
      .spyOn(env.AI, "run")
      .mockResolvedValueOnce({ description: "A yellow dog on grass" })
      .mockResolvedValueOnce({ response: "pies, psy, żółty, trawa" });
    await indexPhoto(config, env, object);
    expect(renderImageVariant).toHaveBeenCalledWith(
      env.IMAGES,
      expect.anything(),
      "thumbnail",
      false,
    );
    expect(run).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("89128391023asda.jpg"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          metadata: {
            gallerySearchV1: "pies, psy, żółty, trawa A yellow dog on grass",
          },
        }),
      }),
    );
  });
  it("skips an indexed photo and videos without calling AI", async () => {
    const run = vi.spyOn(env.AI, "run");
    await indexPhoto(config, env, { ...object, searchText: "pies" });
    await indexPhoto(config, env, { ...object, contentType: "video/mp4" });
    expect(run).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not save malformed model output as a successful index", async () => {
    vi.spyOn(env.AI, "run").mockResolvedValueOnce({ description: "" });
    await expect(indexPhoto(config, env, object)).rejects.toThrow(
      "empty or invalid text",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not accept oversized images or run AI for them", async () => {
    const run = vi.spyOn(env.AI, "run");
    vi.mocked(renderImageVariant).mockResolvedValueOnce(
      new Response(new Uint8Array(1024 * 1024 + 1)),
    );
    await expect(indexPhoto(config, env, object)).rejects.toThrow("size limit");
    expect(run).not.toHaveBeenCalled();
  });
  it("propagates failed metadata writes so the photo remains retryable", async () => {
    vi.spyOn(env.AI, "run")
      .mockResolvedValueOnce({ description: "A dog" })
      .mockResolvedValueOnce({ response: "pies" });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(new Uint8Array([1])))
      .mockResolvedValueOnce(new Response("", { status: 403 }));
    await expect(indexPhoto(config, env, object)).rejects.toThrow(
      "metadata save failed: 403",
    );
  });
});
