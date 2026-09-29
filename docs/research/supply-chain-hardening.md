# Supply-chain hardening before protecting `main`

Researched 2026-09-29. Scope: facts the owner needs to decide how to harden
this repo's supply chain (pnpm, GitHub Actions, Dependabot, Docker base
images, Railway deploys) before turning on branch protection for `main`. The
sibling repo `stay` already has such a layer and is the comparison point. This
note states facts and constraints only; it makes no recommendation.

Sources are primary: pnpm release notes and docs source, GitHub Docs and its
REST description, the Dependabot source, the actions' own repositories, Docker
docs, Railway docs, and the corepack repository. Where a fact came from a local
experiment rather than a document, it says so. Anything not confirmed from a
primary source is marked **UNVERIFIED** and collected at the end.

Two source caveats apply throughout:

- The pnpm docs repository `main` branch documents the latest major (v12), so
  "Added in" labels there are authoritative for when a setting appeared, but
  defaults are stated for the newest major unless the entry says otherwise.
- `gh` is not installed on this machine. Repository facts below come from
  unauthenticated `api.github.com` GET calls, which cannot see admin-only
  settings (Actions permissions, security features, merge-method toggles).

## Current state, and deltas versus `stay`

Read on 2026-09-29 from both working trees.

| Area                | bookkeeping (this repo)                                                                                                             | stay                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packageManager`    | `pnpm@10.27.0`, no integrity hash; local `pnpm -v` prints 10.27.0                                                                   | `pnpm@11.23.0+sha512.f00082e5…` (integrity hash present)                                                                                                                                 |
| `engines`           | `node: ">=24"` only                                                                                                                 | `node: ">=24.0.0"`, `pnpm: ">=11.23.0 <12"`                                                                                                                                              |
| Node pin            | no `.nvmrc`; CI and Dockerfiles say `24` / `node:24-slim`                                                                           | `.nvmrc` = `24`, CI uses `node-version-file`                                                                                                                                             |
| `.npmrc`            | none                                                                                                                                | `registry=https://registry.npmjs.org/` only                                                                                                                                              |
| Build scripts       | legacy `onlyBuiltDependencies: [esbuild]`, `ignoredBuiltDependencies: [sharp, unrs-resolver]`                                       | `allowBuilds` map, `dangerouslyAllowAllBuilds: false`, `strictDepBuilds: true`                                                                                                           |
| Release-age / trust | none set                                                                                                                            | `minimumReleaseAge: 4320`, `trustPolicy: no-downgrade`, `trustPolicyIgnoreAfter: 43200`                                                                                                  |
| Other pnpm settings | none set                                                                                                                            | `engineStrict: true`, `verifyDepsBeforeRun: "error"`, `verifyStoreIntegrity: true`                                                                                                       |
| Overrides / catalog | `overrides` (10 scoped entries) and `catalog` in `pnpm-workspace.yaml`; `.pnpmfile.cjs` `readPackage` hook (better-auth peer strip) | `overrides` and `catalog`; no pnpmfile                                                                                                                                                   |
| Dependabot          | no `.github/dependabot.yml`                                                                                                         | npm weekly (cooldown 3 days, two groups), github-actions weekly, docker on `/apps/server` (ignores `node` major)                                                                         |
| Workflow actions    | tag-pinned: `checkout@v7.0.1`, `setup-node@v7.0.0`, `cache@v6.1.0`                                                                  | SHA-pinned with `# v7.0.1` style comments; `persist-credentials: false`                                                                                                                  |
| CI jobs             | `ci` (name `CI`) and `e2e` (name `SPA browser suite`), both on push to `main` and on `pull_request`                                 | `dependency-review` (name `Dependency Review`, `if: github.event_name == 'pull_request'`) and `ci` (name `CI`)                                                                           |
| CI install          | `pnpm install --frozen-lockfile`                                                                                                    | `pnpm install --frozen-lockfile --trust-lockfile`, then `pnpm run audit` (`pnpm audit --audit-level moderate && pnpm audit signatures`), and a `docker build --pull` of the server image |
| Dockerfiles         | server: two `FROM node:24-slim`; web: `FROM node:24-slim` and `FROM caddy:2-alpine`; none digest-pinned                             | server: two `FROM node:24-slim`, not digest-pinned                                                                                                                                       |
| Docker pnpm setup   | `corepack enable`, then `pnpm fetch --frozen-lockfile`, offline filtered install, `deploy --prod --legacy`                          | `corepack enable`, `corepack install` (honours the pin and hash), single `pnpm install --frozen-lockfile`                                                                                |
| Railway             | two services (`api`, `web`) from `main`, "Wait for CI" ticked in the runbook, `railway.json` with `watchPatterns`                   | not examined                                                                                                                                                                             |

Repository facts from the public API on 2026-09-29:

- `boonyarit-iamsaard/bookkeeping` is **public**, owned by a **User** account
  (`type: User`), default branch `main`, created 2026-09-12.
  <https://api.github.com/repos/boonyarit-iamsaard/bookkeeping>
- No rulesets exist (`GET /repos/{owner}/{repo}/rulesets` returns `[]`) and
  `main` reports `"protected": false`.
  <https://api.github.com/repos/boonyarit-iamsaard/bookkeeping/rulesets>
- The check runs on the latest `main` commit are named `CI` and
  `SPA browser suite`, both from the `github-actions` app.
  <https://api.github.com/repos/boonyarit-iamsaard/bookkeeping/commits/main/check-runs>
- Railway reports through **commit statuses** (`bookkeeping - api`,
  `bookkeeping - web`) and creates **deployments** as `railway-app[bot]`, in
  environment `bookkeeping / production`. All 267 commits are authored by the
  owner; none by a bot.
  <https://api.github.com/repos/boonyarit-iamsaard/bookkeeping/commits/main/status>
  <https://api.github.com/repos/boonyarit-iamsaard/bookkeeping/deployments>
