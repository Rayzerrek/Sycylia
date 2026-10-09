import { describe, expect, it } from "vitest";

import { matchesPhotoSearch } from "../../frontend/src/lib/photo-search.ts";

const file = {
  name: "89128391023asda.jpg",
  url: "https://example.com/photo.jpg",
  thumbUrl: undefined,
  previewUrl: undefined,
  mimeType: "image/jpeg",
  type: "image",
  createdAt: "2026-10-09T12:00:00Z",
  searchText: "pies, żółty, łąka, trawa, zwierzę, psy. A yellow dog on grass.",
};

describe("photo search", () => {
  it("finds a photo by its content despite an opaque filename", () => {
    expect(matchesPhotoSearch(file, "pies")).toBe(true);
    expect(matchesPhotoSearch(file, "samochód")).toBe(false);
  });
  it("matches all words regardless of order, accents or case", () => {
    expect(matchesPhotoSearch(file, " ZOLTY   PIES ")).toBe(true);
    expect(matchesPhotoSearch(file, "laka pies")).toBe(true);
    expect(matchesPhotoSearch(file, "pies czerwony")).toBe(false);
  });
  it("keeps filename and date searches available for unindexed media", () => {
    const unindexed = { ...file, searchText: undefined };
    expect(matchesPhotoSearch(unindexed, "89128391023")).toBe(true);
    expect(matchesPhotoSearch(unindexed, "2026-10-09")).toBe(true);
    expect(matchesPhotoSearch(unindexed, "pies")).toBe(false);
  });
  it("treats a whitespace-only query as no filtering", () => {
    expect(matchesPhotoSearch(file, "   ")).toBe(true);
  });
});
