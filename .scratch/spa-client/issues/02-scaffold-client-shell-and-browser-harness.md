# 02: Scaffold the Vite client shell and browser harness

Read `../worker-brief.md` first.

**What to build:** A new `apps/web` (`@bookkeeping/web`) that starts on port
4000, renders the app shell (header with wordmark and the three nav links,
empty centred column) at `/`, and has a Playwright suite that boots a test
database, the Hono API, and the client, then passes one smoke spec on all
three browser projects. No API calls and no real screens yet.

**Blocked by:** 01: Rename the Next.js app to legacy-web

**Status:** ready-for-agent

**Pattern to copy:**

- Toolchain: Vite + React + TanStack Router with file-based routes and
  per-route code splitting, TanStack Query provider, Tailwind v4, shadcn
  with Base UI (same `components.json` settings as the legacy app).
- Styles: copy the legacy global stylesheet (tokens, `money` utility, fonts)
  verbatim.
- Primitives: copy every file under the legacy `shared/components/ui/`,
  `shared/components/form/`, the date and month pickers, and `shared/helpers`
  verbatim, fixing only imports. Do not restyle them.
- Shell: copy the legacy app header and nav link components; the account menu
  stays out until ticket 04 (render the header without it).
- Browser runner: mirror the legacy `tests/e2e/run.ts`: start the test
  database, then start the Hono server from `apps/server` on a free port
  with `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` = its own
  origin, and `CLIENT_ORIGINS` = the client origin; then let Playwright's
  `webServer` start the client (dev server locally, `vite preview` of the
  built output when `CI=1`). Workers stay at 1.
- Playwright projects: `phone-chromium` (Chromium, 360×780 viewport),
  `phone-webkit` (iPhone device descriptor), `desktop-chromium`.
- Scripts: `dev`, `build`, `start` (preview), `test`, `test:watch`,
  `types:check`, `test:e2e`, `test:e2e:ci`, matching the legacy package's
  names so root scripts and CI work unchanged; root gets `dev:web` and
  `start:web` back, filtering the new package.

**Out of scope:** the generated API client (ticket 03); Better Auth (04);
any route other than `/`; the PWA plugin (12); porting feature components;
changing the legacy app; adding the new suite to the CI workflow's e2e step
(ticket 05 does that once a real spec exists).

- [ ] `pnpm dev:web` serves the shell at `http://localhost:4000` with the header, wordmark, and nav links styled as `DESIGN.md` describes.
- [ ] The Router uses file routes with code splitting; `/` is the only route; a `__root` route mounts the Query provider and the shell.
- [ ] Every copied primitive type-checks and is exported from the same relative location it had in the legacy app.
- [ ] The Vitest config runs unit tests; one copied unit test (the `cn` helper or a label file) proves it.
- [ ] The Playwright runner boots database, API, and client, and a smoke spec that opens `/` and sees the wordmark passes on all three projects.
- [ ] `types:check`, `test`, `build`, and `test:e2e:ci` tasks run through Turborepo.
- [ ] `pnpm run ci` is green with both apps present.

**Verify:** `pnpm run ci`; then `pnpm --filter @bookkeeping/web test:e2e`
once, on its own (all three projects, this ticket only, to prove the
harness).
