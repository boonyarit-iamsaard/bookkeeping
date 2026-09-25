# Worker brief: trial deployment

Read this before any ticket under `issues/`. Every ticket assumes it. The spec
is `spec.md`; the decision is `docs/adr/0008-railway-single-hosting-provider.md`.
Every decision in those files is final. Do not reopen, improve, or
"modernise" any of them.

## The job is narrow

- Each ticket lists the **only files you may create or edit**. A change to
  any other file is out of scope, even if it looks like an improvement.
- Each ticket gives exact names, values, and reference contents. Use them as
  written. Where a ticket says "reference", adapt only what the verification
  proves wrong, and record the adaptation under `## Comments`.
- Do not add features, options, flags, scripts, documentation, or tests the
  ticket does not ask for. No README changes, no CI changes, no Compose
  changes, no new root `package.json` scripts.

## Hard boundaries

- **No new dependencies and no version bumps** in any `package.json` or the
  lockfile. `pnpm install` must leave `pnpm-lock.yaml` unchanged.
- **No API contract changes**: no new routes, no response shape changes, no
  OpenAPI document changes (`apps/web/src/core/api/*` stays byte-identical).
- **No database migrations and no schema changes.** `db:push` only, and only
  to prepare a local database for verification; see `CLAUDE.md`.
- Do not touch `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, `DESIGN.md`,
  `PRODUCT.md`, ADRs, `spec.md`, this brief, or other tickets.
- Do not create Railway, Cloudflare, or any other external account, project,
  or resource. Nothing in tickets 01–03 needs network access beyond package
  and image downloads.
- Never write a real secret into a file. Example values stay obviously fake.

## Resource limits

Follow `CLAUDE.md`: a `docker build` counts as a heavy task, like a
production build. Run one heavy task at a time: never a `docker build`
together with `pnpm run ci`, another `docker build`, a Sonar scan, or a
browser test run. Docker Desktop must be running for tickets 02 and 03.

## Established patterns to follow

- Naming and style: `docs/code-conventions.md` and the TypeScript house style
  Biome enforces. Named `function` declarations placed above their call
  sites; `interface` for object contracts.
- Environment variables are parsed once with Zod in
  `apps/server/src/core/env/config.ts` and mapped to a typed `ServerConfig`.
  `AUTH_RATE_LIMIT_ENABLED` is the pattern for a `true`/`false` switch.
- Tests are colocated: `*.unit.test.ts` for pure logic,
  `*.integration.test.ts` for tests that need PostgreSQL (testcontainers,
  wrapped in `withRollback`).

## Definition of done for every ticket

1. Every acceptance criterion is ticked, or the untickable ones carry a
   comment saying exactly what blocked them.
2. The ticket's **Verify** commands were run and passed; paste their key
   output lines under `## Comments`.
3. `pnpm run ci` is green from the repo root, run alone.
4. `git status` shows changes only in the files the ticket allows.
5. One commit per ticket, subject line only, following the repository's
   conventions (`/commit-message`). If your harness cannot run Git writes,
   stop before committing and say so.
6. Set `**Status:** done` and add a short `## Comments` entry: what landed,
   any deviation from the reference and the evidence that forced it.

## Stop conditions

Stop and write a comment instead of improvising when:

- a criterion needs a file outside the ticket's allowed list;
- a dependency, version bump, or lockfile change seems necessary;
- a test can pass only by weakening or deleting an existing test;
- the reference contents fail and the fix is not a small, evidenced
  adaptation (for example, a tool rejects a flag);
- an existing test or `pnpm run ci` was already failing before your change.
