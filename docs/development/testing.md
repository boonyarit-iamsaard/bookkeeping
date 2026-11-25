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

To look at a signed-in screen, `shot.spec.ts` signs up a fresh user, seeds a
seven-digit wallet, last month's income and today's expense, and saves
full-page light and dark screenshots of each route at each width. It skips
unless `SHOT_ROUTES` is set, and counts as one e2e run under the resource
limits:

```bash
SHOT_ROUTES=/,/reports SHOT_WIDTHS=1024,1440 pnpm --filter @bookkeeping/web test:e2e:shot
```

It prints each file's path, by default under
`apps/web/test-results/shots/`, or `SHOT_DIR`. For the phone, run
`pnpm --filter @bookkeeping/web test:e2e shot.spec.ts --project phone-chromium`
with `SHOT_WIDTHS=360`.

Two browser facts have each cost a failed run:

- A Base UI tooltip opens on keyboard focus (`:focus-visible`), not on
  `locator.focus()`. Tab onto its trigger with `page.keyboard.press("Tab")`,
  then read `[data-slot=tooltip-content]`.
- Rendered sizes are fractional, so compare heights and edges with a
  tolerance of up to a pixel rather than with exact equality, as
  `tests/e2e/helpers/expect-unclipped.ts` does.

## Coverage

Coverage is an on-demand report, not part of `pnpm test` or `pnpm run ci`, and
no required check gates it:

```bash
pnpm test:coverage                                   # Every workspace's unit and integration tests, with coverage
pnpm --filter @bookkeeping/domain test:coverage      # One workspace
```

It counts the same tests as `pnpm test` and needs Docker for the integration
suites. Each workspace writes its own report to `<workspace>/coverage/`:
`index.html` to browse and `lcov.info` for tools. The numbers are per
workspace and are never merged into one total. The shared settings live in
`vitest.coverage.mts`. They count every file under `src/`, so a module no test
loads shows as uncovered, and they exclude tests, `src/testing/` helpers, and
generated `*.gen.ts` files.

The `SonarQube Cloud` workflow also runs `pnpm test:coverage` and uploads every
`lcov.info`, whose paths are relative to the repository root. Its built-in
quality gate asks for 80% coverage on new code; the check is advisory. Its
exclusions match `vitest.coverage.mts` and also leave out the root `scripts/`,
config files, and the web code the browser suite owns.

`apps/web` counts only its unit tests. The browser suite owns its screens,
components (`*.tsx`) and hooks (`use-*.ts`), so Sonar leaves those out of the
coverage condition and judges web pull requests on their plain `.ts` logic.
Keep logic that a unit test can reach in a plain module rather than a hook.
The root `scripts/` suite is repo tooling and has no coverage report.

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

