# Phone-first PWA client replacing Next.js

Status: confirmed

Design confirmed on 2026-09-20 by grilling. Decision recorded in
`docs/adr/0006-vite-tanstack-router-spa-client.md`. This supersedes the
"later SPA migration" placeholders in `docs/adr/0003` and `docs/adr/0004`,
`docs/api-parity.md`, and the frozen-suite policy in `CLAUDE.md`.

## Goal

Bookkeeping is used on the phone right after paying. The web client must be
phone-first and installable from the home screen, and the project must stop
carrying two backends. Replace the Next.js app with a static single-page
client over the existing Hono API and add the PWA baseline.

A longer "responsive web / PWA direction" document from an earlier
consultation was the input to this decision. Only what is listed here is
scoped; the rest of that document is ideas, not requirements.

## Scope

1. Rename `apps/web` to `apps/legacy-web` (`@bookkeeping/legacy-web`) in one
   mechanical commit: turbo filters, root scripts, CI, e2e runner. The
   existing suite still passes afterwards.
2. Scaffold `apps/web` (`@bookkeeping/web`): Vite, React, TanStack Router with
   file routes and per-route code splitting, TanStack Query, TanStack Form,
   Tailwind v4, shadcn with Base UI. Typed API client generated from Hono's
   `/openapi.json`; the generation step is part of the build and fails on
   drift. Better Auth React client pointed at the Hono origin; credentialed
   fetch; optimistic client-side route guard, real check on every API call.
3. Port routes in order, one ticket each, both apps runnable throughout:
   sign-in and sign-up, wallets, categories, transactions (entry, history,
   detail, refunds, transfers, corrections), dashboard. Each ticket ports the
   screen faithfully (no redesign), writes its SPA browser spec, and deletes
   the legacy spec for that route.
4. PWA baseline: manifest, production icons, theme colors, standalone
   display, `vite-plugin-pwa` service worker precaching the shell and static
   assets, `NetworkOnly` for `/v1` and `/api/auth`, offline fallback page.
   Verified by a standalone-launch and offline-launch browser spec.
5. Reliability already provided by the API and kept in the client:
   client-generated `Idempotency-Key` on every create, submit button
   protected while a request is in flight, form values preserved on
   rejection, lost-response replay.
6. Last ticket: delete `apps/legacy-web`, the Next.js Better Auth mount, the
   Next.js-only env and tooling (`@t3-oss/env-nextjs`, `next` dev commands,
   `docs/research/dotenvx-turborepo-nextjs.md` if obsolete), and rewrite the
   `CLAUDE.md` browser-test policy and the top Next.js block. Update
   `docs/api-parity.md`'s "What this does not close" section.

## Browser tests

New Playwright suite in `apps/web` with three projects: 360px Chromium,
iPhone WebKit, desktop Chromium. Scenarios: every ported workflow,
double-tap Save, lost response and replay, form and server validation with
values preserved, standalone launch, offline launch with fallback. Local
resource limits in `CLAUDE.md` still apply: one browser run at a time.

## Deployment shape

Static client and Hono API on separate origins under one site, as ADR 0003
decided. Local development: Vite dev server on port 4000, Hono on its
existing port, `CLIENT_ORIGINS` allowlists the client origin. No production
host is chosen in this effort.

## Non-goals

- Offline transaction capture, an IndexedDB outbox, or any client-side ledger.
  Revisit with its own grilling if the online phone experience proves
  insufficient; the idempotent replay it needs already exists.
- Phone-first redesign of screens (bottom navigation, recent transactions on
  the dashboard, thumb-reach placement). Separate effort after the port,
  using `DESIGN.md`.
- TanStack Start, server rendering, React Native, Capacitor, app-store
  distribution, Web Vitals tracking, push notifications.
- Porting the legacy Playwright specs. They are retired route by route.
- Changing the API. Any gap the port finds becomes a ticket against
  `apps/server` with its own contract test.

## Order of tickets

01 rename legacy app · 02 scaffold client and generated API client · 03 auth
routes · 04 wallets · 05 categories · 06 transactions entry and history ·
07 refunds, transfers, and corrections · 08 dashboard · 09 PWA baseline ·
10 delete legacy app and rewrite policies.
