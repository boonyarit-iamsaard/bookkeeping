# Worker brief: SPA client port

Read this before any ticket under `issues/`. Every ticket assumes it. The
spec is `spec.md`; the decision is `docs/adr/0006-vite-tanstack-router-spa-client.md`;
the visual reference is the root `DESIGN.md`.

## The job is a port, not a redesign

- Reproduce each legacy screen as `DESIGN.md` describes it. Copy markup,
  class names, labels, and behaviour from the legacy feature in
  `apps/legacy-web`; do not "improve" layout, copy, spacing, colour, or
  motion. A visible difference from the legacy screen is a bug.
- Change only what the framework forces: Next.js `Link`, router hooks,
  Server Actions, `loading.tsx`/`error.tsx`, and server components become
  their TanStack Router and TanStack Query equivalents. Everything else is
  copied as is.
- Do not add features, shortcuts, empty states, or messages the legacy
  screen does not have.

## Hard boundaries

- **No API changes.** If a screen needs something the Hono API does not
  offer, write it under `## Comments` in your ticket, mark the criterion
  blocked, and stop that part. Do not work around it in the client.
- **No new dependencies** beyond those the spec names (Vite, React, TanStack
  Router / Query / Form, Tailwind v4, shadcn with Base UI, Better Auth React
  client, `vite-plugin-pwa`, the OpenAPI client generator chosen in ticket
  03, Playwright, Vitest). No version bumps of existing packages.
- **No database migrations.** `db:push` only; see `CLAUDE.md`.
- **Never edit `apps/legacy-web`** except to delete the legacy browser spec
  the ticket retires. Both apps must build and pass until ticket 13.
- **Never edit `apps/server`.** A server change is a separate ticket.
- Do not touch `DESIGN.md`, `CONTEXT.md`, ADRs, or `CLAUDE.md` unless the
  ticket says so (only ticket 13 does).

## Established patterns to follow

- Layout: `core/` (auth client, API client, env, query client, router
  setup), `shared/` (UI primitives, helpers), `features/<feature>/` with
  `components/`, `hooks/`, schemas and labels beside them. Routes live in the
  TanStack Router file-route directory and stay thin: they load data and
  render a feature component.
- Naming: `docs/code-conventions.md`. Forms keep the three-file split the
  legacy app uses: `<x>-form-schema.ts` (Zod), `use-<x>-form.ts` (TanStack
  Form hook), `<x>-form.tsx` (component). Labels stay in `<x>-labels.ts`.
  Props are `[ComponentName]Props` accepted as `Readonly<…>`.
- TypeScript: the house style Biome enforces. Named `function` declarations,
  `interface` for object contracts, `unknown` and narrowing over assertions,
  no barrel files in runtime app code.
- Reads go through TanStack Query with the generated API client. Writes go
  through the shared write helper from ticket 03, which owns the
  `Idempotency-Key`, the in-flight lock, replay, and field-error mapping.
  Never hand-write `fetch` in a feature.
- Vocabulary from `CONTEXT.md`: wallet, opening balance, transaction date,
  refund allowance, source and destination wallet, retained wallet, parent and
  child category, Uncategorized. Never "account" for a money holding.
- Money is rendered only through the copied `money` utility and the copied
  `Money` / `SignedMoney` components, always as `฿12,000.00`.
- Tests: colocated `*.unit.test.ts` for pure logic (schemas, labels, helpers)
  with the same stem as the module; one browser spec per route under the
  client's `tests/e2e/`; Playwright helpers beside the specs in `helpers/`.
  Do not write component render tests; the browser spec covers rendering.

## Definition of done for every ticket

1. Every acceptance criterion is ticked, or the untickable ones carry a
   comment saying exactly what blocked them.
2. `pnpm run ci` is green from the repo root.
3. The ticket's browser spec passes on the `phone-chromium` project, run on
   its own: `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium <spec>`.
   Run it while nothing else heavy is running (`CLAUDE.md` resource limits).
   Do not run the full three-project matrix or the legacy suite unless the
   ticket says so.
4. The retired legacy spec is deleted in the same change.
5. One commit per ticket, message from the repository's conventions
   (`/commit-message`). Set `**Status:** done` and add a short `## Comments`
   entry naming what landed and any deviation.

## Stop conditions

Stop and write a comment instead of improvising when: a criterion needs an
API or schema change; a legacy behaviour is ambiguous and `DESIGN.md` does not
settle it; a dependency outside the list seems necessary; a test can only pass
by weakening it; or the change is spilling into files outside the ticket's
feature and `core/`.
