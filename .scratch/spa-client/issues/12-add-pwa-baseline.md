# 12: Add the PWA baseline

Read `../worker-brief.md` first.

**What to build:** The client installs to a phone home screen and launches
standalone: a web manifest with production icons, theme and background
colours from `DESIGN.md` (cobalt and paper), `standalone` display, a
`vite-plugin-pwa` service worker that precaches the app shell and static
assets only, `NetworkOnly` handling for `/v1` and `/api/auth`, and an
offline fallback page shown when the shell is launched without a network.

**Blocked by:** 11: Port the dashboard

**Status:** done

**Pattern to copy:**

- `vite-plugin-pwa` with the Workbox `generateSW` strategy and
  `navigateFallback` to the shell; explicit `runtimeCaching` entries with
  handler `NetworkOnly` for URL patterns starting `/v1` and `/api/auth`
  (the API is on another origin, so match by pathname on any origin). No
  other runtime caches.
- Icons: one source SVG, a cobalt disc with a white "B" monogram in Inter,
  committed under `public/`; generate the icon set (including maskable and
  Apple touch) with `@vite-pwa/assets-generator` as a `generate:icons`
  script; commit the output.
- Offline fallback: a static HTML page in the same visual system (paper
  background, Inter, one sentence saying the app needs a connection and a
  Retry button that reloads).
- Registration: register the service worker once at startup with the
  `autoUpdate` behaviour; no custom update prompt.

**Out of scope:** offline capture or any IndexedDB outbox; caching API
responses; push notifications; Web Vitals; app-store packaging; a custom
install prompt.

- [x] The manifest validates in Chromium's application panel: name, short name, icons (192, 512, maskable), theme and background colours, `display: standalone`, `start_url` `/`.
- [x] The production build emits the service worker; the precache manifest lists the shell and hashed assets and nothing under `/v1` or `/api/auth`.
- [x] A request to `/v1/wallets` or `/api/auth/get-session` is never served from cache (proved by the spec below).
- [x] Browser spec `pwa.spec.ts` (Chromium projects only): launches the built app, confirms the service worker is active, reloads with the network set offline and sees the fallback page, then goes online and sees the app again; and confirms an API request with the network offline fails rather than answering from cache.
- [x] `pnpm run ci` is green; `test:e2e:ci` (production build) passes the PWA spec on `phone-chromium`.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e:ci -- --project=phone-chromium pwa`.

## Comments

Landed `vite-plugin-pwa` (generateSW, `autoUpdate`, registered once from
`main.tsx`), the manifest with cobalt/paper colours and the generated icon set
from `public/icon.svg` (`generate:icons` via `@vite-pwa/assets-generator`; the
"B" is Inter 600 outlined to a path so the render does not depend on the font
being installed), `public/offline.html`, and `tests/e2e/pwa.spec.ts`, which
passes on `phone-chromium` under `test:e2e:ci` and skips on the dev server.

Deviations: `navigateFallback` is disabled rather than pointed at the shell.
Workbox registers the precache navigation route ahead of `runtimeCaching`, so a
shell fallback would answer every offline launch from cache and the static
offline page could never be shown; navigations are instead `NetworkOnly` with
`precacheFallback` to `offline.html`. `workbox-window` is added as a dev
dependency because `virtual:pwa-register` imports it and pnpm does not hoist
the plugin's peer. `clientsClaim` is set explicitly; the plugin only enables
`skipWaiting` for `autoUpdate`. `favicon.ico` was the copied Next.js default
and is now the 48px production icon. Standalone launch is covered by the
manifest assertions; Playwright cannot launch an installed app. Offline, the
fallback page renders in the system font because Google Fonts is not cached.

Review fixes: the spec throws without `VITE_API_ORIGIN` like its siblings,
parses the manifest with Zod, and asserts the worker's caches hold no `/v1` or
`/api/auth` URL so the no-cache check has a real oracle. The worker wait uses a
synchronous predicate: an async one resolved on the pending promise and let
the offline reload race the install.
