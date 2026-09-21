# Bookkeeping agent instructions

## Agent skills

### Local resource limits

Sonar scans and browser test (e2e) runs are exclusive on this machine: never
run either concurrently with any other heavy task — another Sonar scan, e2e, a
production build, or the unit/integration suites — and never with each other.
Overlapping runs have exhausted memory and nearly crashed the machine.
Everything else may run in parallel, including Turborepo task parallelism.
Lightweight independent reads and searches may run in parallel.

### Browser test execution policy

By default, agents should run the relevant unit, integration, and Hono contract
tests. Run one focused SPA spec on one project when a change touches the
browser boundary. Run the full three-project SPA matrix only on explicit
request, at a migration checkpoint, or in CI. The local resource limits above
remain unchanged. `pnpm run ci` is the routine gate and excludes browser tests;
`pnpm run ci:e2e` is the explicit production-build browser gate.

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
