# Weselicho Backend (Cloudflare Workers + Hono)

Upload, listing, preview/thumbnail i download zdjęć oraz filmów dla galerii
ślubnej. Działa w pełni na Cloudflare Workers z Hono; storage to Firebase
Storage (GCS) dostępny przez REST API + Web Crypto (Node SDK `firebase-admin`
nie odpala się na Workers).

## Architektura

- **Storage** — Firebase Storage (GCS) bucket, bez zmian względem starego
  backendu. Listing/metadata/delete przez JSON REST API GCS; upload bezpośrednio
  z przeglądarki do GCS przez V4 signed PUT URL (omija limit 100 MB body
  Workera, wspiera pliki do `MAX_UPLOAD_MB`).
- **Miniatury / podglądy** — generowane „w locie" przez Cloudflare **Images
  binding** (plan darmowy, 5000 unikalnych transformacji/msc). HEIC/HEIF
  dekodowane natywnie. Nic nie jest magazynowane — koniec z `thumbs/` / `previews/`.
  Przy błędzie (np. plik > ~20 MB) endpoint przekierowuje 302 na oryginał.
- **Wideo** — serwowane jako oryginał z GCS. **HEVC/MOV z iPhone'a nie zagra w
  Chrome desktop** (zagra w Safari/iOS). Transkodowanie ffmpeg jest na Workers
  niemożliwe; dla pełnej kompatybilności trzeba włączyć Cloudflare Stream.

## Środowisko

Zmienne jawne (`wrangler.jsonc` → `vars`):

- `FIREBASE_STORAGE_BUCKET` — nazwa bucketu GCS (np. `proj.firebasestorage.app`
  dla bucketów utworzonych po Sep 2024, lub `proj.appspot.com` starsze).
- `CORS_ORIGINS` — commaseparated frontend origins.
- `MAX_UPLOAD_MB` — domyślnie `250`.

Sekrety (ustaw przez `wrangler secret put`, NIE w `wrangler.jsonc`):

- `FIREBASE_ACCOUNT` — pełny JSON klucza serwisowego Firebase (jako jeden string).
- `ADMIN_TOKEN` — token chroniący `/admin/*`.

Lokalnie te same sekrety wrzuc do `.dev.vars` (patrz `.dev.vars.example`).

## Setup

1. `pnpm install`
2. Skopiuj `.dev.vars.example` → `.dev.vars` i wpisz `FIREBASE_ACCOUNT` + `ADMIN_TOKEN`.
3. W `wrangler.jsonc` ustaw swoje `vars` (bucket, CORS, MAX_UPLOAD_MB).
4. (jednorazowo) Włącz binding Images w dashboard Cloudflare — powinien pojawić
   się automatycznie po `wrangler deploy`.
5. (jednorazowo) Ustaw CORS na buckecie GCS, żeby przeglądarka mogła PUT
   cross-origin. Albo `gsutil cors set cors.json gs://<bucket>`, albo:
   ```bash
   curl -X POST https://<worker-url>/admin/configure-bucket-cors \
     -H "X-Admin-Token: <ADMIN_TOKEN>"
   ```
6. W produkcji ustaw sekrety:
   ```bash
   wrangler secret put FIREBASE_ACCOUNT   # wklej JSON klucza
   wrangler secret put ADMIN_TOKEN
   ```

## Skrypty

```bash
pnpm run dev          # wrangler dev (lokalnie, z .dev.vars)
pnpm run deploy       # wrangler deploy --minify
pnpm run typecheck    # tsc --noEmit
pnpm run lint         # oxlint .
pnpm run lint:fix     # oxlint --fix .
pnpm run fmt          # oxfmt .        (pisze in-place)
pnpm run fmt:check    # oxfmt --check .
pnpm run test         # vitest run
pnpm run cf-typegen   # regeneruj worker-configuration.d.ts po zmianie wrangler.jsonc
```

Po zmianie `wrangler.jsonc` **zawsze** odpal `pnpm run cf-typegen`.

## API

- `GET /` — health.
- `GET /files?page=&pageSize=&cursor=` — strona galerii (sort wg timestamp w
  nazwie). `thumbUrl`/`previewUrl` to absolutne URL-e endpointów transformacji
  Workera, `url` to publiczny URL GCS.
- `POST /upload/initiate` — body `{ fileName, contentType }` →
  `{ uploadUrl, method, headers, storageName, mimeType, type, expiresInSeconds }`.
  Frontend robi `PUT` pliku wprost do `uploadUrl` z podanymi `headers`.
- `POST /upload/finalize` — body `{ storageName }` → `FileInfo` (weryfikuje obecność
  obiektu w GCS i zwraca finalne URL-e).
- `GET /thumbnail/:name` — streamowana transformacja 320px (HEIC OK, fallback 302).
- `GET /preview/:name` — streamowana transformacja 1600px (HEIC OK, fallback 302).
- `GET /download/:name` — stream oryginału z `Content-Disposition: attachment`.
- `POST /admin/configure-bucket-cors` — wymaga `X-Admin-Token`, ustawia CORS bucketa.

## Pliki

```
src/
  index.ts            export default { fetch }
  app.ts              Hono app + middleware + route wiring
  env.ts              dekodowanie Env → Config (sekret augmentowany w env-augmentation.ts)
  gcs/                REST API GCS: auth.ts (jose + V4 signed), objects.ts (list/meta/delete)
  media/              media-types.ts (port), preview.ts (Images binding)
  lib/                names.ts, pagination.ts, tokens.ts (constant-time)
  middleware/         admin.ts, error.ts
  routes/            files / upload / preview / download / admin
```

## Body TypeScript

Projekt trzyma `strict` + `exactOptionalPropertyTypes`, bez `any`, bez `as` na
IO. Zmienne bindingów pochodzą z `wrangler types` (`worker-configuration.d.ts`),
nigdy pisane ręcznie; sekrety dołączone przez augmentację `Env` w `src/env-augmentation.ts`.
