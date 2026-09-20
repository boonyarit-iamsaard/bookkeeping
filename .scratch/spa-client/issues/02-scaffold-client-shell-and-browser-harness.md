# 02: Scaffold the Vite client shell and browser harness

Read `../worker-brief.md` first.

**What to build:** A new `apps/web` (`@bookkeeping/web`) that starts on port
4000, renders the app shell (header with wordmark and the three nav links,
empty centred column) at `/`, and has a Playwright suite that boots a test
database, the Hono API, and the client, then passes one smoke spec on all
three browser projects. No API calls and no real screens yet.

**Blocked by:** 01: Rename the Next.js app to legacy-web

**Status:** done

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

- [x] `pnpm dev:web` serves the shell at `http://localhost:4000` with the header, wordmark, and nav links styled as `DESIGN.md` describes.
- [x] The Router uses file routes with code splitting; `/` is the only route; a `__root` route mounts the Query provider and the shell.
- [x] Every copied primitive type-checks and is exported from the same relative location it had in the legacy app.
- [x] The Vitest config runs unit tests; one copied unit test (the `cn` helper or a label file) proves it.
- [x] The Playwright runner boots database, API, and client, and a smoke spec that opens `/` and sees the wordmark passes on all three projects.
- [x] `types:check`, `test`, `build`, and `test:e2e:ci` tasks run through Turborepo.
- [x] `pnpm run ci` is green with both apps present.

**Verify:** `pnpm run ci`; then `pnpm --filter @bookkeeping/web test:e2e`
once, on its own (all three projects, this ticket only, to prove the
harness).

## Comments

Landed: `apps/web` (`@bookkeeping/web`) on Vite 8 with `@vitejs/plugin-react`,
`@tanstack/router-plugin` (file routes, `autoCodeSplitting`), TanStack Query,
`@tailwindcss/vite`, and the legacy `components.json` with `rsc: false`.
`src/routes/__root.tsx` mounts the Query provider and `AppHeader`;
`src/routes/index.tsx` renders the empty centred column. The header and
`NavLink` live in `src/core/shell/` with only the framework-forced swaps
(`next/link` → `Link`, `usePathname` → `useLocation`) and an empty trailing
slot where the account menu goes in ticket 04. `shared/components/**`,
`shared/helpers/cn.ts`, and `styles/globals.css` are byte-identical copies
(`diff -r` clean); the `"use client"` directives stay because Vite builds
without warning on them. `cn.unit.test.ts` is new (legacy has no `cn` test).
`tests/e2e/run.ts` boots Testcontainers, then `apps/server` from source via
`tsx` on a free port with a generated `BETTER_AUTH_SECRET`, its own origin as
`BETTER_AUTH_URL`, and the client origin as `CLIENT_ORIGINS`; Playwright's
`webServer` starts `vite` (or `vite preview` under `CI=1`). Root gets
`dev:web` / `start:web`; `biome.json`, `.gitignore`, and
`sonar-project.properties` cover the new tree; `README.md` notes that both
apps claim port 4000 so only one runs beside the API at a time.

Verification: `pnpm run ci` green with both apps (15 check/test tasks, 3
builds); `pnpm --filter @bookkeeping/web test:e2e` 3/3 on `phone-chromium`,
`phone-webkit`, `desktop-chromium`; `turbo run test:e2e:ci --filter=@bookkeeping/web`
(preview of the built output) 1/1 on `phone-chromium`.

Deviations and decisions:

- "Sees the wordmark": the legacy header hides the wordmark below 640px
  (`max-sm:hidden`), so on the two phone projects the smoke spec asserts it
  is attached but hidden, and visible only on `desktop-chromium`.
- Fonts: `next/font` self-hosted Inter and JetBrains Mono; the client loads
  them from Google Fonts in `index.html` and sets `--font-sans` /
  `--font-mono` in `src/styles/fonts.css` so `globals.css` stays verbatim.
  Ticket 12 (PWA, offline shell) should decide whether to self-host.
- Links to `/wallets`, `/transactions`, `/categories` pass through
  `string`-typed props because those routes are not registered yet;
  tickets 05 to 11 tighten them to TanStack's typed `to`.
- `ci.yaml`'s browser step is now `turbo run test:e2e:ci
--filter=@bookkeeping/legacy-web`: with the new package declaring
  `test:e2e:ci`, the unfiltered root `ci:e2e` would have run both suites
  concurrently (against the `CLAUDE.md` exclusivity rule) and without
  WebKit installed. Ticket 05 extends the install and the step to the new
  package.
- `test:e2e:ci` uses `dotenvx run --env CI=1 --ignore=MISSING_ENV_FILE`
  because the client has no `.env`: the runner generates the secret and
  Testcontainers supplies `DATABASE_URL`.
- Running `phone-webkit` locally needs `playwright install-deps webkit`
  (sudo) once; the browser download alone is not enough on WSL2.
