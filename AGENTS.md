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
