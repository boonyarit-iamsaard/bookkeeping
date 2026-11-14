# Testing

## Tests

```bash
pnpm test          # Vitest: unit and PostgreSQL integration tests, both apps and every package
pnpm test:watch    # The same suites in watch mode, per workspace, through Turborepo
pnpm test:e2e      # Playwright: SPA browser flows against an isolated API and database
pnpm run ci        # Routine static, type, unit, integration, and contract checks, then both app builds
pnpm run ci:e2e    # Explicit production-build browser gate
```

Unit tests (`*.unit.test.ts`) are colocated with their source modules and need
no Docker or `.env` file. Run one workspace's suite with, for example,
`pnpm --filter @bookkeeping/web test`.

Integration tests (`*.integration.test.ts`) use Testcontainers to start a disposable
PostgreSQL 18 database on an available port. Docker must be running. The harness,
owned by `@bookkeeping/database/testing`, applies the committed migrations,
provides its connection URL to test workers, and stops the container after the
suite. Every test runs inside a
transaction that is rolled back, except concurrency checks that use committed
writes isolated by owner. No local development database is used.

PostgreSQL stamps recording times with its own clock, which is the Docker
VM's, and one integration test allows only one second between that clock and
the host's. On Docker Desktop for Windows the VM clock can drift seconds ahead,
especially after sleep, and `wsl --shutdown` does not fix it. If the test
"the recording time is the server instant" fails, resync the VM clock:

```bash
docker run --rm --privileged alpine ntpd -q -n -p time.windows.com
```

Browser tests live in `apps/web/tests/e2e/`. Install their browsers once:

```bash
pnpm --filter @bookkeeping/web exec playwright install --with-deps chromium
```

