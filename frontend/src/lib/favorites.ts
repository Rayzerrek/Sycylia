"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "gallery_favorites_v1";
const EVENT_NAME = "gallery:favorites-changed";

let cachedFavorites: Set<string> | null = null;

function loadFavoritesFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed.filter((item): item is string => typeof item === "string"),
      );
    }
  } catch {
    // Ignore JSON/storage errors
  }
  return new Set();
}

function saveFavoritesToStorage(favorites: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    cachedFavorites = new Set(favorites);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Storage quota or privacy restriction
  }
}

export function getFavorites(): Set<string> {
  if (cachedFavorites === null) {
    cachedFavorites = loadFavoritesFromStorage();
  }
  return cachedFavorites;
}

export function toggleFavorite(fileName: string): boolean {
  const current = new Set(getFavorites());
  let added = false;
  if (current.has(fileName)) {
    current.delete(fileName);
  } else {
    current.add(fileName);
    added = true;
  }
  saveFavoritesToStorage(current);
  return added;
}

export function isFavorite(fileName: string): boolean {
  return getFavorites().has(fileName);
}

// React Hook for reactive favorites state across all components
export function useFavorites(): {
  favorites: Set<string>;
  toggle: (fileName: string) => boolean;
  isFav: (fileName: string) => boolean;
} {
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());

  useEffect(() => {
    const handleUpdate = () => {
      setFavorites(new Set(getFavorites()));
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return {
    favorites,
    toggle: toggleFavorite,
    isFav: (fileName: string) => favorites.has(fileName),
  };
}
