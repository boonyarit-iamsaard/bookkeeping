# Supply-chain hardening before protecting `main`

Status: ready-for-agent

Decided on 2026-09-29 by grilling, modelled on the sibling project `stay`.
Facts and sources are in `docs/research/supply-chain-hardening.md`. The owner
applies the GitHub settings by hand; agents change the repository only.

## Problem Statement

The owner keeps real finances in the Railway deployment, and every push to
`main` deploys to it. Nothing stands between a compromised or malicious
dependency, a mutable Action tag, or a rewritten base image and that data. The
repository is public, `main` is unprotected, and the owner works straight on
`main`. The sibling project `stay` already has a hardening layer that this repo
lacks, and the owner wants it in place before switching branch protection on, so
that protection gates something worth gating.

## Solution

Land the hardening as a short series of single-purpose commits on `main`, then
let the owner add a ruleset that requires the three CI checks. After the work,
a dependency release is not installed until it is three days old, a downgrade in
publish trust fails the install, unexpected build scripts fail the install,
every Action and base image is pinned to an immutable reference that Dependabot
keeps current, CI audits the dependency tree and its signatures, and pull
requests get a dependency review. The decisions and the owner's checklist are
recorded in one ADR.

## User Stories

1. As the owner, I want dependency releases younger than three days refused at
   install, so that a malicious publish has time to be caught before I pull it.
2. As the owner, I want an install to fail when a package's publish trust
   level drops, so that a hijacked maintainer account cannot slip a release in.
3. As the owner, I want an install to fail when a dependency wants to run a
   build script I have not approved, so that new postinstall code never runs
   silently.
4. As the owner, I want the approved build scripts listed explicitly, so that
   the allowlist is reviewable in one place.
5. As the owner, I want the package manager pinned by version and integrity
   hash, so that CI, Docker and every machine run the exact same binary.
6. As the owner, I want an engine mismatch to be a hard error, so that nobody
   installs under the wrong Node or pnpm.
7. As the owner, I want a stale install to fail a script run, so that I never
   test against dependencies that do not match the lockfile.
8. As the owner, I want the registry pinned in the repo, so that a stray global
   npm config cannot redirect installs.
9. As the owner, I want CI to verify the lockfile on every install rather than
   trust it, so that a poisoned lockfile in a pull request is caught.
10. As the owner, I want CI to run `pnpm audit` at moderate severity and
    `pnpm audit signatures`, so that known advisories and forged or missing
    registry signatures fail the build.
11. As the owner, I want every GitHub Action pinned to a full commit SHA with a
    version comment, so that a moved tag cannot change what runs.
12. As the owner, I want checkout not to persist credentials, so that later
    steps cannot push with the workflow token.
13. As the owner, I want the workflow token read-only by default, so that a
    compromised step cannot write to the repository.
14. As the owner, I want pull requests reviewed by dependency review at
    moderate severity, so that a vulnerable dependency is flagged before merge.
15. As the owner, I want Dependabot to update npm packages, Actions and both
    Docker images weekly with a three-day cooldown, so that pins do not rot and
    fresh releases wait like they do at install.
16. As the owner, I want minor and patch updates grouped, so that review load
    stays manageable.
17. As the owner, I want the Node major held back in Docker updates, so that the
    runtime moves when I decide.
18. As the owner, I want both Dockerfiles' base images pinned by index digest,
    so that a re-pushed tag cannot change what production runs.
19. As the owner, I want a Dependabot Docker entry for each Dockerfile
    directory, so that both digests are actually maintained.
20. As the owner, I want the API and web images to keep building with the
    hardened pnpm, so that deploys are not broken by the migration.
21. As the owner, I want pnpm 11 adopted in its own commit before the other
    settings, so that a failure has one cause.
22. As the owner, I want the pnpm 11 build-script allowlist expressed as an
    `allowBuilds` map, so that the migration does not silently drop approvals.
23. As the owner, I want an urgent security fix to bypass the age gate for one
    named package, so that the gate never has to be lowered globally.
24. As the owner, I want `main` protected by a ruleset requiring a pull request,
    the three checks, no force-push and no deletion, with linear history, so
    that only reviewed, green changes reach production.
25. As the owner, I want a repository-admin bypass limited to pull requests, so
    that a broken check cannot lock me out in an emergency.
26. As the owner, I want the required checks named `CI`, `SPA browser suite` and
    `Dependency Review`, so that the ruleset matches real job names.
27. As the owner, I want each required check to run green once before the
    ruleset is created, so that they are selectable.
28. As the owner, I want a checklist of the GitHub settings to switch on, so
    that I can apply them without guessing where they live.
29. As the owner, I want outside contributors' workflow runs to need approval,
    so that a fork pull request cannot run code on my runners unreviewed.
30. As the owner, I want secret scanning with push protection and private
    vulnerability reporting enabled, so that leaked keys and reports have a
    safe path.
31. As a future maintainer, I want one ADR explaining why `main` is protected
    and production deploys are gated, so that the reasons survive.
32. As a future maintainer, I want the README's dependency and CI notes to match
    the new reality, so that the docs do not describe the old setup.
33. As the owner, I want a red browser suite to keep blocking the deploy, as
    Railway's wait-for-CI already does, so that protection and deployment agree.

## Implementation Decisions

