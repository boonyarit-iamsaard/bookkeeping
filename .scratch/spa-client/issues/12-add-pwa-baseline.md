# 12: Add the PWA baseline

Read `../worker-brief.md` first.

**What to build:** The client installs to a phone home screen and launches
standalone: a web manifest with production icons, theme and background
colours from `DESIGN.md` (cobalt and paper), `standalone` display, a
`vite-plugin-pwa` service worker that precaches the app shell and static
assets only, `NetworkOnly` handling for `/v1` and `/api/auth`, and an
offline fallback page shown when the shell is launched without a network.

**Blocked by:** 11: Port the dashboard

**Status:** ready-for-agent

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

- [ ] The manifest validates in Chromium's application panel: name, short name, icons (192, 512, maskable), theme and background colours, `display: standalone`, `start_url` `/`.
- [ ] The production build emits the service worker; the precache manifest lists the shell and hashed assets and nothing under `/v1` or `/api/auth`.
- [ ] A request to `/v1/wallets` or `/api/auth/get-session` is never served from cache (proved by the spec below).
- [ ] Browser spec `pwa.spec.ts` (Chromium projects only): launches the built app, confirms the service worker is active, reloads with the network set offline and sees the fallback page, then goes online and sees the app again; and confirms an API request with the network offline fails rather than answering from cache.
- [ ] `pnpm run ci` is green; `test:e2e:ci` (production build) passes the PWA spec on `phone-chromium`.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e:ci -- --project=phone-chromium pwa`.