The Playwright config's web servers create a disposable PostgreSQL database,
migrate it, and start the Hono API from source with a fresh auth secret
(`apps/web/tests/e2e/serve-api.ts`), then the client: the Vite dev server
locally, or a preview of a production build under `ci:e2e`. The runner
(`apps/web/tests/e2e/run.ts`) picks available ports and, under `ci:e2e`,
builds that client with the test API origin baked in. Without the runner, as
in an editor's Playwright extension, the client uses port 4100 and the API
uses port 5100. Specs run on 360px Chromium; tests tagged
`@matrix` also run on desktop Chromium. See the
[test ownership](../code-conventions.md#test-ownership) rules and the
browser test policy in [AGENTS.md](../../AGENTS.md).

## Coverage

Coverage is an on-demand report, not part of `pnpm test` or `pnpm run ci`, and
no threshold gates it yet:

```bash
pnpm test:coverage                                   # Every workspace's unit and integration tests, with coverage
pnpm --filter @bookkeeping/domain test:coverage      # One workspace
```

It counts the same tests as `pnpm test` and needs Docker for the integration
suites. Each workspace writes its own report to `<workspace>/coverage/`:
`index.html` to browse and `lcov.info` for tools. The numbers are per
workspace and are never merged into one total. The shared settings live in
`vitest.coverage.ts`. They count every file under `src/`, so a module no test
loads shows as uncovered, and they exclude tests, `src/testing/` helpers, and
generated `*.gen.ts` files.

`apps/web` counts only its unit tests. The browser suite owns its screens and
components, so a low web number is expected, not a gap. The root `scripts/`
suite is repo tooling and has no coverage report.

## Mutation testing

Mutation testing changes the source one small edit at a time (a flipped
comparison, an emptied string) and reruns the tests. A mutant the tests still
pass "survived": the code runs under test, but nothing checks what it does.
[Stryker](https://stryker-mutator.io/) runs it on demand, outside `pnpm test`
and `pnpm run ci`, with no threshold yet. Only `packages/domain` is set up:

```bash
pnpm --filter @bookkeeping/domain test:mutation           # Retests only mutants whose code or tests changed
pnpm --filter @bookkeeping/domain test:mutation --force   # Retests every mutant
```

A run is a heavy task: run it alone, per the resource limits in
[AGENTS.md](../../AGENTS.md). It uses unit tests only, and `concurrency` is 2;
on the development machine a full domain run takes about 50 seconds and peaks
near 900 MB, and 4 workers were slower. Reports land in the workspace's
`reports/mutation/` (`mutation.html` to browse, `mutation.json` for tools),
beside the incremental results file `reports/stryker-incremental.json`.
Nothing is sent to the Stryker dashboard. After changing which files are
mutated, delete `reports/` first, because the incremental file keeps the old
files' results in the report.

The shared settings live in `stryker.config.base.mjs`, and each workspace's
`stryker.config.mjs` extends it. Its sandboxes go to the root `.stryker-tmp/`
so that they sit two levels deep like a workspace and relative `../../` paths
still resolve. A workspace leaves out files whose rules another workspace's
tests own; see [test ownership](../code-conventions.md#test-ownership).

When a mutant survives, strengthen the test. Mark it only when no test could
ever kill it (an equivalent mutant), on the line above, with the reason:

```ts
// Stryker disable next-line EqualityOperator: on equal dates either argument is the answer
```

## Local SonarQube

SonarQube is an optional, on-demand analysis tool. Run it when the project owner
requests a scan or when you choose to inspect code quality. Setup and scans are
not required for local development, commits, pull requests, or completing project
work. SonarQube is not part of `pnpm run ci`, GitHub Actions, or commit hooks;
its quality gate does not block this project's workflow.

Run one scan:

```bash
pnpm sonar:scan
```

Each scan is one-off. It removes anything an earlier scan left behind, starts a
SonarQube Community Build container on a free loopback port, replaces the
default admin password with a random one, creates the private `bookkeeping`
project and an analysis token, runs the scanner, and waits for the server to
process the analysis. JavaScript and TypeScript use the explicit **Sonar way
comprehensive** profile, including S9382 (sequential awaits in loops), rather
than the server's smaller default core profile. It then writes the issues and
detailed security hotspots
to `.sonar-reports/issues.json` and `.sonar-reports/issues.md`, and removes
every container, volume, and network it created, also when the scan fails or
you interrupt it. No credentials are saved; without `--keep`, nothing but the
reports outlives the run (`pnpm sonar:clean` removes a kept stack). Run one
scan at a time: a new scan first removes any other scan's stack, including one
still running. The run needs no environment file.

Reports are Git-ignored and overwritten by the next scan. Because every scan
starts from an empty server, they list the issues in the scanned code only:
there is no history, new-code period, or dashboard triage between scans. JSON
preserves issue fields, related locations, rules, and hotspot details; Markdown
provides a readable list.

| Flag             | Effect                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `--keep`         | Leave SonarQube running after the export and print its URL and admin password; the reports link to it |
| `--purge-images` | Also remove the SonarQube and scanner images, which the next scan downloads again                     |

Pass a flag after the script name, as in `pnpm sonar:scan --keep`.
`pnpm sonar:clean` removes a kept or abandoned stack without scanning, and
also accepts `--purge-images`.

The scanner analyzes
`apps/web/src/`, `apps/server/src/`, `packages/domain/src/`,
`packages/database/src/`, `packages/application/src/`, `packages/auth/src/`,
and `infra/aws/`, and classifies colocated Vitest tests and `apps/web/tests/`
as test code; it
skips the generated route tree. It does
not run tests or import coverage, and it skips the `coverage/` reports.

The stack uses SonarQube's embedded database, which is meant for evaluation
only and suits a server that never outlives one scan. It disables
Elasticsearch bootstrap checks for local development. The images use moving
tags; pin versions before relying on this setup in CI or running a shared
server.

See the official [Docker setup](https://docs.sonarsource.com/sonarqube-community-build/server-installation/from-docker-image/set-up-and-start-container)
and [scanner guide](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/sonarscanner).
