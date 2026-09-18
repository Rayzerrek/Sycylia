/**
 * Workers secrets set via `wrangler secret put` are not present in
 * `wrangler.jsonc`, so `wrangler types` cannot know about them. Augment the
 * generated global `Env` interface here rather than hand-writing binding shapes.
 * Rerun `pnpm run cf-typegen` after editing bindings in `wrangler.jsonc`.
 *
 * Plain `.ts` module (not `.d.ts`) so the bundler-resolution well defined,
 * time it imported it loads the augmentation into the program robustly.
 */
export {};

declare global {
  interface Env {
    readonly FIREBASE_ACCOUNT: string;
    readonly ADMIN_TOKEN: string;
  }
}
