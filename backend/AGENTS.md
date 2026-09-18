# Backend (weselicho)

Cloudflare Workers + Hono. Storage = Firebase Storage (GCS) przez REST API + Web
Crypto (`jose`); miniatury/previews przez Cloudflare Images binding. Brak
`firebase-admin`/`sharp`/`ffmpeg` (nie działają na Workers).

## Commands (pnpm)

- Install: `pnpm install`
- Dev: `pnpm run dev` (wrangler dev, czyta `.dev.vars`)
- Deploy: `pnpm run deploy`
- Typecheck: `pnpm run typecheck` (`tsc --noEmit`)
- Lint: `pnpm run lint` / `pnpm run lint:fix` (oxlint)
- Format: `pnpm run fmt` / `pnpm run fmt:check` (oxfmt)
- Tests: `pnpm run test` (vitest)
- Regenerate types after editing `wrangler.jsonc`: `pnpm run cf-typegen`

## Notes

- TypeScript strict, ESM, `exactOptionalPropertyTypes`. No `any`, no non-null
  assertions (`!`), no unsafe `as` on IO. Decode unknowns at the seam.
- Binding shapes come from `wrangler types` (`worker-configuration.d.ts`) — never
  hand-write binding interfaces. Secret names (`FIREBASE_ACCOUNT`, `ADMIN_TOKEN`)
  are augmented onto the global `Env` in `src/env-augmentation.ts` and loaded
  via a plain `import "./env-augmentation.ts"` side-effect in `src/env.ts`.
- Secrets: `wrangler secret put`, never in `wrangler.jsonc`. Local dev secrets
  in `.dev.vars` (gitignored).
- After changing `wrangler.jsonc` always run `pnpm run cf-typegen`.
- Tests live in `test/`, run via `vitest` with `@cloudflare/vitest-pool-workers`.
