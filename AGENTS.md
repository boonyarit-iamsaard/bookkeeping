<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Local resource limits

Sonar scans and browser test (e2e) runs are exclusive on this machine: never
run either concurrently with any other heavy task — another Sonar scan, e2e, a
production build, or the unit/integration suites — and never with each other.
Overlapping runs have exhausted memory and nearly crashed the machine.
Everything else may run in parallel, including Turborepo task parallelism.
Lightweight independent reads and searches may run in parallel.

### Browser test execution policy

During the Hono backend migration, retain the existing Next.js Playwright suite
as a compatibility oracle for the temporary adapter, as decided in
`docs/adr/0003-hono-application-backend.md`. It is not part of the routine local
or per-ticket feedback loop.

By default, agents should run the relevant unit, integration, and Hono contract
tests. Run a focused E2E spec only when a change affects the corresponding
Next.js adapter or browser boundary; use one browser project unless the change
is viewport-specific. Run the full E2E matrix only when the user explicitly
requests it, at a deliberate migration checkpoint, or for the final API-parity
gate. Prefer remote CI for the full matrix when available, and always follow the
local resource limits above. `pnpm run ci` is the routine gate and excludes
browser tests; `pnpm run ci:e2e` is the explicit production-build browser gate.

Do not expand, port, or optimize the frozen Next.js E2E suite merely to support
the backend migration. Reassess client-specific browser coverage when SPA or
React Native implementation begins, and remove the legacy suite when the
Next.js adapter is removed.

### Code conventions

Before writing, refactoring, or reviewing application code, read
`docs/code-conventions.md` for naming, vocabulary ownership, and house-style
enforcement.

### Database schema changes

Use `db:push` while the domain model is unsettled, including for test and CI
databases. Do not generate, commit, or apply database migrations until the user
explicitly asks to switch from `db:push` to migrations. Treat this as a hard rule;
an agent deciding that the domain model is settled does not authorize the switch.

### Issue tracker

Issues and specs live as local Markdown under `.scratch/<feature>/`. Before creating, fetching, or updating them, read `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. Before triaging issues, read `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context layout. Before exploring the codebase, read `docs/agents/domain.md` for domain documentation consumer rules.