- ADR 0008 states deploys "come from Railway's GitHub integration on `main`,
  gated on CI"; the Railway runbook stage 6 records "Auto-deploy waits for CI on
  both services" as done. ADR 0009 concerns migrations only and says nothing on
  supply chain. (`docs/adr/0008-railway-single-hosting-provider.md`,
  `docs/adr/0009-drizzle-migrations-outside-production.md`,
  `.scratch/deployment/railway-runbook.md`.)

## 1. pnpm 10.27 to 11 (and 12)

### 1.1 Versions and timeline

From the release list at <https://github.com/pnpm/pnpm/releases>:

- v11.0.0 was published 2026-04-28. v11.23.0 (what `stay` pins) 2026-08-23.
  v12.0.0 2026-08-26. At research time the newest tags are v12.8.1 and the
  v11.28.x line; v10.34.5 (2026-07-10) shows v10 still receiving releases.
- pnpm 10.27.0 (this repo's pin) was published 2025-12-30.

Migration guide: <https://pnpm.io/11.x/migration>, source at
<https://github.com/pnpm/pnpm.io/blob/main/docs/migration.md>. It offers a
codemod (`pnpx codemod run pnpm-v10-to-v11`) and says v12 retains the v11
configuration changes.

### 1.2 Breaking changes in v11.0.0

Verbatim-summarised from <https://github.com/pnpm/pnpm/releases/tag/v11.0.0>:

- Node.js 22+ required; pnpm is pure ESM.
- Defaults changed: `minimumReleaseAge` is `1440` minutes (was 0),
  `verifyDepsBeforeRun` is `install`, `optimisticRepeatInstall` is `true`,
  `strictDepBuilds` is `true`, `blockExoticSubdeps` is `true`.
- `onlyBuiltDependencies`, `onlyBuiltDependenciesFile`,
  `neverBuiltDependencies`, `ignoredBuiltDependencies`, and `ignoreDepScripts`
  are **removed**; `allowBuilds` replaces them.
- `.npmrc` is read for auth and registry settings only. Every other setting must
  live in `pnpm-workspace.yaml` or the global `config.yaml`. The `pnpm` field of
  `package.json` is no longer read. `npm_config_*` environment variables are no
  longer read (use `pnpm_config_*`).
- `managePackageManagerVersions`, `packageManagerStrict`, and
  `packageManagerStrictVersion` are removed; `pmOnFail`
  (`download` default, `error`, `warn`, `ignore`) replaces them.
  `COREPACK_ENABLE_STRICT` is no longer honoured by pnpm.
- `pnpm audit` uses npm's bulk advisories endpoint; `auditConfig.ignoreCves`
  becomes GHSA ids (`auditConfig.ignoreGhsas`, later `audit.ignore`).
- Store version 11: the package index moves to SQLite (`index.db`).
- The built-in `clean`, `setup`, `deploy`, and `rebuild` commands now prefer a
  same-named user script. (No `package.json` in this repo defines one.)
- `pnpm add -p` / `-d` change meaning; `pnpm link` and `pnpm install -g` change.
- Lockfile `patchedDependencies` format simplified (auto-migrated).

v12.0.0 (<https://github.com/pnpm/pnpm/releases/tag/v12.0.0>) adds, among
others: an unrecognised setting in `pnpm-workspace.yaml` now fails the command
with `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` when the project pins a pnpm
version the running pnpm satisfies (it was silently ignored before), `engineStrict`
now also fails on an incompatible package reached through a regular dependency
edge under an optional subtree, and `pnpm install --frozen-lockfile false` is no
longer accepted.

### 1.3 `onlyBuiltDependencies` / `ignoredBuiltDependencies` to `allowBuilds`

- `allowBuilds` was added in **v10.26.0**, so it already works on 10.27.0. It is
  a map of matcher to boolean: `true` allows scripts, `false` denies them. The
  release note shows `onlyBuiltDependencies: [esbuild]` plus
  `ignoredBuiltDependencies: [core-js]` equal to
  `allowBuilds: { esbuild: true, core-js: false }`.
  <https://github.com/pnpm/pnpm/releases/tag/v10.26.0>
- For this repo the mapping is `esbuild: true`, `sharp: false`,
  `unrs-resolver: false`. Matchers may carry versions
  (`nx@21.6.4 || 21.6.5: true`) and, for git-hosted packages, a repository URL
  form (since v11.11.0).
  <https://github.com/pnpm/pnpm.io/blob/main/docs/settings/build.md>
- A package with scripts that is not listed is an error under `strictDepBuilds`
  (default `true` since v11; the setting was added in v10.3.0 with default
  `false`). During install pnpm v11 also appends unlisted packages to
  `pnpm-workspace.yaml` with a placeholder value for the owner to set.
  <https://github.com/pnpm/pnpm/releases/tag/v11.0.0>
- `dangerouslyAllowAllBuilds` (added v10.9.0, default `false`) runs every
  dependency's build scripts, present and future.
- **Local experiment, 2026-09-29** (scratch copy of this repo's lockfile,
  manifests and workspace file, pnpm 11.28.1, not the repo itself): with the
  current legacy keys, `pnpm install --frozen-lockfile --offline --filter
@bookkeeping/server...` fails with `ERR_PNPM_IGNORED_BUILDS` and lists
  `cpu-features@0.0.10`, all three `esbuild` versions, `protobufjs@7.6.6`, and
  `ssh2@1.17.0`. So on v11 the old `onlyBuiltDependencies: [esbuild]` entry is
  not honoured (consistent with the v12 note that unknown keys used to be
  ignored silently), and three more packages need an explicit decision. After
  writing `allowBuilds` with `esbuild: true` and `false` for the rest, the
  install succeeded and ran only the three `esbuild` postinstalls.

### 1.4 The Dockerfile commands on pnpm 11

All four were run in the same scratch copy on **pnpm 11.28.1** with the
`allowBuilds` block above and a scratch store (2026-09-29):

| Command in `apps/server/Dockerfile` / `apps/web/Dockerfile`                | Result on 11.28.1                                                                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm fetch --frozen-lockfile`                                             | Works; fetched 981 packages. Runs the lockfile supply-chain verification pass (see 1.6).                              |
| `pnpm install --frozen-lockfile --offline --filter @bookkeeping/server...` | Works; lockfile unchanged; `readPackage` from `.pnpmfile.cjs` still applied.                                          |
| `pnpm install ... --filter @bookkeeping/web...`                            | Works.                                                                                                                |
| `pnpm --filter @bookkeeping/server deploy --prod --legacy /out`            | Works; output has 56 `.pnpm` entries and no `vitest` or `drizzle-kit`, so the pnpmfile peer strip still takes effect. |

Documented status of each piece:

- `pnpm fetch` still exists and its docs still describe the Docker pattern; in
  v11 it runs in `virtualStoreOnly` mode. v11.0.7 fixed `pnpm install` recreating
  `node_modules` after `pnpm fetch`; v11.28.0 makes `fetch` also install the pnpm
  version the lockfile pins when it differs.
  <https://github.com/pnpm/pnpm.io/blob/main/docs/cli/fetch.md>
  <https://github.com/pnpm/pnpm/releases/tag/v11.0.7>
  <https://github.com/pnpm/pnpm/releases/tag/v11.28.0>
- `pnpm deploy --legacy` still exists; without it the deploy needs
  `injectWorkspacePackages` until v12.2.0, which removed that requirement. The
  docs say `--legacy` (or `forceLegacyDeploy: true`) still selects the older
  implementation.
  <https://github.com/pnpm/pnpm.io/blob/main/docs/cli/deploy.md>
- `.pnpmfile.cjs` with `readPackage` is still supported. v11 adds ESM
  `.pnpmfile.mjs`, which takes priority when both exist; only `hooks.fetchers`
  was removed. The lockfile's `pnpmfileChecksum` still gates frozen installs.
  If the file were renamed to `.mjs`, both Dockerfiles' `COPY` lines and both
  `railway.json` `watchPatterns` name `.pnpmfile.cjs` explicitly.
  <https://github.com/pnpm/pnpm.io/blob/main/docs/pnpmfile.md>
- `--filter x...` (a package plus its dependencies) is documented in
  <https://github.com/pnpm/pnpm.io/blob/main/docs/filtering.md>; v11 also adds
  `-F` as an alias.
- **pnpm 12 caveat, local experiment on 12.8.1 (2026-09-29):**
  `pnpm fetch --frozen-lockfile` fails with `unexpected argument
'--frozen-lockfile'`, and a frozen install fails with
  `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE` ("Cannot update
  packageManagerDependencies") when `packageManager` names 12.x but the lockfile
  lacks the `packageManagerDependencies` entry. `install --offline --filter` and
  `deploy --legacy` worked. The fetch docs list only `--dev` and `--prod`
  options. These are observations from one run, not documented behaviour.
- The v11.23.0 release note says a frozen install no longer rewrites the
  `packageManagerDependencies` block and instead fails with
  `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE` if the pinned version is
  missing from or mismatched with the lockfile.
  <https://github.com/pnpm/pnpm/releases/tag/v11.23.0>

### 1.5 Which settings exist in which version

"Added in" comes from <https://github.com/pnpm/pnpm.io/blob/main/docs/settings/>
(`dependency-resolution.md`, `build.md`, `cli.md`, `store.md`) plus the release
notes cited. Units are minutes for both age settings.

| Setting                              | Added in                             | Default                                                                         | Semantics                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minimumReleaseAge`                  | v10.16.0                             | `0` before v11, `1440` from v11                                                 | Minutes that must pass after publish before a version is installable; applies to all dependencies including transitive. `4320` = 3 days.                                                                                                 |
| `minimumReleaseAgeExclude`           | v10.16.0                             | undefined                                                                       | Package names exempt from the age gate; patterns (`@scope/*`) from v10.17.0; version selectors (`pkg@1.2.3 \|\| 2.0.0`) from v10.19.0.                                                                                                   |
| `minimumReleaseAgeStrict`            | v11.0.0                              | `true` if `minimumReleaseAge` is set explicitly (v12.3.0 wording), else `false` | When no version in range is old enough: `false` falls back to an immature version, `true` fails resolution. `pnpm audit --fix` appends the patched version to the Exclude list.                                                          |
| `trustPolicy`                        | v10.21.0                             | `off`                                                                           | `no-downgrade` fails install if a package's trust evidence (trusted publisher, provenance) is weaker than an earlier release. Judged by publish date, not semver; prereleases ignored for stable installs since v10.24.0.                |
| `trustPolicyExclude`                 | v10.22.0                             | `[]`                                                                            | Package selectors exempt from the trust check.                                                                                                                                                                                           |
| `trustPolicyIgnoreAfter`             | v10.27.0                             | undefined                                                                       | Minutes; packages published more than this long ago skip the trust check. `43200` = 30 days.                                                                                                                                             |
| `strictDepBuilds`                    | v10.3.0                              | `false` before v11, `true` from v11                                             | Non-zero exit when any dependency has an unreviewed build script; `false` only warns.                                                                                                                                                    |
| `dangerouslyAllowAllBuilds`          | v10.9.0                              | `false`                                                                         | Runs every dependency build script without approval.                                                                                                                                                                                     |
| `allowBuilds`                        | v10.26.0                             | none                                                                            | See 1.3.                                                                                                                                                                                                                                 |
| `blockExoticSubdeps`                 | v10.26.0                             | `false` in v10, `true` from v11                                                 | Only direct dependencies may use git or tarball-URL sources.                                                                                                                                                                             |
| `verifyDepsBeforeRun`                | v10.6.0 (first release note mention) | `install` from v11 (earlier default not confirmed)                              | Runs on `pnpm run` / `pnpm exec`: `install` auto-installs, `warn`, `prompt`, `error` throws, `false` disables.                                                                                                                           |
| `engineStrict`                       | pre-dates the changelog reviewed     | `false`                                                                         | Refuses dependencies that declare an incompatible Node. A project's own incompatible `engines` field always fails regardless. v12 tightens the optional-edge exemption. v12.6.0 note: root `engines.node` enforced under `engineStrict`. |
| `verifyStoreIntegrity`               | pre-dates the changelog reviewed     | `true`                                                                          | Re-checks a store file's content before linking it if it was modified. Guards accidental corruption; does not protect against a store writable by an attacker.                                                                           |
| `trustLockfile`                      | v11.3.0                              | `false`                                                                         | See 1.6.                                                                                                                                                                                                                                 |
| `minimumReleaseAgeIgnoreMissingTime` | v11.0.0                              | `true`                                                                          | Skip the age check when registry metadata lacks `time`; since v11.23.0 also governs `trustPolicy`.                                                                                                                                       |
| `pmOnFail`                           | v11.0.0                              | `download`                                                                      | What happens when the running pnpm differs from `packageManager` / `devEngines.packageManager`.                                                                                                                                          |

Consequence for a 10.27 to 11 decision: `minimumReleaseAge`, its Exclude,
`trustPolicy` (+Exclude, +IgnoreAfter), `strictDepBuilds`, `engineStrict`,
`verifyDepsBeforeRun`, `verifyStoreIntegrity`, `dangerouslyAllowAllBuilds`,
`blockExoticSubdeps` and `allowBuilds` all exist on 10.27.0. Only
`trustLockfile`, `pnpm audit signatures`, `minimumReleaseAgeStrict`, and
`pmOnFail` need v11 (see 1.6, 1.7). Dependabot's own comment says a
`.npmrc`-based release-age gate works only on pnpm 10.x, because v11 stopped
reading it there.
<https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/file_updater/pnpm_lockfile_updater.rb>

### 1.6 `--trust-lockfile` / `trustLockfile`

- Added in **v11.3.0**, default `false`. When `true`, `pnpm install` skips the
  verification pass that re-applies `minimumReleaseAge` and
  `trustPolicy: no-downgrade` to **every entry already in the loaded
  lockfile**. It does not relax the gates for versions pnpm resolves fresh.
  <https://github.com/pnpm/pnpm/releases/tag/v11.3.0>
  <https://github.com/pnpm/pnpm.io/blob/main/docs/settings/dependency-resolution.md>
- The docs say it suits closed-source projects where every commit comes from a
  trusted author, and: "A poisoned lockfile (one a contributor authored under a
  weaker policy than CI enforces) can slip through, so leave this `false`
  whenever outside collaborators can edit the lockfile." The docs also say most
  projects on the default `frozenLockfile` CI workflow do not need it.
- The pass costs time and memory: v11.3.0 records an out-of-memory case on a
  2 GB heap for about 4,000 lockfile entries with both settings on. In the local
  experiment above (1,158 lockfile entries, default `minimumReleaseAge`, cold
  cache, this machine's network) the pass took 1 min 43 s inside `pnpm fetch`;
  a following install printed "verified 26s ago", i.e. it reuses a recent result.
- `--trust-lockfile` / `--no-trust-lockfile` are accepted on `install` and
  `add`, and from v11.26.0 on `update` and `remove` (v12.3.0 adds
  `--config.trust-lockfile`).
- Dependabot's pnpm updater treats `trustLockfile` and `trustPolicy` as
  verification settings it must not override.
- This repo is **public**, so outside contributors can propose lockfile changes
  through pull requests; branch protection with a required PR narrows who can
  merge one, but the docs' warning is about who can author it.

### 1.7 `pnpm audit signatures`

- Added in **v11.1.0**. It verifies the ECDSA registry signatures of packages
  against keys the registry publishes at `/-/npm/v1/keys`; scoped registries are
  respected and registries with no signing keys are skipped. Exit code is `1` if
  any signature is invalid, or if a registry advertises keys and a package was
  published without a signature; `--json` gives machine-readable output.
  <https://github.com/pnpm/pnpm.io/blob/main/docs/cli/audit.md>
- Source shows it reads the **lockfile** (via `lockfileToAuditRequest`), not
  `node_modules`, so it needs a lockfile and network access to the registry, and
  it errors with `AUDIT_NO_PACKAGES` if the lockfile yields no packages.
  <https://github.com/pnpm/pnpm/blob/main/pnpm11/deps/compliance/commands/src/audit/signatures.ts>
  <https://github.com/pnpm/pnpm/blob/main/pnpm11/deps/security/signatures/src/verifySignatures.ts>
- It checks the registry signature over package name, version and integrity. It
  does not establish provenance or a trusted publisher; that is what
  `trustPolicy` reads.
- v11.28.0 made `pnpm audit` and `pnpm audit signatures` honour `--filter`;
  v11.28.1 makes them fail on unresolvable lockfile references.
- `pnpm audit` itself: since v11 it queries the bulk advisories endpoint;
  `audit.level` and `audit.ignore` (GHSA ids) in `pnpm-workspace.yaml` are
  available from v11.16.0.

### 1.8 `packageManager` integrity hash and corepack

- Corepack accepts `"packageManager": "<name>@<x.y.z>+<algo>.<hex>"`; the hash is
  "optional but strongly recommended as a security practice". `corepack use
<name>@<version>` writes the field and installs; `corepack up` bumps within the
  major line. Only `yarn`, `npm`, and `pnpm` are permitted names.
  <https://github.com/nodejs/corepack/blob/main/README.md>
- Generation and enforcement, from the corepack source: on download it streams
  the archive through `createHash(algo)`; if the spec carries a hash and the
  computed digest differs it throws `Mismatch hashes. Expected …, got …`. When no
  hash is pinned and the source is the npm registry, it instead verifies the
  registry signature, unless `COREPACK_INTEGRITY_KEYS` is empty or `0`.
  <https://github.com/nodejs/corepack/blob/main/sources/corepackUtils.ts>
- `COREPACK_ON_UNVERIFIED_DOWNLOAD` (`warn`, `error`, `strict-warn`,
  `strict-error`, `ignore`) arrived in corepack 0.36.0 (2026-08-28). The `strict-`
  values fail or warn whenever a version is not pinned by a hash even if its
  signature verifies. `COREPACK_ENABLE_STRICT=0` relaxes project-mismatch
  errors. <https://github.com/nodejs/corepack/blob/main/CHANGELOG.md>
- Node.js does not distribute corepack from v25 onward
  (<https://nodejs.org/api/corepack.html>); corepack 0.35.0 dropped Node 20 and
  25 support. Node 24, which both Dockerfiles and CI use, still bundles a
  corepack; which corepack version `node:24-slim` and `actions/setup-node` ship is
  **UNVERIFIED**.
- pnpm 11 also switches itself when the running version differs from the pin
  (`pmOnFail: download`); `stay`'s CI comment says `pnpm/action-setup` crashes on
  pnpm 11.x and that corepack honours the hash. That comment is the owner's
  observation and is **UNVERIFIED** against a primary source.
- With `packageManager: pnpm@10.27.0` and no hash, corepack falls back to the
  registry-signature path above.

## 2. GitHub branch protection for a solo owner

### 2.1 Availability on this repo

- The repo is public and user-owned. GitHub Docs state protected branches are
  available in public repositories with GitHub Free, and rulesets are available
  in public repositories with GitHub Free (and in public and private with Pro,
  Team, Enterprise Cloud).
  <https://github.com/github/docs/blob/main/data/reusables/gated-features/protected-branches.md>
  <https://github.com/github/docs/blob/main/data/reusables/gated-features/repo-rules.md>
- **Merge queue** is available in public repositories **owned by an
  organization**, or private ones on Enterprise Cloud. A user-owned repo does not
  qualify.
  <https://github.com/github/docs/blob/main/data/reusables/gated-features/merge-queue.md>
- **Dependency review** is available for public repositories on github.com.
  <https://github.com/github/docs/blob/main/data/reusables/gated-features/dependency-review.md>
- **Secret scanning** runs automatically and free on public repositories.
  <https://github.com/github/docs/blob/main/data/reusables/gated-features/secret-scanning.md>
  **Push protection**: the docs page for user-level push protection says it is
  available for public repositories at no cost and on by default for the user.
  <https://docs.github.com/en/code-security/concepts/secret-security/push-protection>
- **Private vulnerability reporting**: only public repositories can enable it;
  owners and admins configure it.
  <https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository>
- The current on/off state of Dependabot alerts, dependency graph, secret
  scanning, push protection and private vulnerability reporting for this repo
  is **UNVERIFIED**: the API exposes it to admins only.

### 2.2 Rulesets versus classic branch protection

<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets>
(source `about-rulesets.md`):

- Rulesets and classic rules both apply and are layered; the most restrictive
  version of a rule wins.
- Rulesets: several can target one branch, enforcement can be changed without
  deleting them, anyone with read access can view them, and they can also
  restrict commit metadata. Up to 75 per repository.
- Classic: one rule per pattern. By default admins are exempt; the setting "Do
  not allow bypassing the above settings" applies it to admins. The classic
  docs say bypass-list actors "may only be added … when the repository belongs
  to an organization".
  <https://github.com/github/docs/blob/main/content/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches.md>
- The ruleset "Evaluate" (dry-run) enforcement status appears in the docs only
  behind an enterprise version flag; whether it is offered on a free personal
  repo is **UNVERIFIED**. Active and Disabled exist.

### 2.3 Rules relevant to a solo owner

From <https://github.com/github/docs/blob/main/content/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets.md>:

- **Require a pull request before merging**: "The pull request doesn't
  necessarily have to be approved, but it must be opened." Required approvals is
  a separate setting; the same page documents 0 to 10 for required-reviewer
  teams, and the additional-approval rule for unattributed Copilot pull requests
  "has no effect if the ruleset requires zero approvals".
- **Block force pushes** is enabled by default, and **Restrict deletions** is
  selected by default. With force pushes blocked, admins cannot change or rename
  the default branch unless they can bypass.
- **Require linear history** forbids merge commits, so PRs must use squash or
  rebase merge; the repository must allow one of those merge methods first
  (this repo's merge-method toggles are **UNVERIFIED**).
- **Require status checks**: "strict" (branch must be up to date) is the default
  when the checkbox is on; "loose" is unchecked. An expected source app can be
  chosen per check.
- **Require merge queue** needs the queue to be available (see 2.1).
- **Bypass list** (rulesets): eligible actors are repository admins, the maintain
  or write role, teams, GitHub Apps, and Dependabot. An actor can be bypass
  "Always" or "For pull requests only" (must open a PR but may then bypass
  protections when merging).
  <https://github.com/github/docs/blob/main/data/reusables/repositories/rulesets-bypass-step.md>
  <https://github.com/github/docs/blob/main/data/reusables/repositories/rulesets-branch-tag-bypass-optional-step.md>
  Whether an organization is required for the team and app entries on a personal
  repo is **UNVERIFIED**; the "Repository admin" role entry is documented
  generically.

### 2.4 How required checks are named and matched

<https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks>:

- Checks and commit statuses are matched by name, and Actions produces checks.
  For this repo the observed names are the **job** names `CI` and
  `SPA browser suite` (from the API output in the state section), not the
  workflow name (the workflow is also called `CI`, so the two coincide for one
  of them). The docs tip says job names should be unique across all workflows,
  because the same job name in two workflows gives ambiguous results.
  <https://github.com/github/docs/blob/main/content/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches.md>
- A required check must have completed successfully in the repository within the
  past seven days to be selectable/satisfied by name.
- Required checks must pass on the **latest commit SHA**. `success`, `skipped`
  and `neutral` all count as passing.
- Skipped-check gotchas, quoted from the docs' table:
  - A workflow skipped by path filters, branch filters or a commit message
    leaves its checks **Pending**, which blocks merging ("Waiting for status to
    be reported").
  - A **job** skipped by an `if:` conditional reports **Success**.
  - A job that depends (`needs`) on a failed job is skipped and "may not block
    merging"; the docs say to use `always()` with `needs` for required checks
    that depend on other jobs.
  - Checks from workflow jobs are evaluated only for runs triggered by `push`,
    `pull_request`, `pull_request_review`, `pull_request_target`, `deployment`,
    or `deployment_status`. A `workflow_dispatch` run on a PR head does not
    count. Merge queues need `merge_group`.
- Consequence for this repo's `ci.yaml`: it has no `paths` filter and both jobs
  run on `pull_request` and `push`, so neither is skipped by filtering. `stay`'s
  `dependency-review` job is skipped on `push` by its `if:`, which the docs say
  reports Success there.
- Pull requests that are up to date and green "can be merged locally and pushed
  to the protected branch" without re-running checks on the merge commit.

## 3. GitHub Actions hardening

- **Default `GITHUB_TOKEN` permissions.** Two options exist in repository
  settings, "read" and "write" (REST field `default_workflow_permissions`). For a
  repository created in a personal account the docs say the token has read access
  to `contents` and `packages` by default; older repositories may differ, and this
  repo's setting is **UNVERIFIED** (admin-only). The security guide recommends
  read-only contents by default, raised per job.
  <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository>
  <https://docs.github.com/en/actions/reference/security/secure-use>
  <https://github.com/github/rest-api-description/blob/main/descriptions/api.github.com/api.github.com.yaml>
  This repo's `ci.yaml` already declares `permissions: contents: read` at the top.
- **Allowed actions.** The repository setting offers: allow all, disable
  Actions, or "Allow OWNER, and select non-OWNER, actions and reusable
  workflows" with a list.
- **Require full-length SHA pinning.** "When you enable **Require actions to be
  pinned to a full-length commit SHA**, all actions must be pinned to a
  full-length commit SHA to be used." The REST field is `sha_pinning_required`
  ("Whether actions must be pinned to a full-length commit SHA"), present on
  both organization-level and repository-level permissions endpoints in the
  REST description above. The security guide calls SHA pinning "currently the
  only way to use an action as an immutable release" and notes GitHub offers the
  mandatory policy at repository and organization level. Whether the policy also
  reaches actions nested inside composite actions is **UNVERIFIED**.
- **Current pins.** The tags used in this repo resolve, via the Git refs API on
  2026-09-29, to: `actions/checkout@v7.0.1` = `3d3c42e5aac5ba805825da76410c181273ba90b1`,
  `actions/setup-node@v7.0.0` = `820762786026740c76f36085b0efc47a31fe5020`,
  `actions/cache@v6.1.0` = `55cc8345863c7cc4c66a329aec7e433d2d1c52a9`,
  `actions/dependency-review-action@v5.0.0` = `a1d282b36b6f3519aa1f3fc636f609c47dddb294`.
  The first two and the last equal the SHAs `stay` pins.
  Latest releases seen: checkout v7.0.1, setup-node v7.0.0, cache v6.1.0,
  dependency-review-action v5.0.0.
- **`persist-credentials`.** `actions/checkout` defaults it to `true`; the token
  is kept in local git config and removed in post-job cleanup; `false` opts out.
  Since v6 the credential is stored in a separate file under `$RUNNER_TEMP`
  rather than `.git/config`. <https://github.com/actions/checkout/blob/main/README.md>
- **`dependency-review-action`.** Available for public repositories and for
  private repositories with GitHub Advanced Security; v5 runs on node24 and needs
  runner 2.327.1 or newer. It diffs dependencies between revisions through the
  dependency-graph API, so the dependency graph must be on (whether it is on for
  this repo is **UNVERIFIED**; the docs say repository admins can enable or
  disable it). Default `fail-on-severity` is `low`; `comment-summary-in-pr`
  needs `pull-requests: write`; to block merging, the check must be a required
  status check.
  <https://github.com/actions/dependency-review-action/blob/main/README.md>
- **`pull_request` versus `pull_request_target`.** The security guide warns that
  `pull_request_target` and `workflow_run`, "when used with the checkout of an
  untrusted pull request, expose the repository to security compromises"
  (privileged, write access and secrets), and to avoid `pull_request_target`
  unless necessary. This repo uses only `push` and `pull_request`.
  <https://docs.github.com/en/actions/reference/security/secure-use>
- **Fork-PR workflows in a public repo.** By default all first-time
  contributors need approval to run workflows; the approval tiers are new GitHub
  users, first-time contributors to the repo, or all external contributors.
  <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository>
- **Dependabot-triggered runs.** Secrets for such runs come from Dependabot
  secrets, not Actions secrets. The Dependabot automation guide recommends
  requiring status checks on the target branch for Dependabot PRs, and notes the
  built-in token cannot add PRs to a merge queue.
  <https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/automating-dependabot-with-github-actions>

## 4. Dependabot

Reference: <https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference>
(source `dependabot-options-reference.md`).

- **`cooldown`.** Only for version updates, not security updates. Keys:
  `default-days`, `semver-major-days`, `semver-minor-days`,
  `semver-patch-days`, `include` and `exclude` (each up to 150 entries,
  wildcards allowed; `exclude` wins). The semver-specific keys are supported for
  ecosystems that use semver, including npm and yarn; `docker` and
  `github-actions` support **only `default-days`**. Unspecified semver keys fall
  back to `default-days`. **With no `cooldown` block, Dependabot applies a
  default 3-day cooldown to version updates**; that default does not apply to
  security updates.
- **Cooldown reaches pnpm.** The updater source injects `--config.minimumReleaseAge`
  from the cooldown floor for regular updates and `0` for security updates; when
  the repo also sets `minimumReleaseAge` in `pnpm-workspace.yaml`, the longer
  value wins. It warns and skips the gate on pnpm older than 10.16.
  <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/file_updater/pnpm_lockfile_updater.rb>
- **`groups`.** Keys include `patterns`, `exclude-patterns`, `dependency-type`
  (`development` / `production`), `update-types` (`patch`, `minor`, `major`) and
  `applies-to` (`version-updates` or `security-updates`). For grouped updates a
  10-character digest is appended to the branch name.
- **`directory` / `directories`.** `directory` is one path; `directories` takes a
  list and supports globs. For `github-actions`, `/` makes Dependabot scan
  `/.github/workflows` and a root `action.yml`.
- **Docker.** The Docker file fetcher lists **one directory** (the configured
  `directory`) and picks files whose names match `dockerfile` or `containerfile`
  case-insensitively; it does not recurse. Each Dockerfile directory therefore
  needs its own entry or a `directories` list. This repo has Dockerfiles in
  `/apps/server` and `/apps/web`; `stay`'s config covers `/apps/server` only.
  <https://github.com/dependabot/dependabot-core/blob/main/docker/lib/dependabot/docker/file_fetcher.rb>
- **Digest pinning support.** The Docker parser matches
  `image:tag@sha256:<64 hex>`, and the update checker compares and refreshes the
  digest with the tag, respects cooldown for digest-only refreshes, and treats a
  digest refresh whose per-platform manifests are unchanged as a no-op.
  <https://github.com/dependabot/dependabot-core/blob/main/docker/lib/dependabot/docker/file_parser.rb>
  <https://github.com/dependabot/dependabot-core/blob/main/docker/lib/dependabot/docker/update_checker.rb>
  Docker's own guide also recommends Dependabot with `package-ecosystem: "docker"`
  to keep tags and digests current.
  <https://github.com/docker/docs/blob/main/content/manuals/build/building/best-practices.md>
  The GitHub options reference does not describe digest behaviour; the above is
  from source, and two experiments named in that source
  (`docker_digest_only_update_suppression`, `docker_pin_digests`) gate some of it.
  Whether they are enabled on hosted Dependabot is **UNVERIFIED**.
- **github-actions SHA pins.** Dependabot can update actions pinned to a SHA
  (the security guide says security updates still work for SHA-pinned actions,
  but Dependabot _alerts_ only cover semver-referenced actions). The workflow
  updater has a `VersionCommenter` that maintains the trailing `# vX.Y.Z`
  comment.
  <https://docs.github.com/en/actions/reference/security/secure-use>
  <https://github.com/dependabot/dependabot-core/blob/main/github_actions/lib/dependabot/github_actions/file_updater.rb>
- **pnpm versions.** The GitHub options reference lists pnpm as ecosystem `npm`
  with supported versions **v7, v8, v9, v10**. The Dependabot source, however,
  declares `SUPPORTED_VERSIONS` v7 through **v12** and its updater image installs
  pnpm 11.25.0. The documentation and the source disagree; source is newer.
  <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/pnpm_package_manager.rb>
  <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/Dockerfile>
- **Catalogs and workspace file.** The parser reads `catalog` and `catalogs` from
  `pnpm-workspace.yaml`, skips `workspace:` and `catalog:` specifiers when
  parsing manifests, the fetcher retrieves `pnpm-workspace.yaml`, and a workspace
  updater exists. A lockfile reader handles a pnpm 11 leading env document (it
  takes the last YAML document). Handling of `overrides` in
  `pnpm-workspace.yaml` was not found in the files read and is **UNVERIFIED**.
  <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/file_parser.rb>
  <https://github.com/dependabot/dependabot-core/blob/main/npm_and_yarn/lib/dependabot/npm_and_yarn/pnpm_resolutions.rb>
- **Auto-merge.** Auto-merge does not require branch protection, but its option
  shows only on pull requests that cannot be merged immediately, for example
  because a rule or required check is pending.
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository>

## 5. Railway

<https://docs.railway.com/deployments/github-autodeploys>:

- Autodeploy fires when new commits are pushed to the connected branch. It
  needs at least one project member with a connected GitHub account that has
  contributor access, and the Railway GitHub App must have access to the
  repository and no pending permission updates.
- **Wait for CI** must be turned on per service. Requirements: a workflow that
  runs on `push` to the branch. When on, a new deployment sits in `WAITING`
  "until every GitHub Actions check suite on the commit has finished".
- It reads **workflow-run conclusions, not jobs**: "Railway looks at the
  conclusion of each workflow run, not at individual jobs. Checks from other
  GitHub apps are ignored." A **failed** workflow skips the deployment
  immediately; a **skipped** or **neutral** workflow never blocks; a
  **cancelled** workflow blocks only if no other workflow on the same commit
  succeeded; if workflows have not finished after **two hours** the deployment
  is skipped.
- It does not read GitHub branch protection or ruleset required checks. The doc
  page says nothing about branch protection, verified authors, or the GitHub App
  pushing to the repository, so any interaction beyond the above is **UNVERIFIED**.
  Observed behaviour: the Railway app creates deployments and commit statuses;
  it authored no commits in this repo's history.
- Consequences for this repo's `ci.yaml`: both `ci` and `e2e` are jobs in one
  workflow named `CI` on push to `main`, so a red `e2e` makes the whole workflow
  conclude failure and skips the deploy. `concurrency: cancel-in-progress: true`
  cancels an in-flight run for `main` when a newer push arrives.
  Railway's page also warns that a workflow that must run before every deploy
  should not sit in a group that cancels queued runs.
- Merging a pull request produces a push to `main` (a squash or rebase merge
  creates a new commit there), which triggers both the `push` CI run and the
  Railway autodeploy for that commit. Direct pushes are what branch protection
  would block; Railway's deploy trigger is the resulting push from a merge.
- The `railway.json` `watchPatterns` decide whether a commit triggers a deploy
  for a service; they are path-based.
  <https://docs.railway.com/deployments/monorepo>
- Railway's Dockerfile page documents build-time `ARG` handling, cache mounts
  and `RAILWAY_DOCKERFILE_PATH`, and says nothing on BuildKit, build platform, or
  digest-pinned `FROM` lines.
  <https://docs.railway.com/builds/dockerfiles>

## 6. Digest-pinning `node:24-slim` and `caddy:2-alpine`

- Docker's guide: tags are mutable; pinning `FROM alpine:3.21@sha256:…` "you're
  guaranteed to always use the same image version, even if a publisher replaces
  the tag". The trade-off it states: manual lookup each update and "you're opting
  out of automated security fixes", so it recommends pairing with Dependabot.
  <https://docs.docker.com/build/building/best-practices/#pin-base-image-versions>
  (source: `best-practices.md` in the docs repository).
- **Index versus platform digest.** Both tags are OCI image indexes. Reading
  the Docker Hub registry API (anonymous token, GET only) on 2026-09-29:
  - `node:24-slim`: media type `application/vnd.oci.image.index.v1+json`, index
    digest `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`,
    with platform entries for `linux/amd64` (`5cbc7caba8c2…`), `linux/arm64/v8`
    (`24b8bc177020…`) and `linux/ppc64le` (`416b98170fe6…`), each paired with an
    `unknown/unknown` attestation manifest.
  - `caddy:2-alpine`: index digest
    `sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b`,
    with entries for amd64, arm/v6, arm/v7, arm64/v8, ppc64le, riscv64 and s390x,
    each with an attestation manifest.
    <https://registry-1.docker.io/v2/> (Docker Hub registry HTTP API)
    These digests move whenever the tag is rebuilt; they are a snapshot, not a value
    to copy.
- The index digest is what `docker buildx imagetools inspect` and the registry
  return for the tag, so `FROM node:24-slim@sha256:<index>` stays valid on any
  platform in the index and the builder chooses the platform manifest. A
  platform-manifest digest is valid only for that architecture (a build on an
  arm64 laptop would fail against an amd64 digest). Docker's multi-platform page
  describes the manifest list that "points to multiple manifests" and says
  registries return it and the client picks the platform.
  <https://github.com/docker/docs/blob/main/content/manuals/build/building/multi-platform.md>
- Dependabot compares the per-platform manifests of an old and new index and
  suppresses a digest-only PR where every platform manifest is identical (fails
  open if it cannot compare), see section 4. Whether hosted Dependabot enables
  the experiment gating that code path is **UNVERIFIED**.
- Pitfalls documented or visible in the sources above:
  - Keep the tag as well as the digest (`node:24-slim@sha256:…`): Dependabot's
    parser reads tag and digest, and the tag preserves human meaning.
  - Two `FROM` lines that name the same image (server Dockerfile has two
    `node:24-slim`) each need the digest, and each Dependabot directory must
    list its Dockerfiles (section 4).
  - The digest changes on every base-image patch release of the tag, so the
    Dependabot cadence sets the update rate; Docker's guide states pinning
    forgoes automatic security fixes until the digest is bumped.
  - The runtime stage `FROM node:24-slim` and build stage should stay on the same
    digest or their glibc/Node builds can differ; this is an inference, not a
    documented statement.
  - Which platform Railway builds on is **UNVERIFIED** (its Dockerfile docs do
    not say), which matters only if a platform digest rather than the index were
    chosen.

## Open facts / UNVERIFIED

1. This repo's live GitHub settings, which need an authenticated admin call:
   default `GITHUB_TOKEN` permission, "require actions pinned to SHA", allowed
   actions policy, fork-PR approval policy, dependency graph, Dependabot alerts
   and security updates, secret scanning and push protection, private
   vulnerability reporting, and allowed merge methods (needed before requiring
   linear history).
2. Whether the owner's account plan or a personal (non-organization) repo
   restricts ruleset bypass-list actors other than the repository admin role, and
   whether the ruleset "Evaluate" mode is offered on a free personal repo.
3. Whether the SHA-pinning policy applies to actions nested inside composite
   actions.
4. Whether hosted Dependabot enables the Docker experiments
   `docker_pin_digests` and `docker_digest_only_update_suppression`, and how it
   handles `overrides` in `pnpm-workspace.yaml`. The docs list pnpm v7 to v10 only
   while the source lists up to v12.
5. Railway behaviour under branch protection: the docs do not mention branch
   protection, verified commits, or the app pushing to the repo; the Railway
   build platform and whether `FROM …@sha256:` lines are accepted are not
   documented on the pages read.
6. Which corepack version `node:24-slim` and `actions/setup-node` provide, and
   the precise date `engineStrict` and `verifyStoreIntegrity` first appeared (the
   pnpm docs and release notes reviewed give no "Added in" for either).
7. The `stay` CI comment that `pnpm/action-setup` crashes on pnpm 11.x (no
   primary source checked).
8. The pnpm 12 behaviours in 1.4 (`fetch --frozen-lockfile` rejected, frozen
   install failing on a missing `packageManagerDependencies` entry) come from a
   single local run and are not documented.
9. The local experiments used a scratch copy with only manifests, not the full
   source; they exercised fetch, offline filtered install, and `deploy --legacy`
   but not the `build` step or an actual `docker build`.
