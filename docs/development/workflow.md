# Workflow

## Git workflow

Work on a task branch before editing tracked files, including documentation.
Start by inspecting `git status --short` and `git branch --show-current`; when
on `main`, create and switch to the task branch. Reuse the branch when
continuing the same task. Keep one branch and pull request per coherent task.

Name branches `<type>/<short-kebab-case-description>` with a conventional
commit type (`feat`, `fix`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`docs`, `chore` or `revert`), such as `feat/wallet-opening-corrections`. Rename
the branch when the task's type changes, as when a `docs/` discussion settles
into implementation (`feat/`): `git branch -m` before pushing, or GitHub's
rename once a pull request is open.

With a clean tree, branch a new task from an updated `main`:

```sh
git switch main && git pull --ff-only
git switch -c docs/reconcile-project-tickets
```

Preserve uncommitted changes. If the task already has edits on `main`, branch
from the current checkout so they stay with it. When another task's work would
interfere, use a separate branch or worktree without discarding or stashing
unrelated changes. Agents run Git writes through the
[host-command policy](../../AGENTS.md#host-commands) when the sandbox requires it.

Merge changes through pull requests with the required `CI`, `SPA browser suite`,
`Dependency Review` and `Acceptance criteria` checks passing; `main` rejects direct pushes. See
[ADR 0010](../adr/0010-protected-main-and-gated-deploys.md). Delete the remote branch on merge:
`gh pr merge --delete-branch`, or `git push origin --delete <branch>`.

Use the [commit-message rules](../../AGENTS.md#commit-messages);
`commitlint.config.ts` is authoritative and the commit-msg hook enforces it.
The branch type names the task; each commit's type names its own changes.

## Checks

```bash
pnpm lint
pnpm format:check
pnpm lint:md
pnpm lint:sh
pnpm types:check
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm run ci` runs the routine check sequence without browser tests: formatting,
linting, every workspace type check, the package and app suites (unit,
PostgreSQL integration, and the Hono contract tests), and then both app builds
as a separate step, so a production build never runs beside the test suites.
The explicit `pnpm run ci:e2e` gate builds the client and runs the full
browser matrix against `vite preview`; run it on its own, never beside another
heavy task.
`pnpm build`, `pnpm test`, and `pnpm types:check` run through Turborepo, which
caches and parallelizes per-workspace tasks (see
[ADR 0002](../adr/0002-turborepo-monorepo.md)).
`pnpm check` applies Biome fixes;
`pnpm format` formats Markdown, YAML, and HTML files; `pnpm fix` runs both and
the Markdown lint fixes.

`pnpm security:audit` fails on a moderate or worse advisory, then verifies
registry signatures. It needs the network and its result changes as advisories
are published, so `pnpm run ci` leaves it out; run it after changing
dependencies, such as reviewing a Dependabot update or an audit exception.

GitHub Actions runs `.github/workflows/ci.yaml` on pull requests and pushes to
`main`. Two jobs run side by side, each installing dependencies with a frozen
lockfile: `CI` runs `pnpm run security:audit`, then `pnpm run ci`, and
`SPA browser suite` installs Chromium (cached by Playwright version) and runs
the SPA browser suite on two workers. A third job, `Dependency Review`, runs on
pull requests only and fails on a moderate or worse vulnerability. The browser
runner switches the API's sign-up throttle off
(`AUTH_RATE_LIMIT_ENABLED=false`) so parallel sign-ups never meet it. Testcontainers
supplies disposable PostgreSQL databases for both operation and browser tests.
No job needs a checked-in `.env` file.

Every Action in the workflow is pinned to a full commit SHA with a version
comment, and checkout does not persist credentials. `main` is protected by a
ruleset that requires a pull request and these three checks, and Railway
deploys it only after CI passes; the reasons and the GitHub settings the owner
applies by hand are in
[ADR 0010](../adr/0010-protected-main-and-gated-deploys.md).

## Dependency updates

Dependabot proposes npm, GitHub Actions, and Docker base-image updates weekly,
after a three-day cooldown, with minor and patch npm updates grouped
(`.github/dependabot.yml`). The Node and toolchain majors are ignored, so they
move when the owner decides. The three Dockerfiles pin base images by digest
beside the tag, and Dependabot updates the pair, ignoring `postgres` majors
for `apps/backup`.

`pnpm-workspace.yaml` holds the install-time gates. A release younger than three
days is not installed (`minimumReleaseAge`), a drop in a package's publish
trust fails the install (`trustPolicy`), and a dependency build script fails
the install unless `allowBuilds` lists it. `.npmrc` pins the registry. For an
urgent advisory, exempt the one fixed package with `minimumReleaseAgeExclude`
instead of lowering the age, and remove the exemption afterward. Do not use
`--trust-lockfile`; CI relies on the full lockfile verification.

To run the workflow locally, install `act`, start Docker, and run:

```bash
act push -j ci
```

`act` uses host networking, loopback Testcontainers URLs, and two Turbo tasks at
a time. Docker Desktop needs host networking enabled. See [.actrc](../../.actrc).
