# Protected `main` gates production deploys behind a hardened supply chain

Railway deploys every push to `main`, and since 2026-09 the deployed database
holds the owner's real finances. The repository is public, `main` was
unprotected, and the owner worked straight on it, so a malicious dependency
release, a moved Action tag, or a re-pushed base image reached that data with
nothing in between. Before switching branch protection on, we copied the
hardening from the sibling project `stay` and went a step further, so that the
protection gates something worth gating. Facts and sources are in
`docs/research/supply-chain-hardening.md`.

We protect `main` with a ruleset that requires a pull request (zero approvals,
because there is one maintainer), the three checks `CI`, `SPA browser suite`
and `Dependency Review`, linear history, and no force-push or deletion. The
one bypass is the repository-admin role, limited to pull requests: the owner
must still open one, so a broken check cannot lock them out but a direct push
is impossible. Railway keeps waiting for CI, so a red check also blocks the
deploy. Behind the ruleset, from `stay`:

- pnpm 11, pinned by version and integrity hash, with `minimumReleaseAge` of
  three days, `trustPolicy: no-downgrade` (judged over the last 30 days),
  `strictDepBuilds`, an explicit `allowBuilds` map, `engineStrict`,
  `verifyDepsBeforeRun: error`, and a repository `.npmrc` pinning the registry.
- Every Action pinned to a full commit SHA with a version comment, checkout
  with `persist-credentials: false`, a read-only workflow token, `pnpm audit`
  at moderate severity, `pnpm audit signatures`, and Dependency Review on pull
  requests.
- Dependabot for npm, Actions and Docker, weekly, with a three-day cooldown.

Beyond `stay`: both Dockerfiles pin their base images by index digest, keeping
the tag beside it so Dependabot can update the pair, and Dependabot has a
Docker entry per Dockerfile directory because its fetcher does not recurse.

## Considered options

- Leave `main` unprotected and rely on care: rejected. The owner is the only
  gate, and a hijacked token or a mistaken push deploys straight to real data.
- Classic branch protection instead of a ruleset: rejected. Its bypass list is
  documented as organization-only, while a ruleset offers a repository-admin
  bypass limited to pull requests.
- No bypass at all: rejected. A flaky or misnamed required check would then
  block every change, including the fix for it, with no way around.
- Required approvals: rejected. One maintainer cannot approve their own pull
  request, so this would only force the bypass every time.
- `--trust-lockfile` to skip the verification pass on install: rejected. The
  pass costs about two minutes on a cold cache, but it re-applies the release-age
  and trust checks to every lockfile entry, so a lockfile poisoned in a pull
  request is caught. pnpm's own docs say to leave it off when outside
  collaborators can edit the lockfile, as they can in this public repository.
- Staying on pnpm 10, or moving to pnpm 12: rejected. Several settings here
  need 11, and `pnpm fetch --frozen-lockfile`, which both Dockerfiles run, was
  rejected by 12 in a local trial.
- Signed commits and CodeQL: declined. Signing adds friction for one
  maintainer without changing who can push, and CodeQL adds another required
  scan to maintain for a small codebase with one author. Revisit if a second
  contributor joins.
- A merge queue: unavailable on a user-owned repository.

## Consequences

- Every change goes through a pull request, including the owner's, and merges
  as squash or rebase because history is linear. If the ruleset's "require
  branches to be up to date" box is ticked, a pull request must also be current
  with `main` before it merges.
- A dependency release younger than three days is not installed. For an urgent
  advisory, exempt the one fixed package through `minimumReleaseAgeExclude`
  rather than lowering the global value, and remove the exemption afterwards.
- A new dependency build script fails the install until it is listed in
  `allowBuilds`, and a publish-trust downgrade fails it until the owner
  reviews the package.
- The `Dependency Review` job is skipped on pushes to `main`, which GitHub
  counts as success, so it does not block Railway's wait-for-CI. No workflow
  uses path filters, since a filtered-out required check stays pending and
  blocks the merge.
- New or updated Actions and base images arrive only as Dependabot or manual
  changes that carry a full SHA or digest; requiring full-SHA pinning makes
  GitHub reject an unpinned Action.
- Dependabot pull requests face the same required checks as the owner's.
- The GitHub settings below live outside the repository and cannot be verified
  from it; the owner applies them by hand and confirms the items the research
  note marks UNVERIFIED.

## Owner checklist

Apply in this order. A required check is selectable only after it has
succeeded once within the past seven days, and the full-SHA requirement is only
safe once the pinned workflow is on `main`.

1. Let `CI`, `SPA browser suite` and `Dependency Review` each run green once
   (the last on a pull request).
2. Settings, Rules, Rulesets: create a ruleset on the default branch, enforcement
   Active, with these rules and this bypass.
   - Require a pull request before merging, with zero required approvals.
   - Require status checks to pass: `CI`, `SPA browser suite`,
     `Dependency Review`.
   - Require linear history.
   - Block force pushes and restrict deletions.
   - Bypass list: the Repository admin role, for pull requests only.
3. Settings, Actions, General:
   - Workflow permissions: read repository contents and packages permissions.
   - Require actions to be pinned to a full-length commit SHA.
   - Approval for running fork pull request workflows: require approval for all
     external contributors.
4. Settings, Advanced Security (Code security):
   - Secret scanning on, with push protection on.
   - Dependabot alerts and Dependabot security updates on.
   - Private vulnerability reporting on.
5. Leave signed commits (the ruleset's signature rule) and CodeQL code scanning
   off: both are declined above.
6. Open a trial pull request to confirm the ruleset blocks a direct push and
   that Railway still deploys on merge.
