interface SearchablePhoto {
  readonly name: string;
  readonly createdAt: string;
  readonly searchText: string | undefined;
}

/** Match all query words against AI descriptions, filenames and dates, ignoring Polish diacritics. */
export function matchesPhotoSearch(
  file: SearchablePhoto,
  query: string,
): boolean {
  const terms = normalizePhotoSearch(query).split(/\s+/).filter(Boolean);
  const text = normalizePhotoSearch(
    [file.searchText ?? "", file.name, file.createdAt].join(" "),
  );
  return terms.every((term) => text.includes(term));
}

function normalizePhotoSearch(value: string): string {
  return value
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .trim();
}