It uses unit tests only and needs no Docker, so it may run alongside anything
but a Sonar scan (see [local resource cost](#local-resource-cost)). `concurrency` is 2;
4 workers were slower. Reports land in the workspace's
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

## Local resource cost

The [resource limits](../../AGENTS.md#local-resource-limits) rest on these
measurements on native Windows (23.7 GB RAM, 16 threads), each run alone with
caches off. "Host" is the memory a run adds on Windows; "VM peak" is the used
memory of the Docker Desktop VM, which runs every container; `.wslconfig` caps
it at 4 GB, of which 3.8 GB is usable. The first four rows date from 2026-11-16 (about 15 GB already
in use) and have no VM figure; the rest from 2026-11-21 (about 19–20 GB in use).

| Run                               | Time  | Host    | VM peak | Max CPU |
| --------------------------------- | ----- | ------- | ------- | ------- |
| `pnpm test` (Turborepo)           | 115 s | +3.9 GB |         | 100%    |
| `test:e2e` on `phone-chromium`    | 309 s | +2.1 GB |         | 86%     |
| `pnpm build`                      | 19 s  | +0.9 GB |         | 77%     |
| Stryker on `domain`               | 33 s  | +0.7 GB |         | 85%     |
| `pnpm test` (Turborepo)           | 101 s |         | 0.95 GB |         |
| `pnpm run ci:e2e`                 | 142 s | +1.9 GB | 0.81 GB | 82%     |
| `stack:build` without layer cache | 300 s | +2.0 GB | 2.13 GB | 94%     |
| `pnpm sonar:scan`                 | 653 s | +3.3 GB | 3.07 GB | 85%     |

`ci:e2e` is a production build and both browser projects, 75 tests on 2
workers. The VM leaves room for the test suite, e2e, and an image build
together, but the host does not: any two of them add 4–6 GB to a machine
already 15–20 GB full. The Sonar scan alone takes the VM within 0.75 GB of its
cap and the host within 0.4 GB. The build and Stryker add under 1 GB each.
Remeasure when Stryker grows past `domain`.

## SonarQube Cloud

SonarQube Cloud analyzes every pull request into `main` and every push to
`main` in the `SonarQube Cloud` workflow
([ADR 0015](../adr/0015-sonar-analysis-in-sonarqube-cloud.md)). Findings on a
pull request's new code appear as an advisory check and a comment, never a merge
gate. Pushes to `main` build the project's history and new-code baseline. The
project is
[`boonyarit-iamsaard_bookkeeping`](https://sonarcloud.io/project/overview?id=boonyarit-iamsaard_bookkeeping),
configured by `sonar-project.properties`.

- **Profile:** the Free plan keeps JavaScript and TypeScript on the default
  **Sonar way core**, a smaller rule set than the local scan's comprehensive
  profile. Rules outside core, including S9382, show up only in a
  [local scan](#local-sonarqube).
- **Scope:** only pull requests targeting `main` are analyzed, so the upper pull
  requests in a stack have no Sonar check.
- **Secrets:** the scan needs the `SONAR_TOKEN` repository secret. Runs without
  it, such as Dependabot and fork pull requests, skip the scan.
- **Reports:** `pnpm sonar:report --pr <number>` or
  `pnpm sonar:report --branch <name>` (default `main`) writes that scope's open
  issues and security hotspots to `.sonar-reports/issues.json` and
  `issues.md`, in the local scan's report shape, with repository-relative paths
  and links to SonarQube Cloud. It reads the public API, so it needs no token
  and no Docker. It is a light task, outside the exclusive-resource rule, and
  may run alongside tests. It fails when the scope has no analysis yet.
- **Editor:** for feedback while editing, install SonarQube for IDE and bind it
  in connected mode to the organization `boonyarit-iamsaard` and that project.
  It runs natively, needs no Docker, and applies the project's Cloud rules.

## Local SonarQube

The local scan is the comprehensive sweep beside SonarQube Cloud: it runs the
**Sonar way comprehensive** profile, including S9382 (sequential awaits in
loops), which the Free plan's core profile leaves out. It is optional and on
demand. Run it when the project owner requests a sweep or when you choose to
inspect code quality; it is not part of `pnpm run ci`, GitHub Actions, or commit
hooks, and its quality gate blocks nothing.

Run one scan:

```bash
pnpm sonar:scan
```

Each scan is one-off. It removes anything an earlier scan left behind, starts a
SonarQube Community Build container on a free loopback port, replaces the
default admin password with a random one, creates the private `bookkeeping`
project with the comprehensive profile and an analysis token, and runs the
scanner. The scanner is the npm-distributed `@sonar/scan`, run natively on the
host, not in a container: a bind-mounted scanner container reads every
`node_modules` file through Docker Desktop's file share and stalls on native
Windows. On its first run it downloads a JRE and the scanner engine from the
server into `~/.sonar/cache`, so no Java install is needed. The scan then waits
for the server to process the analysis, writes the issues and detailed
security hotspots to `.sonar-reports/issues.json` and
`.sonar-reports/issues.md`, and removes every container, volume, and network it
created, also when the scan fails or you interrupt it. No credentials are
saved; without `--keep`, nothing but the reports and the scanner's
`.scannerwork/` directory outlives the run (`pnpm sonar:clean` removes a kept
stack). Run one scan at a time: a new scan first removes any other scan's
stack, including one still running. The run needs no environment file.

Reports are Git-ignored and overwritten by the next scan. Because every scan
starts from an empty server, they list the issues in the scanned code only:
there is no history, new-code period, or dashboard triage between scans. JSON
preserves issue fields, related locations, rules, and hotspot details; Markdown
provides a readable list.

| Flag             | Effect                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `--keep`         | Leave SonarQube running after the export and print its URL and admin password; the reports link to it |
| `--purge-images` | Also remove the SonarQube image, which the next scan downloads again                                  |

Pass a flag after the script name, as in `pnpm sonar:scan --keep`.
`pnpm sonar:clean` removes a kept or abandoned stack without scanning, and
also accepts `--purge-images`.

The scan reads the same `sonar-project.properties` as SonarQube Cloud, only
under the local project key. It classifies colocated Vitest tests and
`apps/web/tests/` as test code and skips the generated route tree and API
client. It does not run tests or import coverage.

The server uses SonarQube's embedded database, which is meant for evaluation
only and suits a server that never outlives one scan. It disables
Elasticsearch bootstrap checks for local development. The server image uses a
moving tag; pin it before relying on this setup in CI or running a shared
server.

See the official [Docker setup](https://docs.sonarsource.com/sonarqube-community-build/server-installation/from-docker-image/set-up-and-start-container)
and [npm scanner guide](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/npm/introduction).