Delivery is one commit per step, in this order. Each commit is verified with the
routine gate before the next begins; commits are staged by the agent and run by
the owner per the host-commands rule.

1. **Package manager**: move to pnpm 11.x, pinned with the integrity-hash form of
   the pin, and convert the build-script allowlist to an `allowBuilds` map. The
   legacy allowlist keys are ignored by 11, and the research found the install
   then fails on the packages that need approval (esbuild, cpu-features,
   protobufjs, ssh2). Stay off pnpm 12: `pnpm fetch --frozen-lockfile` was
   rejected there in one local run. The four Docker commands (`fetch`, filtered
   offline install, `deploy --legacy`, the package-hook script) worked on 11 in a
   scratch test and must be re-confirmed by a real image build.
2. **Install settings**: copy `stay`'s workspace settings: minimum release age of
   4320 minutes, `trustPolicy: no-downgrade` with `trustPolicyIgnoreAfter` of 30
   days (43200 minutes) and the explanatory comment, `strictDepBuilds`, no
   blanket build allowance, `engineStrict`, `verifyDepsBeforeRun: error`,
   `verifyStoreIntegrity`. Add a repository `.npmrc` pinning the registry, and
   make sure both Dockerfiles copy it. Urgent advisories use a per-package
   release-age exclusion, never a lowered global value.
3. **CI workflow**: pin every Action to a full SHA with a version comment; set
   checkout `persist-credentials: false`; keep workflow `permissions:
contents: read`; add a pull-request-only `Dependency Review` job at
   `fail-on-severity: moderate`; add `pnpm audit --audit-level moderate` and
   `pnpm audit signatures` to the `CI` job. Do not use `--trust-lockfile`. Job
   names stay `CI` and `SPA browser suite`. No path filters, so no check is left
   pending. The dependency-review job is skipped on pushes to `main`, which
   counts as success and does not block Railway's wait-for-CI.
4. **Dependabot and images**: add a Dependabot config with npm (weekly, three-day
   cooldown, grouped minor/patch for dev and prod), github-actions (weekly) and
   a docker entry for each Dockerfile directory (the fetcher is not recursive),
   with the Node major update ignored as `stay` does. Pin `node:24-slim` and
   `caddy:2-alpine` by index digest in the Dockerfiles, keeping the tag in the
   reference so Dependabot can update both. Current digests are in the research
   note and must be re-resolved on the day.
5. **Owner-applied GitHub settings** (documented, not automated; `gh` is not
   installed): after `CI`, `SPA browser suite` and `Dependency Review` have each
   run green once, create a ruleset on `main` requiring a pull request with zero
   approvals, the three status checks, linear history, and blocking force-push
   and deletion, with a repository-admin bypass for pull requests only. Also set
   the default workflow token to read-only, require full-SHA pinned Actions,
   require approval for all outside-contributor runs, and enable secret
   scanning with push protection, Dependabot alerts and security updates, and
   private vulnerability reporting. Signed commits and CodeQL stay off.
6. **Docs**: one new ADR (next number after 0009) recording the trade-off:
   protecting `main` and gating deploys, the settings copied from `stay`, digest
   pinning beyond `stay`, and refusing `--trust-lockfile`. It carries the owner
   checklist. Update the README's dependency-update and CI notes only; leave
   `.scratch` and earlier ADRs historical. No `SECURITY.md`.

Domain glossary: no new terms; `CONTEXT.md` is unchanged.

## Testing Decisions

- A good check here exercises observable behaviour of the tooling, not the text
  of a config file: an install succeeds or fails, a workflow goes green or red,
  an image builds.
- Single seam, the highest available: a clean `pnpm install --frozen-lockfile`
  followed by the routine gate `pnpm run ci` on the developer machine, and the
  same sequence plus the audit steps in the CI workflow on GitHub. Both
  Dockerfiles are additionally exercised by a real `docker build`, because the
  pnpm 11 and digest changes touch them and the routine gate does not.
- Negative checks, run once by hand on a scratch branch and not kept as tests:
  an unlisted build script fails the install; a release younger than the age
  gate is refused; a dependency-review run flags a known-vulnerable addition.
- Browser tests follow the repo policy: no full two-project matrix. Run one
  focused SPA spec on one project only if a step turns out to touch the browser
  boundary, and never concurrently with another heavy task.
- Prior art: the existing CI workflow and its `pnpm run ci` gate; `stay`'s
  workflow, which already runs the audit and dependency-review steps.

## Out of Scope

- Signed commits, CodeQL, and Sonar as a required check.
- Merge queue (unavailable on a User-owned repo).
- `--trust-lockfile` and pnpm 12.
- A `SECURITY.md`, and any change to Railway's configuration beyond relying on
  its existing wait-for-CI.
- Changing the deployed data, migrations, or the production database.
- Automating the GitHub settings with a script or wizard.
- Reworking `stay`.

## Further Notes

- Production data is real. No step may risk it; the Docker changes must be
  proven by a local image build before they land on `main`.
- Live GitHub settings and a few pnpm/Dependabot behaviours are listed as
  UNVERIFIED at the end of the research note; the owner should confirm them in
  the UI when applying step 5.
- Commit messages follow the repo rule: one lowercase conventional subject, no
  body, no scope unless a single domain feature is touched (none here).
- Seam check: the single seam above is the proposal; the owner should confirm it
  is the expected level before implementation starts.
